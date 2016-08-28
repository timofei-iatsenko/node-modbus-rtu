module.exports = {
    crc: ModbusCrcError,
    abort: ModbusAborted,
    retryLimit: ModbusRetryLimitExceed,
};

function ModbusCrcError() {
    this.message = "Received Modbus response get invalid CRC";
    this.name = "ModbusCrcError";
    Error.captureStackTrace(this, ModbusCrcError);
}

ModbusCrcError.prototype = Object.create(Error.prototype);
ModbusCrcError.prototype.constructor = ModbusCrcError;


function ModbusAborted() {
  this.message = "Aborted";
  this.name = "ModbusAborted";
  Error.captureStackTrace(this, ModbusAborted);
}

ModbusAborted.prototype = Object.create(Error.prototype);
ModbusAborted.prototype.constructor = ModbusAborted;

function ModbusRetryLimitExceed(add) {
    this.message = "Retry limit exceed " + add;
    this.name = "ModbusRetryLimitExceed";
    Error.captureStackTrace(this, ModbusRetryLimitExceed);
}

ModbusRetryLimitExceed.prototype = Object.create(Error.prototype);
ModbusRetryLimitExceed.prototype.constructor = ModbusRetryLimitExceed;