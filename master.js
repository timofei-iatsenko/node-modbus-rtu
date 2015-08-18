var crc = require('crc');
var BufferPut = require('bufferput');
var Q = require('q');
var SerialHelper = require('./serial-helper');
var constants = require('./constants');
var binary = require('binary');
var bufferEqual = require('buffer-equal');
var _ = require('lodash');
var errors = require('./errors');

module.exports = Master;

function Master(serialPort, onReady) {
    var self = this;
    this.serial = new SerialHelper(serialPort, function(){
        onReady(self);
    });
}

/**
 * Modbus function read holding registers
 * @param slave
 * @param start
 * @param length
 * @returns {promise}
 */
Master.prototype.readHoldingRegisters = function (slave, start, length) {
    var packet = this.createFixedPacket(slave, constants.FUNCTION_CODES.READ_HOLDING_REGISTERS, start, length);

    return this.request(packet)
        .then(function (buffer) {
            var data = binary.parse(buffer.slice(2, buffer.length - 2)); //slice header and crc
            var results = [];

            data.word8('byteCount').tap(function (val) {
                this.buffer('value', val.byteCount).tap(function () {
                    for (var i = 0; i < val.byteCount; i += 2) {
                        results.push(val.value.readInt16BE(i));
                    }
                });
            })

            return results;
        });
}

Master.prototype.writeSingleRegister = function (slave, register, value) {
    var packet = this.createFixedPacket(slave, constants.FUNCTION_CODES.WRITE_SINGLE_REGISTER, register, value);
    return this.request(packet);
}

Master.prototype.writeMultipleRegisters = function(slave, start, array){
    var packet = this.createVariousPacket(slave, constants.FUNCTION_CODES.WRITE_MULTIPLE_REGISTERS, start, array);
    return this.request(packet);
}

/**
 * Create modbus packet with fixed length
 * @param slave
 * @param func
 * @param param
 * @param param2
 * @returns {*}
 */
Master.prototype.createFixedPacket = function(slave, func, param, param2){
   return (new BufferPut())
        .word8be(slave)
        .word8be(func)
        .word16be(param)
        .word16be(param2)
        .buffer();
}

/**
 * Create modbus packet with various length
 * @param slave
 * @param func
 * @param start
 * @param array
 */
Master.prototype.createVariousPacket = function(slave, func, start, array){
    var buf = (new BufferPut())
        .word8be(slave)
        .word8be(func)
        .word16be(start)
        .word16be(array.length)
        .word8be(array.length*2);

    _.forEach(array, function(value){
        buf.word16be(value);
    })

    return buf.buffer();
}

Master.prototype.request = function request(buffer) {
    var self = this;

    return this.serial.write(this.addCrc(buffer))
        .then(function (response) {
            if (!self.checkCrc(response))
                throw new errors.crc;
            return response;
        })
}

Master.prototype.addCrc = function (buffer) {
    return (new BufferPut())
        .put(buffer)
        .word16le(crc.crc16modbus(buffer))
        .buffer();
}

Master.prototype.validateRequest = function (buffer, slave, func) {
    var vars = binary.parse(buffer)
        .word8be('slave')
        .word8be('func')
        .vars;

    return vars.slave == slave && vars.func == func;
}

Master.prototype.checkCrc = function (buffer){
    var pdu = buffer.slice(0, buffer.length-2);
    return bufferEqual(buffer, this.addCrc(pdu));
};

