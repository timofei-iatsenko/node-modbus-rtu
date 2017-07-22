class ModbusCrcError extends Error {
    constructor() {
        super();

        this.message = 'Received Modbus response get invalid CRC';
        this.name = 'ModbusCrcError';
        Error.captureStackTrace(this, ModbusCrcError);
    }
}

class ModbusAborted extends Error {
    constructor() {
        super();
        this.message = 'Aborted';
        this.name = 'ModbusAborted';
        Error.captureStackTrace(this, ModbusAborted);
    }
}

class ModbusRetryLimitExceed extends Error {
    constructor(add) {
        super();
        this.message = 'Retry limit exceed ' + add;
        this.name = 'ModbusRetryLimitExceed';
        Error.captureStackTrace(this, ModbusRetryLimitExceed);
    }
}

class ModbusResponseTimeout extends Error {
    constructor(time) {
        super();
        this.message = `Response timeout of ${time}ms exceed!`;
        this.name = 'ModbusResponseTimeout';
        Error.captureStackTrace(this, ModbusResponseTimeout);
    }
}

module.exports = {
    ModbusCrcError,
    ModbusAborted,
    ModbusRetryLimitExceed,
    ModbusResponseTimeout,
};