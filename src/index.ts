
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import crypto, { BinaryLike, CipherKey } from 'crypto';

interface SnapDBOptions {
    /**
     * File path for the database. generic 'database.json' by default.
     */
    filePath?: string;
    /**
     * Secret key for encryption. If provided, the database will be encrypted.
     * Must be 32 characters long.
     */
    encryptionKey?: string;
    /**
     * Format the JSON file with indentation for readability. Default: true.
     * Set to false for smaller file size.
     */
    pretty?: boolean;
    /**
     * Enable debug logging.
     */
    debug?: boolean;
}

export class SnapDB extends EventEmitter {
    public filePath: string;
    public options: SnapDBOptions;
    private _cache: any = {};
    private _algorithm = 'aes-256-cbc';
    private _ivLength = 16;

    constructor(options: SnapDBOptions | string = {}) {
        super();
        
        if (typeof options === 'string') {
            options = { filePath: options };
        }

        this.options = { 
            filePath: 'database.json', 
            pretty: true, 
            ...options 
        };

        this.filePath = path.resolve(this.options.filePath!);

        // Validate Encryption Key
        if (this.options.encryptionKey) {
            if (this.options.encryptionKey.length !== 32) {
                throw new Error('Encryption key must be exactly 32 characters long.');
            }
        }

        this._load();
    }

    /**
     * Loads the database from disk into memory.
     */
    private _load(): void {
        try {
            if (!fs.existsSync(this.filePath)) {
                this._cache = {};
                this._save(); // Create file
                return;
            }

            const fileContent = fs.readFileSync(this.filePath, 'utf-8');
            
            if (!fileContent.trim()) {
                this._cache = {};
                return;
            }

            if (this.options.encryptionKey) {
                 try {
                    this._cache = JSON.parse(this._decrypt(fileContent));
                 } catch (e) {
                     // Fallback check: maybe it wasn't encrypted before?
                     // Or wrong key.
                     if (this.options.debug) console.error("Decryption failed. attempting plain text read.", e);
                     try {
                        this._cache = JSON.parse(fileContent);
                     } catch (e2) {
                        this._cache = {}; // Corrupt file or wrong key
                     }
                 }
            } else {
                this._cache = JSON.parse(fileContent);
            }

        } catch (err) {
            if (this.options.debug) console.error("Load Error:", err);
            this._cache = {};
        }
        this.emit('ready', this);
    }

    /**
     * Saves the current memory cache to disk.
     */
    private _save(): void {
        try {
            let dataToWrite: string;
            
            if (this.options.encryptionKey) {
                dataToWrite = this._encrypt(JSON.stringify(this._cache));
            } else {
                dataToWrite = JSON.stringify(this._cache, null, this.options.pretty ? 2 : undefined);
            }

            // Write to temp file then rename (atomic write prevention of corruption)
            const tempPath = `${this.filePath}.tmp`;
            fs.writeFileSync(tempPath, dataToWrite);
            fs.renameSync(tempPath, this.filePath);

        } catch (err) {
            if (this.options.debug) console.error("Write Error:", err);
            this.emit('error', err);
        }
    }

    // --- Encryption Helpers ---
    private _encrypt(text: string): string {
        if (!this.options.encryptionKey) return text;
        const iv = crypto.randomBytes(this._ivLength);
        const cipher = crypto.createCipheriv(this._algorithm, Buffer.from(this.options.encryptionKey), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    private _decrypt(text: string): string {
        if (!this.options.encryptionKey) return text;
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(this._algorithm, Buffer.from(this.options.encryptionKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    // --- Deep Object Helpers ---
    private _setDeep(path: string, value: any): void {
        const keys = path.split('.');
        let current = this._cache;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }

    private _getDeep(path: string): any {
        const keys = path.split('.');
        let current = this._cache;
        for (const key of keys) {
            if (current === undefined || current === null || typeof current !== 'object') return undefined;
            current = current[key];
        }
        return current;
    }

    private _deleteDeep(path: string): boolean {
        const keys = path.split('.');
        let current = this._cache;
        for (let i = 0; i < keys.length - 1; i++) {
             const key = keys[i];
             if (current === undefined || current === null || typeof current !== 'object') return false;
             current = current[key];
        }
        if (current && typeof current === 'object') {
            const lastKey = keys[keys.length - 1];
            if (lastKey in current) {
                delete current[lastKey];
                return true;
            }
        }
        return false;
    }

    // --- Public API ---

    /**
     * Set a value in the database.
     * @param key The key to set (supports dot notation)
     * @param value The value to store
     */
    public set<T = any>(key: string, value: T): T {
        this._setDeep(key, value);
        this._save();
        this.emit('set', key, value);
        return value;
    }

    /**
     * Get a value from the database.
     * @param key The key to look for (supports dot notation)
     * @param defaultValue Optional default value if key not found
     */
    public get<T = any>(key: string, defaultValue?: T): T | undefined {
        const val = this._getDeep(key);
        return val === undefined ? defaultValue : val;
    }

    /**
     * Check if a key exists in the database.
     */
    public has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a key from the database.
     */
    public delete(key: string): boolean {
        const deleted = this._deleteDeep(key);
        if (deleted) {
            this._save();
            this.emit('delete', key);
        }
        return deleted;
    }

    /**
     * Add a number to a key.
     */
    public add(key: string, count: number): number {
        const current = this.get<number>(key, 0);
        if (typeof current !== 'number') throw new Error(`Value at key "${key}" is not a number.`);
        const newVal = current + count;
        this.set(key, newVal);
        return newVal;
    }

    /**
     * Subtract a number from a key.
     */
    public subtract(key: string, count: number): number {
        return this.add(key, -count);
    }
    
    /**
     * Perform mathematical operations on a key.
     */
    public math(key: string, operator: '+' | '-' | '*' | '/' | '%', operand: number): number {
        const current = this.get<number>(key, 0);
         if (typeof current !== 'number') throw new Error(`Value at key "${key}" is not a number.`);
        
        let newVal: number;
        switch(operator) {
            case '+': newVal = current + operand; break;
            case '-': newVal = current - operand; break;
            case '*': newVal = current * operand; break;
            case '/': newVal = current / operand; break;
            case '%': newVal = current % operand; break;
            default: throw new Error(`Invalid operator: ${operator}`);
        }
        
        this.set(key, newVal);
        return newVal;
    }

    /**
     * Push an element to an array.
     */
    public push<T = any>(key: string, ...elements: T[]): T[] {
        const current = this.get<T[]>(key, []);
        if (!Array.isArray(current)) throw new Error(`Value at key "${key}" is not an array.`);
        
        current.push(...elements);
        this.set(key, current);
        return current;
    }

    /**
     * Remove (pull) elements from an array which match the given filter or value.
     */
    public pull<T = any>(key: string, elementOrFilter: T | ((item: T) => boolean)): T[] {
         const current = this.get<T[]>(key, []);
         if (!Array.isArray(current)) throw new Error(`Value at key "${key}" is not an array.`);

         let newArr: T[];
         if (typeof elementOrFilter === 'function') {
             // @ts-ignore
             newArr = current.filter(item => !elementOrFilter(item));
         } else {
             newArr = current.filter(item => JSON.stringify(item) !== JSON.stringify(elementOrFilter));
         }
         
         this.set(key, newArr);
         return newArr;
    }

    /**
     * Returns the entire database object.
     */
    public all(): any {
        return this._cache;
    }

    /**
     * Clears the entire database.
     */
    public clear(): void {
        this._cache = {};
        this._save();
        this.emit('clear');
    }
    
    /**
     * Creates a backup of the current database file.
     * @param destPath Path to save the backup to.
     */
    public backup(destPath: string): boolean {
        try {
            fs.copyFileSync(this.filePath, path.resolve(destPath));
            return true;
        } catch (err) {
            return false;
        }
    }
}
