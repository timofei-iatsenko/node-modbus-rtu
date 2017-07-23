const BufferPut = require('bufferput');
const Promise = require('bluebird');
const SerialHelperFactory = require('./serial-helper').SerialHelperFactory;
const Logger = require('./logger').Logger;

const {
    FUNCTION_CODES,
    RESPONSE_TIMEOUT,
    QUEUE_TIMEOUT,
    DEFAULT_RETRY_COUNT,
} = require('./constants');

const errors = require('./errors');
const packetUtils = require('./packet-utils');

class ModbusMaster {
    constructor(serialPort, options) {
        serialPort.on('error', (err) => {
            console.error(err);
        });

        this._options = Object.assign({}, {
            responseTimeout: RESPONSE_TIMEOUT,
            queueTimeout: QUEUE_TIMEOUT,
        }, options || {});

        this.logger = new Logger(this._options);
        this.serial = SerialHelperFactory.create(serialPort, this._options);
    }

    /**
     * Modbus function read holding registers
     * @param {number} slave
     * @param {number} start
     * @param {number} length
     * @param {number | function} [dataType] value from DATA_TYPES const or callback
     * @returns {Promise<number[]>}
     */
    readHoldingRegisters(slave, start, length, dataType) {
        const packet = this.createFixedPacket(slave, FUNCTION_CODES.READ_HOLDING_REGISTERS, start, length);

        return this.request(packet).then((buffer) => {
            const buf = packetUtils.getDataBuffer(buffer);

            if (typeof (dataType) === 'function') {
                return dataType(buf);
            }

            return packetUtils.parseFc03Packet(buf, dataType);
        });
    }

    /**
     *
     * @param {number} slave
     * @param {number} register
     * @param {number} value
     * @param {number} [retryCount]
     */
    writeSingleRegister(slave, register, value, retryCount) {
        const packet = this.createFixedPacket(slave, FUNCTION_CODES.WRITE_SINGLE_REGISTER, register, value);
        retryCount = retryCount || DEFAULT_RETRY_COUNT;

        const performRequest = (retry) => {
            return new Promise((resolve, reject) => {
                const funcName = 'writeSingleRegister: ';
                const funcId =
                    `Slave ${slave}; Register: ${register}; Value: ${value};` +
                    `Retry ${retryCount + 1 - retry} of ${retryCount}`;

                if (retry <= 0) {
                    throw new errors.ModbusRetryLimitExceed(funcId);
                }

                this.logger.info(funcName + 'perform request.' + funcId);

                this.request(packet)
                    .then(resolve)
                    .catch((err) => {
                        this.logger.info(funcName + err + funcId);

                        return performRequest(--retry)
                            .then(resolve)
                            .catch(reject);
                    });
            });
        };
        return performRequest(retryCount);
    }

    /**
     *
     * @param {number} slave
     * @param {number} start
     * @param {number[]} array
     */
    writeMultipleRegisters(slave, start, array) {
        const packet = this.createVariousPacket(slave, FUNCTION_CODES.WRITE_MULTIPLE_REGISTERS, start, array);
        return this.request(packet);
    }

    /**
     * Create modbus packet with fixed length
     * @private
     * @param {number} slave
     * @param {number} func
     * @param {number} param
     * @param {number} param2
     * @returns {Buffer}
     */
    createFixedPacket(slave, func, param, param2) {
        return (new BufferPut())
            .word8be(slave)
            .word8be(func)
            .word16be(param)
            .word16be(param2)
            .buffer();
    }

    /**
     * Create modbus packet with various length
     * @private
     * @param {number} slave
     * @param {number} func
     * @param {number} start
     * @param {number[]} array
     * @returns {Buffer}
     */
    createVariousPacket(slave, func, start, array) {
        const buf = (new BufferPut())
            .word8be(slave)
            .word8be(func)
            .word16be(start)
            .word16be(array.length)
            .word8be(array.length * 2);

        array.forEach((value) => buf.word16be(value));

        return buf.buffer();
    }

    /**
     * @private
     * @param {Buffer} buffer
     * @returns {Promise<Buffer>}
     */
    request(buffer) {
        return this.serial.write(packetUtils.addCrc(buffer))
            .then((response) => {
                if (!packetUtils.checkCrc(response)) {
                    throw new errors.ModbusCrcError();
                }
                return response;
            });
    }
}

module.exports = {
    ModbusMaster,
};