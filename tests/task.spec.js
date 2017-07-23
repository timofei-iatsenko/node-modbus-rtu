import test from './tape';
import { Task } from '../src/task';

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

function testMessageHandling(t, payload, input, msg) {
    const task = new Task(new Buffer(payload, 'hex'));

    for (let i = 0; i < input.length; i += 2) {
        setTimeout(() => {
            task.receiveData(new Buffer(input.slice(i, i + 2), 'hex'), (response) => {
                t.equal(response.toString('hex'), msg);
                t.end();
            });
        });
    }
}

test('should return a valid Modbus RTU message', (t) => {
    const msg = '110306ae415652434049ad';
    testMessageHandling(t, '1103006B00037687', msg, msg);
});

test('should return a valid Modbus RTU exception', (t) => {
    const msg = '1183044136';
    testMessageHandling(t, '1103006B00037687', msg, msg);
});

test('Special data package, should return a valid Modbus RTU message', (t) => {
    const msg = '010380018301830183018301830183018301830183018301830183018301830' +
        '1830183018301830183018301830183018301830183018301830183018301830183018301830183' +
        '0183018301830183018301830183018301830183018301830183018301830183018301830183018' +
        '3018301830183018301830183018301830183018346e0';
    testMessageHandling(t, '010300000040443A', msg, msg);
});

test('Illegal start chars, should return a valid Modbus RTU message', (t) => {
    const illegalChars = '205454ff';
    const msg = '110306ae415652434049ad';
    testMessageHandling(t, '1103006B00037687', illegalChars + msg, msg);
});

test('Illegal end chars, should return a valid Modbus RTU message', (t) => {
    const illegalChars = '205454ff';
    const msg = '110306ae415652434049ad';
    testMessageHandling(t, '1103006B00037687', msg + illegalChars, msg);
});