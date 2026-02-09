
# snap.db

A simple, robust, and synchronous JSON-based key-value database for Node.js.
Perfect for Discord bots and small projects where you need persistent storage without the hassle of setting up a database server.

## Features

- 🚀 **Easy to use**: Simple `set`, `get`, `push`, `pull` API.
- ⚡ **Fast**: Synchronous operations using native filesystem.
- 📂 **No Dependencies**: Uses Node.js `fs` module, so no native compilation errors.
- 💾 **JSON Storage**: Data is stored in a human-readable `database.json` file.

## Installation

```bash
npm install snap.db
```

## Usage

```javascript
const { SnapDB } = require('snap.db');

// Initialize the database (creates 'database.json' by default)
const db = new SnapDB();

// Or specify a file path
// const db = new SnapDB('my-db.json');

// --- Basic Operations ---

// Set a value
db.set('user.name', 'Alice');
db.set('user.balance', 100);

// Get a value
console.log(db.get('user.name')); // Output: "Alice"
console.log(db.get('user.balance')); // Output: 100

// Check availability
if (db.has('user.balance')) {
    console.log('User has a balance!');
}

// Delete a value
db.delete('user.name');

// --- Math Operations ---

// Add to a number
db.add('user.balance', 50); // Balance is now 150

// Subtract from a number
db.subtract('user.balance', 25); // Balance is now 125

// --- Array Operations ---

// Push to an array
db.push('guild.roles', 'Admin');
db.push('guild.roles', 'Moderator');

// Pull (remove) from an array
db.pull('guild.roles', 'Moderator'); // Removes 'Moderator'

// --- varied ---

// Get all data
console.log(db.all());

// Clear the entire database
db.clear();
```


## Professional Features 🚀

`snap.db` is now equipped with high-performance features suitable for production environments.

### ⚡ In-Memory Caching
All data is cached in memory for **instant** read speeds (`O(1)`). Writes are synchronous and atomic to ensure data safety.

### 🔒 Encryption
Secure your data at rest with AES-256-CBC encryption.

```javascript
const db = new SnapDB({ 
    filePath: 'secure.db', 
    encryptionKey: '12345678901234567890123456789012' // Must be 32 chars
});
```
*Note: If you lose the key, data is unrecoverable.*

### 📡 Event System
Listen to database changes in real-time.

```javascript
db.on('set', (key, value) => {
    console.log(`Key "${key}" was set to:`, value);
});

db.on('delete', (key) => {
    console.log(`Key "${key}" was deleted.`);
});
```

### 🧮 Advanced Math
Perform complex calculations directly on keys.

```javascript
// Supported: '+', '-', '*', '/', '%'
db.math('user.xp', '*', 2); // Double XP!
db.math('user.health', '/', 2); // Halve health
```

### 📦 Backups
Create instant backups of your database.

```javascript
db.backup('backup_date.json');
```

## API

### `new SnapDB(options?)`
- `options` (object | string): Configuration object or file path string.
  - `filePath` (string): Path to JSON file.
  - `encryptionKey` (string): 32-char key for encryption.
  - `pretty` (boolean): Indent JSON output (default: true).
  - `debug` (boolean): meaningful error logs.

### Methods
- `set(key, value)`
- `get(key, defaultValue?)`
- `has(key)`
- `delete(key)`
- `math(key, operator, number)`
- `push(key, ...elements)`
- `pull(key, elementOrFilter)`
- `all()`
- `clear()`
- `backup(path)`


## License

MIT
