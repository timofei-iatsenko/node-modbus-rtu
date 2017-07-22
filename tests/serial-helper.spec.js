const test = require('./tape');
const sinon = require('sinon');
const SerialHelper = require('../serial-helper').SerialHelper;
const ModbusResponseTimeout = require('../errors').ModbusResponseTimeout;
const noop = require('lodash/noop');
const EventEmitter = require('events').EventEmitter;

const serialPort = Object.assign(new EventEmitter(), {
    write: noop,
});

const options = {
    responseTimeout: 50,
    queueTimeout: 0,
};

const samplePayload = new Buffer('11 03 00 6B 00 03 76 87'.replace(/\s/g, ''), 'hex');

test('Should resolve promise with valid message', (t) => {
    const helper = new SerialHelper(serialPort, options);
    const msg = '11 03 06 AE 41 56 52 43 40 49 AD'.replace(/\s/g, '');

    serialPort.emit('open');

    helper.write(samplePayload).then((response) => {
        t.equal(response.toString('hex').toUpperCase(), msg);
        helper.queue.stop();
    });

    for (let i = 0; i < msg.length; i += 2) {
        setTimeout(() => {
            serialPort.emit('data', new Buffer(msg.slice(i, i + 2), 'hex'));
        });
    }

    t.plan(1);
});

test('Should reject promise if timeout exceed', (t) => {
    const clock = sinon.useFakeTimers();
    const helper = new SerialHelper(serialPort, options);

    serialPort.emit('open');

    helper.write(samplePayload).catch((err) => {
        t.equal(err.constructor, ModbusResponseTimeout, 'Error should be a proper type');
    });

    clock.tick(60);
    helper.queue.stop();

    clock.tick(60);
    clock.restore();

    t.plan(1);
});

