/**
 * Created by 1 on 18.08.2015.
 */
module.exports = {
    crc: ModbusCrcError,
    abort: ModbusAborted,
};

function ModbusCrcError() {
    this.message = "Received Modbus response get invalid CRC";
    this.name = "ModbusCrcError";
    Error.captureStackTrace(this, ModbusCrcError);
}

ModbusCrcError.prototype = Object.create(Error.prototype);
ModbusCrcError.prototype.constructor = ModbusCrcError


function ModbusAborted() {
  this.message = "Aborted";
  this.name = "ModbusAborted";
  Error.captureStackTrace(this, ModbusAborted);
}

ModbusAborted.prototype = Object.create(Error.prototype);
ModbusAborted.prototype.constructor = ModbusAborted
