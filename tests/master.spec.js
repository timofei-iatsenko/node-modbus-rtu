'use strict';

const test = require('./tape');
const sinon = require('sinon');
const Promise = require('bluebird');
const _ = require('lodash');
const Master = require('../master');

const serialPort = {
    on: _.noop
};

test('Read holding registers', (t) => {
    const master = new Master(serialPort);

    master.request = function() {
        return new Promise((resolve) => {
            resolve(new Buffer('01 03 06 AE41 5652 4340 49AD'.replace(/\s/g, ''), 'hex'))
        })
    };


    master.readHoldingRegisters(1, 0, 3).then((data) => {
        t.equals(data.length, 3, 'If no callback passed, standard parser applied')
    });

    master.readHoldingRegisters(1, 0, 3, (buffer) => {
       return buffer.readUInt32BE(0);
    }).then((bigNumber) => {
        t.equals(bigNumber, 2923517522, 'If callback passed, callback used for parsing buffer')
    });

    master.readHoldingRegisters(1, 0, 3, Master.DATA_TYPES.UINT).then((results) => {
        t.equals(results[0], 44609, 'If data type passed, it should be used in buffer parser')
    });

    t.plan(3);
});

test('Should create valid request packet', (t) => {
    const master = new Master(serialPort);

    master.request = function(requestPacket) {
        t.ok(requestPacket.equals(new Buffer('01 03 00 00 00 03'.replace(/\s/g, ''), 'hex')), 'Request packet is valid');

        return new Promise((resolve) => {
            resolve(new Buffer(0))
        })
    };

    master.readHoldingRegisters(1, 0, 3);

    t.end();
});

test('Write single register should retry if error, and throw Error if limit exceed', (t) => {
    const master = new Master(serialPort);
    const RETRY_LIMIT = 2;
    let i = 0;
    master.request = function() {
        i++;

        return new Promise((resolve, reject) => {
            reject();
        })
    };

    master.writeSingleRegister(1, 0, 3, RETRY_LIMIT).catch((err) => {
        t.equals(i, RETRY_LIMIT, 'Actual count of retries is correct');
        t.equals(err.name, 'ModbusRetryLimitExceed', 'Throwed Error has correct type');
    });

    t.plan(2);
});

test('Write single register should resolve promise if success', (t) => {
    const master = new Master(serialPort);
    const RETRY_LIMIT = 2;
    let i = 0;

    master.request = function() {
        i++;

        return new Promise((resolve, reject) => {
            i === 1 ? reject() : resolve(); //resolve after second retry
        })
    };

    master.writeSingleRegister(1, 0, 3, RETRY_LIMIT).then(() => {
        t.ok(true, 'Success handler is called');
        t.equals(i, 2, 'Actual count of retries is correct');
    });

    t.plan(2);
});