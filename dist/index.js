"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoltDB = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
class BoltDB extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this._cache = {};
        this._algorithm = 'aes-256-cbc';
        this._ivLength = 16;
        if (typeof options === 'string') {
            options = { filePath: options };
        }
        this.options = {
            filePath: 'database.json',
            pretty: true,
            ...options
        };
        this.filePath = path_1.default.resolve(this.options.filePath);
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
    _load() {
        try {
            if (!fs_1.default.existsSync(this.filePath)) {
                this._cache = {};
                this._save(); // Create file
                return;
            }
            const fileContent = fs_1.default.readFileSync(this.filePath, 'utf-8');
            if (!fileContent.trim()) {
                this._cache = {};
                return;
            }
            if (this.options.encryptionKey) {
                try {
                    this._cache = JSON.parse(this._decrypt(fileContent));
                }
                catch (e) {
                    // Fallback check: maybe it wasn't encrypted before?
                    // Or wrong key.
                    if (this.options.debug)
                        console.error("Decryption failed. attempting plain text read.", e);
                    try {
                        this._cache = JSON.parse(fileContent);
                    }
                    catch (e2) {
                        this._cache = {}; // Corrupt file or wrong key
                    }
                }
            }
            else {
                this._cache = JSON.parse(fileContent);
            }
        }
        catch (err) {
            if (this.options.debug)
                console.error("Load Error:", err);
            this._cache = {};
        }
        this.emit('ready', this);
    }
    /**
     * Saves the current memory cache to disk.
     */
    _save() {
        try {
            let dataToWrite;
            if (this.options.encryptionKey) {
                dataToWrite = this._encrypt(JSON.stringify(this._cache));
            }
            else {
                dataToWrite = JSON.stringify(this._cache, null, this.options.pretty ? 2 : undefined);
            }
            // Write to temp file then rename (atomic write prevention of corruption)
            const tempPath = `${this.filePath}.tmp`;
            fs_1.default.writeFileSync(tempPath, dataToWrite);
            fs_1.default.renameSync(tempPath, this.filePath);
        }
        catch (err) {
            if (this.options.debug)
                console.error("Write Error:", err);
            this.emit('error', err);
        }
    }
    // --- Encryption Helpers ---
    _encrypt(text) {
        if (!this.options.encryptionKey)
            return text;
        const iv = crypto_1.default.randomBytes(this._ivLength);
        const cipher = crypto_1.default.createCipheriv(this._algorithm, Buffer.from(this.options.encryptionKey), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }
    _decrypt(text) {
        if (!this.options.encryptionKey)
            return text;
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto_1.default.createDecipheriv(this._algorithm, Buffer.from(this.options.encryptionKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
    // --- Deep Object Helpers ---
    _setDeep(path, value) {
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
    _getDeep(path) {
        const keys = path.split('.');
        let current = this._cache;
        for (const key of keys) {
            if (current === undefined || current === null || typeof current !== 'object')
                return undefined;
            current = current[key];
        }
        return current;
    }
    _deleteDeep(path) {
        const keys = path.split('.');
        let current = this._cache;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current === undefined || current === null || typeof current !== 'object')
                return false;
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
    set(key, value) {
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
    get(key, defaultValue) {
        const val = this._getDeep(key);
        return val === undefined ? defaultValue : val;
    }
    /**
     * Check if a key exists in the database.
     */
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Delete a key from the database.
     */
    delete(key) {
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
    add(key, count) {
        const current = this.get(key, 0);
        if (typeof current !== 'number')
            throw new Error(`Value at key "${key}" is not a number.`);
        const newVal = current + count;
        this.set(key, newVal);
        return newVal;
    }
    /**
     * Subtract a number from a key.
     */
    subtract(key, count) {
        return this.add(key, -count);
    }
    /**
     * Perform mathematical operations on a key.
     */
    math(key, operator, operand) {
        const current = this.get(key, 0);
        if (typeof current !== 'number')
            throw new Error(`Value at key "${key}" is not a number.`);
        let newVal;
        switch (operator) {
            case '+':
                newVal = current + operand;
                break;
            case '-':
                newVal = current - operand;
                break;
            case '*':
                newVal = current * operand;
                break;
            case '/':
                newVal = current / operand;
                break;
            case '%':
                newVal = current % operand;
                break;
            default: throw new Error(`Invalid operator: ${operator}`);
        }
        this.set(key, newVal);
        return newVal;
    }
    /**
     * Push an element to an array.
     */
    push(key, ...elements) {
        const current = this.get(key, []);
        if (!Array.isArray(current))
            throw new Error(`Value at key "${key}" is not an array.`);
        current.push(...elements);
        this.set(key, current);
        return current;
    }
    /**
     * Remove (pull) elements from an array which match the given filter or value.
     */
    pull(key, elementOrFilter) {
        const current = this.get(key, []);
        if (!Array.isArray(current))
            throw new Error(`Value at key "${key}" is not an array.`);
        let newArr;
        if (typeof elementOrFilter === 'function') {
            // @ts-ignore
            newArr = current.filter(item => !elementOrFilter(item));
        }
        else {
            newArr = current.filter(item => JSON.stringify(item) !== JSON.stringify(elementOrFilter));
        }
        this.set(key, newArr);
        return newArr;
    }
    /**
     * Returns the entire database object.
     */
    all() {
        return this._cache;
    }
    /**
     * Clears the entire database.
     */
    clear() {
        this._cache = {};
        this._save();
        this.emit('clear');
    }
    /**
     * Creates a backup of the current database file.
     * @param destPath Path to save the backup to.
     */
    backup(destPath) {
        try {
            fs_1.default.copyFileSync(this.filePath, path_1.default.resolve(destPath));
            return true;
        }
        catch (err) {
            return false;
        }
    }
}
exports.BoltDB = BoltDB;
