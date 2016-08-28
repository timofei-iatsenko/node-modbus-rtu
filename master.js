var crc = require('crc');
var BufferPut = require('bufferput');
var Promise = require("bluebird");
var SerialHelper = require('./serial-helper');
var constants = require('./constants');
var _ = require('lodash');
var errors = require('./errors');
var packetUtils = require('./packet-utils');

module.exports = Master;
module.exports.DATA_TYPES = packetUtils.DATA_TYPES;

function Master(serialPort, options) {
    serialPort.on('error', function(err) {
        console.error(err);
    });

    this._options =  _.defaults(options || {}, {
      responseTimeout: constants.RESPONSE_TIMEOUT,
      queueTimeout: constants.QUEUE_TIMEOUT,
      endPacketTimeout: constants.END_PACKET_TIMEOUT,
    });

    this.serial = new SerialHelper(serialPort, this._options);
}

/**
 * Modbus function read holding registers
 * @param {number} slave
 * @param {number} start
 * @param {number} length
 * @param {number | function?} dataType value from DATA_TYPES const or callback
 * @returns {Promise<number[]>}
 */
Master.prototype.readHoldingRegisters = function(slave, start, length, dataType) {
    var packet = this.createFixedPacket(slave, constants.FUNCTION_CODES.READ_HOLDING_REGISTERS, start, length);

    return this.request(packet).then(function(buffer) {
        var buf = packetUtils.getDataBuffer(buffer);

        if (_.isFunction(dataType)) {
            return dataType(buf);
        }

        return packetUtils.parseFc03Packet(buf, dataType);
    });
};

/**
 *
 * @param {number} slave
 * @param {number} register
 * @param {number} value
 * @param {number} retryCount
 */
Master.prototype.writeSingleRegister = function (slave, register, value, retryCount) {
    var packet = this.createFixedPacket(slave, constants.FUNCTION_CODES.WRITE_SINGLE_REGISTER, register, value);
    var self = this;
    retryCount = retryCount ? retryCount : constants.DEFAULT_RETRY_COUNT;

    var performRequest = function (retry) {
        return new Promise(function (resolve, reject) {
            var funcName = 'writeSingleRegister: ';
            var funcId  = ' Slave '+slave+'; ' +
                'Register: '+register+'; Value: '+value+';  Retry ' + (retryCount + 1 - retry) + ' of ' + retryCount;

            if (retry <= 0) {
                throw new errors.retryLimit(funcId);
            }

            self._options.debug &&
            console.log(funcName + 'perform request.' + funcId);

            self.request(packet)
                .then(resolve)
                .catch(function (err) {
                    self._options.debug && console.log(funcName + err  + funcId);

                    return performRequest(--retry)
                        .then(resolve)
                        .catch(reject);
                });
        });
    };
    return performRequest(retryCount);
};

/**
 *
 * @param {number} slave
 * @param {number} start
 * @param {number[]} array
 */
Master.prototype.writeMultipleRegisters = function(slave, start, array){
    var packet = this.createVariousPacket(slave, constants.FUNCTION_CODES.WRITE_MULTIPLE_REGISTERS, start, array);
    return this.request(packet);
};

/**
 * Create modbus packet with fixed length
 * @param slave
 * @param func
 * @param param
 * @param param2
 * @private
 * @returns {*}
 */
Master.prototype.createFixedPacket = function(slave, func, param, param2){
   return (new BufferPut())
        .word8be(slave)
        .word8be(func)
        .word16be(param)
        .word16be(param2)
        .buffer();
};

/**
 * Create modbus packet with various length
 * @param slave
 * @param func
 * @param start
 * @param array
 * @private
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
    });

    return buf.buffer();
};

/**
 * @private
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
Master.prototype.request = function request(buffer) {
    var self = this;

    return this.serial.write(packetUtils.addCrc(buffer))
        .then(function (response) {
            if (!packetUtils.checkCrc(response))
                throw new errors.crc;
            return response;
        })
};

