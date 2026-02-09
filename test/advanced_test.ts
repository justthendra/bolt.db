
import { SnapDB } from '../src/index';
import fs from 'fs';
import assert from 'assert';

const FILE_PLAIN = 'test_plain.json';
const FILE_ENC = 'test_enc.json';

// Cleanup
if (fs.existsSync(FILE_PLAIN)) fs.unlinkSync(FILE_PLAIN);
if (fs.existsSync(FILE_ENC)) fs.unlinkSync(FILE_ENC);

async function runTests() {
    console.log('--- Advanced Features Test ---');

    console.log('1. Testing Events...');
    const db = new SnapDB({ filePath: FILE_PLAIN });
    
    let eventTriggered = false;
    db.on('set', (key, value) => {
        console.log(`Event 'set' received: ${key} = ${value}`);
        eventTriggered = true;
    });

    db.set('foo', 'bar');
    assert.strictEqual(eventTriggered, true, "Event was not triggered");
    console.log('✅ Events Passed');


    console.log('2. Testing In-Memory Caching...');
    // Mechanically, if I manually edit the file, the DB should NOT see it until reload
    // because it reads from cache.
    const originalValue = db.get('foo');
    fs.writeFileSync(FILE_PLAIN, JSON.stringify({ foo: "hacked" }));
    const cachedValue = db.get('foo');
    assert.strictEqual(cachedValue, 'bar', "Cache bypassed! Should have returned memory value.");
    console.log('✅ Caching Passed');


    console.log('3. Testing Encryption...');
    const secret = '12345678901234567890123456789012'; // 32 chars
    const dbEnc = new SnapDB({ filePath: FILE_ENC, encryptionKey: secret });
    
    dbEnc.set('secretDetails', { plan: 'world_domination' });
    
    // Check file content - should be unreadable
    const rawContent = fs.readFileSync(FILE_ENC, 'utf-8');
    console.log('Encrypted File Content Start:', rawContent.substring(0, 20) + '...');
    assert.doesNotMatch(rawContent, /world_domination/, "File is not encrypted!");

    // Check read
    const readVal = dbEnc.get('secretDetails');
    assert.deepStrictEqual(readVal, { plan: 'world_domination' }, "Decryption failed!");
    console.log('✅ Encryption Passed');

    // Cleanup
    if (fs.existsSync(FILE_PLAIN)) fs.unlinkSync(FILE_PLAIN);
    if (fs.existsSync(FILE_ENC)) fs.unlinkSync(FILE_ENC);
    
    console.log('--- All Advanced Tests Passed ---');
}

runTests().catch(console.error);
