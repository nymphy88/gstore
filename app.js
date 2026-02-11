const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const geometry = require('./core/geometry');
const storage = require('./core/storage');

const UNIT_SIZE = config.unitSize || 7;
const ERROR_LOG = 'error.log';

function logError(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.error(message);
    fs.appendFileSync(ERROR_LOG, logEntry);
}

async function pack(inputPath, outputPath) {
    try {
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file does not exist: ${inputPath}`);
        }

        const stats = fs.statSync(inputPath);
        const fileSize = stats.size;

        // Disk space check (2x input size)
        const hasSpace = await storage.hasEnoughSpace(path.dirname(outputPath), fileSize * 2);
        if (!hasSpace) {
             // We'll log a warning but proceed if user is sure,
             // but here we follow instructions to check.
             console.warn('Warning: Disk space might be low.');
        }

        const inputStream = fs.createReadStream(inputPath);
        const outputStream = fs.createWriteStream(outputPath);

        // 1. Write Header
        // Signature: DNA (3 bytes)
        // Original Size: 8 bytes (BigInt)
        // Filename: Remaining bytes (using basename)
        const filename = path.basename(inputPath);
        const filenameBuf = Buffer.from(filename, 'utf8');

        const header = Buffer.alloc(3 + 8 + 1 + filenameBuf.length);
        header.write('DNA', 0);
        header.writeBigInt64LE(BigInt(fileSize), 3);
        header.writeUInt8(filenameBuf.length, 11);
        filenameBuf.copy(header, 12);

        outputStream.write(header);

        // 2. Process Data in 7-byte chunks
        console.log(`Packing ${inputPath} to ${outputPath}...`);

        let buffer = Buffer.alloc(0);

        for await (const chunk of inputStream) {
            buffer = Buffer.concat([buffer, chunk]);

            while (buffer.length >= UNIT_SIZE) {
                const unit = buffer.slice(0, UNIT_SIZE);
                outputStream.write(unit);
                buffer = buffer.slice(UNIT_SIZE);
            }
        }

        // Handle padding for the last chunk
        if (buffer.length > 0) {
            const paddedUnit = Buffer.alloc(UNIT_SIZE, 0);
            buffer.copy(paddedUnit);
            outputStream.write(paddedUnit);
        }

        outputStream.end();
        console.log('Packing complete.');

    } catch (error) {
        logError(`Pack Error: ${error.message}`);
    }
}

async function unpack(inputPath, outputDir) {
    try {
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file does not exist: ${inputPath}`);
        }

        const fd = fs.openSync(inputPath, 'r');

        // 1. Read Header
        // Read fixed part first: DNA (3) + Size (8) + NameLen (1) = 12 bytes
        const fixedHeader = Buffer.alloc(12);
        fs.readSync(fd, fixedHeader, 0, 12, 0);

        if (fixedHeader.slice(0, 3).toString() !== 'DNA') {
            throw new Error('Invalid DNA file format');
        }

        const originalSize = Number(fixedHeader.readBigInt64LE(3));
        const nameLen = fixedHeader.readUInt8(11);

        const nameBuf = Buffer.alloc(nameLen);
        fs.readSync(fd, nameBuf, 0, nameLen, 12);
        const originalName = nameBuf.toString('utf8');

        let outputPath;
        // If outputDir is an existing directory, join with original name
        if (fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory()) {
            outputPath = path.join(outputDir, originalName);
        } else {
            // Otherwise, treat outputDir as the desired full file path
            outputPath = outputDir;
        }

        const headerSize = 12 + nameLen;

        fs.closeSync(fd);

        console.log(`Unpacking ${inputPath} to ${outputPath} (Original Size: ${originalSize} bytes)...`);

        const inputStream = fs.createReadStream(inputPath, { start: headerSize });
        const outputStream = fs.createWriteStream(outputPath);

        let writtenBytes = 0;

        for await (const chunk of inputStream) {
            let bytesToWrite = chunk.length;

            if (writtenBytes + bytesToWrite > originalSize) {
                bytesToWrite = originalSize - writtenBytes;
            }

            if (bytesToWrite > 0) {
                outputStream.write(chunk.slice(0, bytesToWrite));
                writtenBytes += bytesToWrite;
            }

            if (writtenBytes >= originalSize) {
                break;
            }
        }

        outputStream.end();
        console.log('Unpacking complete.');

    } catch (error) {
        logError(`Unpack Error: ${error.message}`);
    }
}

// CLI Handling
const args = process.argv.slice(2);
const command = args[0];

if (command === 'pack') {
    const input = args[1];
    const output = args[2] || 'output.dna';
    pack(input, output);
} else if (command === 'unpack') {
    const input = args[1];
    const output = args[2] || '.';
    unpack(input, output);
} else if (command === 'read') {
    // Jump-to-Read test command
    const input = args[1];
    const index = parseInt(args[2]);
    if (isNaN(index)) {
        console.error('Please provide a valid unit index.');
        process.exit(1);
    }

    // We need to find header size first
    const fd = fs.openSync(input, 'r');
    const nameLenBuf = Buffer.alloc(1);
    fs.readSync(fd, nameLenBuf, 0, 1, 11);
    const nameLen = nameLenBuf[0];
    const headerSize = 12 + nameLen;
    fs.closeSync(fd);

    storage.jumpToRead(input, index, headerSize)
        .then(buf => {
            const geom = geometry.bufferToGeometry(buf);
            console.log(`Unit ${index}:`, geom);
        })
        .catch(err => logError(`Read Error: ${err.message}`));
} else {
    console.log('Usage:');
    console.log('  node app.js pack <input> <output>');
    console.log('  node app.js unpack <input> <output_dir>');
    console.log('  node app.js read <dna_file> <index>');
}
