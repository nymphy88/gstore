const config = require('../config.json');

/**
 * Pure function to convert a 7-byte buffer into a geometry object.
 * 4 bytes for x (Int32), 3 bytes for RGB.
 * @param {Buffer} buffer - 7-byte buffer
 * @returns {Object} { x, r, g, b }
 */
function bufferToGeometry(buffer) {
    if (buffer.length !== 7) {
        throw new Error('Buffer must be exactly 7 bytes');
    }

    // 4-byte Scaled Integer (x)
    const x = buffer.readInt32LE(0);

    // 3-byte RGB
    const r = buffer[4];
    const g = buffer[5];
    const b = buffer[6];

    return { x, r, g, b };
}

/**
 * Pure function to convert a geometry object back to a 7-byte buffer.
 * @param {Object} geom - { x, r, g, b }
 * @returns {Buffer} 7-byte buffer
 */
function geometryToBuffer(geom) {
    const buffer = Buffer.alloc(7);

    buffer.writeInt32LE(geom.x, 0);
    buffer[4] = geom.r;
    buffer[5] = geom.g;
    buffer[6] = geom.b;

    return buffer;
}

/**
 * Placeholder for future logic (e.g., scaling with multiplier).
 * Currently returns the value as-is for bit-perfect restoration.
 * @param {number} value
 * @returns {number}
 */
function applyGeometryLogic(value) {
    // future: return value * config.multiplier;
    return value;
}

/**
 * Placeholder for future inverse logic.
 * @param {number} value
 * @returns {number}
 */
function reverseGeometryLogic(value) {
    // future: return value / config.multiplier;
    return value;
}

module.exports = {
    bufferToGeometry,
    geometryToBuffer,
    applyGeometryLogic,
    reverseGeometryLogic
};
