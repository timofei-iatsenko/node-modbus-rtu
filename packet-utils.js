var crc = require('crc');
var BufferPut = require('bufferput');

const DATA_TYPES = {
    INT: 1,
    UINT: 2,
    ASCII: 3,
};

module.exports = {
    DATA_TYPES: DATA_TYPES,

    /**
     * Slice header, bytes count and crc. Return buffer only with data
     * @param {Buffer} buffer
     */
    getDataBuffer: function(buffer) {
        return buffer.slice(3, buffer.length - 2);
    },

    /**
     * Parse function 03 response packet (read holding registers)
     * @param {Buffer} buffer
     * @param {number?} dataType
     * @returns {number[]}
     */
    parseFc03Packet: function(buffer, dataType) {
        var results = [];

        for (var i = 0; i < buffer.length; i += 2) {
            results.push(readDataFromBuffer(buffer, i, dataType));
        }

        return results;
    },

    /**
     * Returns new buffer signed with CRC
     * @param {Buffer} buf
     * @returns {Buffer}
     */
    addCrc: function(buf) {
        return (new BufferPut())
            .put(buf)
            .word16le(crc.crc16modbus(buf))
            .buffer();
    },

    /**
     *
     * @param {Buffer} buffer
     * @returns boolean
     */
    checkCrc: function(buffer) {
        var pdu = buffer.slice(0, buffer.length - 2);
        return buffer.equals(this.addCrc(pdu));
    }
};

/**
 *
 * @param {Buffer} buffer
 * @param {int} offset
 * @param {int} dataType
 * @returns {number | string}
 */
function readDataFromBuffer(buffer, offset, dataType) {
    switch (dataType) {
        case DATA_TYPES.UINT:
            return buffer.readUInt16BE(offset);
        case DATA_TYPES.ASCII:
            return buffer.toString('ascii', offset, offset + 2);
        default:
            return buffer.readInt16BE(offset);
    }
}