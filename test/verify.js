const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const TEST_FILE = 'test_input.bin';
const DNA_FILE = 'test_output.dna';
const UNPACKED_DIR = 'unpacked_test';

function cleanup() {
    [TEST_FILE, DNA_FILE, 'error.log'].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    if (fs.existsSync(UNPACKED_DIR)) {
        fs.rmSync(UNPACKED_DIR, { recursive: true, force: true });
    }
}

async function runTest() {
    console.log('Starting verification test...');
    cleanup();
    fs.mkdirSync(UNPACKED_DIR);

    // 1. Create a dummy file with non-multiple of 7 bytes (e.g., 20 bytes)
    const originalContent = Buffer.from('Hello Geometry Logic System DNA! 123', 'utf8');
    fs.writeFileSync(TEST_FILE, originalContent);
    console.log(`Original Size: ${originalContent.length} bytes`);

    // 2. Pack
    console.log('Packing...');
    execSync(`node app.js pack ${TEST_FILE} ${DNA_FILE}`);

    // 3. Unpack into Directory
    console.log('Unpacking into directory...');
    execSync(`node app.js unpack ${DNA_FILE} ${UNPACKED_DIR}`);

    // 4. Verify Directory Unpack
    // 3. Unpack
    console.log('Unpacking...');
    execSync(`node app.js unpack ${DNA_FILE} ${UNPACKED_DIR}`);

    // 4. Verify
    const unpackedFile = path.join(UNPACKED_DIR, TEST_FILE);
    const unpackedContent = fs.readFileSync(unpackedFile);

    console.log(`Unpacked Size: ${unpackedContent.length} bytes`);

    assert.strictEqual(originalContent.length, unpackedContent.length, 'Size mismatch');
    assert.deepStrictEqual(originalContent, unpackedContent, 'Content mismatch');
    console.log('✅ Bit-perfect restoration (to directory) verified!');

    // 3.1 Unpack into Specific Filename
    const SPECIFIC_FILE = 'specific_name.bin';
    console.log('Unpacking into specific filename...');
    execSync(`node app.js unpack ${DNA_FILE} ${SPECIFIC_FILE}`);

    // 4.1 Verify Specific File Unpack
    const specificUnpackedContent = fs.readFileSync(SPECIFIC_FILE);
    assert.strictEqual(originalContent.length, specificUnpackedContent.length, 'Specific file size mismatch');
    assert.deepStrictEqual(originalContent, specificUnpackedContent, 'Specific file content mismatch');
    console.log('✅ Bit-perfect restoration (to specific file) verified!');
    fs.unlinkSync(SPECIFIC_FILE);
    console.log('✅ Bit-perfect restoration verified!');

    // 5. Test Jump-to-Read (Read index 1)
    console.log('Testing Jump-to-Read...');
    const output = execSync(`node app.js read ${DNA_FILE} 1`).toString();
    console.log(output);
    assert(output.includes('Unit 1:'), 'Jump-to-Read failed');
    console.log('✅ Jump-to-Read verified!');

    cleanup();
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
