import { EventEmitter } from 'events';
interface BoltDBOptions {
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
export declare class BoltDB extends EventEmitter {
    filePath: string;
    options: BoltDBOptions;
    private _cache;
    private _algorithm;
    private _ivLength;
    constructor(options?: BoltDBOptions | string);
    /**
     * Loads the database from disk into memory.
     */
    private _load;
    /**
     * Saves the current memory cache to disk.
     */
    private _save;
    private _encrypt;
    private _decrypt;
    private _setDeep;
    private _getDeep;
    private _deleteDeep;
    /**
     * Set a value in the database.
     * @param key The key to set (supports dot notation)
     * @param value The value to store
     */
    set<T = any>(key: string, value: T): T;
    /**
     * Get a value from the database.
     * @param key The key to look for (supports dot notation)
     * @param defaultValue Optional default value if key not found
     */
    get<T = any>(key: string, defaultValue?: T): T | undefined;
    /**
     * Check if a key exists in the database.
     */
    has(key: string): boolean;
    /**
     * Delete a key from the database.
     */
    delete(key: string): boolean;
    /**
     * Add a number to a key.
     */
    add(key: string, count: number): number;
    /**
     * Subtract a number from a key.
     */
    subtract(key: string, count: number): number;
    /**
     * Perform mathematical operations on a key.
     */
    math(key: string, operator: '+' | '-' | '*' | '/' | '%', operand: number): number;
    /**
     * Push an element to an array.
     */
    push<T = any>(key: string, ...elements: T[]): T[];
    /**
     * Remove (pull) elements from an array which match the given filter or value.
     */
    pull<T = any>(key: string, elementOrFilter: T | ((item: T) => boolean)): T[];
    /**
     * Returns the entire database object.
     */
    all(): any;
    /**
     * Clears the entire database.
     */
    clear(): void;
    /**
     * Creates a backup of the current database file.
     * @param destPath Path to save the backup to.
     */
    backup(destPath: string): boolean;
}
export {};
