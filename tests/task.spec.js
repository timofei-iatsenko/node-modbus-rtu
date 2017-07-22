'use strict';

const test = require('./tape');
const Task = require('../task').Task;

test('Test deferred api', (t) => {
    const samplePayload = new Buffer('01 03 06 AE41 5652 4340 49AD'.replace(/\s/g, ''), 'hex');
    const expectedData = [22, 23, 24];

    const resolvedTask = new Task(samplePayload);
    resolvedTask.promise.then((data) => {
        t.equal(data, expectedData, 'Should allow resolve promise with value');
    });
    resolvedTask.resolve(expectedData);

    const rejectedTask = new Task(samplePayload);
    rejectedTask.promise.catch((data) => {
        t.equal(data, expectedData, 'Should allow reject promise with value');
    });
    rejectedTask.reject(expectedData);

    t.plan(2);
});

test('should return a valid Modbus RTU message', (t) => {
    const task = new Task(new Buffer('1103006B00037687', 'hex'));

    const responses = [
        new Buffer('11', 'hex'),
        new Buffer('03', 'hex'),
        new Buffer('06', 'hex'),
        new Buffer('ae', 'hex'),
        new Buffer('41', 'hex'),
        new Buffer('56', 'hex'),
        new Buffer('52', 'hex'),
        new Buffer('43', 'hex'),
        new Buffer('40', 'hex'),
        new Buffer('49', 'hex'),
        new Buffer('ad', 'hex'),
    ];

    responses.forEach((chunk) => {
        setTimeout(() => {
            task.receiveData(chunk, (response) => {
                t.equal(response.toString('hex'), '110306ae415652434049ad');
                t.end();
            });
        });
    });
});

//describe('data handler', function () {
//    it('should return a valid Modbus RTU message', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal('110306ae415652434049ad');
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('1103006B00037687', 'hex'));
//            setTimeout(function () {
//                port._client.receive(new Buffer('11', 'hex'));
//                port._client.receive(new Buffer('03', 'hex'));
//                port._client.receive(new Buffer('06', 'hex'));
//                port._client.receive(new Buffer('ae', 'hex'));
//                port._client.receive(new Buffer('41', 'hex'));
//                port._client.receive(new Buffer('56', 'hex'));
//                port._client.receive(new Buffer('52', 'hex'));
//                port._client.receive(new Buffer('43', 'hex'));
//                port._client.receive(new Buffer('40', 'hex'));
//                port._client.receive(new Buffer('49', 'hex'));
//                port._client.receive(new Buffer('ad', 'hex'));
//            });
//        });
//    });
//
//    it('should return a valid Modbus RTU exception', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal('1183044136');
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('1103006B00037687', 'hex'));
//            setTimeout(function () {
//                port._client.receive(new Buffer('11', 'hex'));
//                port._client.receive(new Buffer('83', 'hex'));
//                port._client.receive(new Buffer('04', 'hex'));
//                port._client.receive(new Buffer('41', 'hex'));
//                port._client.receive(new Buffer('36', 'hex'));
//            });
//        });
//    });
//
//    it('Special data package, should return a valid Modbus RTU message', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal(LONG_MSG);
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('010300000040443A', 'hex'));
//            setTimeout(function () {
//                for (let i = 0; i < LONG_MSG.length; i += 2) {
//                    port._client.receive(new Buffer(LONG_MSG.slice(i, i + 2), 'hex'));
//                }
//            });
//        });
//    });
//
//    it('Illegal start chars, should synchronize to valid Modbus RTU message', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal('110306ae415652434049ad');
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('1103006B00037687', 'hex'));
//            setTimeout(function () {
//                port._client.receive(new Buffer('20', 'hex')); // illegal char
//                port._client.receive(new Buffer('54', 'hex')); // illegal char
//                port._client.receive(new Buffer('54', 'hex')); // illegal char
//                port._client.receive(new Buffer('ff', 'hex')); // illegal char
//                port._client.receive(new Buffer('11', 'hex'));
//                port._client.receive(new Buffer('03', 'hex'));
//                port._client.receive(new Buffer('06', 'hex'));
//                port._client.receive(new Buffer('ae', 'hex'));
//                port._client.receive(new Buffer('41', 'hex'));
//                port._client.receive(new Buffer('56', 'hex'));
//                port._client.receive(new Buffer('52', 'hex'));
//                port._client.receive(new Buffer('43', 'hex'));
//                port._client.receive(new Buffer('40', 'hex'));
//                port._client.receive(new Buffer('49', 'hex'));
//                port._client.receive(new Buffer('ad', 'hex'));
//            });
//        });
//    });
//
//    it('Illegal end chars, should return a valid Modbus RTU message', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal('110306ae415652434049ad');
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('1103006B00037687', 'hex'));
//            setTimeout(function () {
//                port._client.receive(new Buffer('11', 'hex'));
//                port._client.receive(new Buffer('03', 'hex'));
//                port._client.receive(new Buffer('06', 'hex'));
//                port._client.receive(new Buffer('ae', 'hex'));
//                port._client.receive(new Buffer('41', 'hex'));
//                port._client.receive(new Buffer('56', 'hex'));
//                port._client.receive(new Buffer('52', 'hex'));
//                port._client.receive(new Buffer('43', 'hex'));
//                port._client.receive(new Buffer('40', 'hex'));
//                port._client.receive(new Buffer('49', 'hex'));
//                port._client.receive(new Buffer('ad', 'hex'));
//                port._client.receive(new Buffer('20', 'hex')); // illegal char
//                port._client.receive(new Buffer('54', 'hex')); // illegal char
//                port._client.receive(new Buffer('54', 'hex')); // illegal char
//                port._client.receive(new Buffer('ff', 'hex')); // illegal char
//            });
//        });
//    });
//
//    it('should return a valid Modbus RTU message on illegal chars', function (done) {
//        port.once('data', function (data) {
//            expect(data.toString('hex')).to.equal('110306ae415652434049ad');
//            done();
//        });
//        port.open(function () {
//            port.write(new Buffer('1103006B00037687', 'hex'));
//            setTimeout(function () {
//                port._client.receive(new Buffer('11', 'hex'));
//                port._client.receive(new Buffer('03', 'hex'));
//                port._client.receive(new Buffer('06', 'hex'));
//                port._client.receive(new Buffer('ae', 'hex'));
//                port._client.receive(new Buffer('41', 'hex'));
//                port._client.receive(new Buffer('56', 'hex'));
//                port._client.receive(new Buffer('52', 'hex'));
//                port._client.receive(new Buffer('43', 'hex'));
//                port._client.receive(new Buffer('40', 'hex'));
//                port._client.receive(new Buffer('49', 'hex'));
//                port._client.receive(new Buffer('ad', 'hex'));
//            });
//        });
//    });
//});