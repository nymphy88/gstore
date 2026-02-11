const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Check if there is enough disk space.
 * Required: at least twice the size of input file.
 * @param {string} directory - Directory to check
 * @param {number} requiredBytes - Bytes needed
 * @returns {Promise<boolean>}
 */
async function hasEnoughSpace(directory, requiredBytes) {
    try {
        // Use df -k to get available space in 1K blocks
        const { stdout } = await exec(`df -k "${directory}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        // On most systems, Available is the 4th column (index 3)
        // Filesystem 1K-blocks Used Available Use% Mounted
        const availableKB = parseInt(parts[3]);

        if (isNaN(availableKB)) {
            return true; // Fallback
        }

        const availableBytes = availableKB * 1024;
        return availableBytes > requiredBytes;
    } catch (error) {
        console.error('Disk check failed, proceeding with caution:', error.message);
        return true;
    }
}

/**
 * Jump-to-Read: Read a specific 7-byte unit by index.
 * @param {string} filePath
 * @param {number} index - The unit index (0-based)
 * @param {number} headerOffset - Offset where data starts after header
 * @returns {Promise<Buffer>}
 */
async function jumpToRead(filePath, index, headerOffset) {
    const unitSize = 7;
    const position = headerOffset + (index * unitSize);
    const buffer = Buffer.alloc(unitSize);

    return new Promise((resolve, reject) => {
        fs.open(filePath, 'r', (err, fd) => {
            if (err) return reject(err);
            fs.read(fd, buffer, 0, unitSize, position, (err, bytesRead) => {
                fs.close(fd, () => {});
                if (err) return reject(err);
                if (bytesRead < unitSize) return reject(new Error('Reached EOF or incomplete unit'));
                resolve(buffer);
            });
        });
    });
}

module.exports = {
    hasEnoughSpace,
    jumpToRead
};
