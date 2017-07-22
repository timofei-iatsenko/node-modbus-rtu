const SerialPort = require('serialport').SerialPort;
const modbus = require('modbus-rtu');
const Promise = require('bluebird');

// Polling data from slaves in loop.
//
// Polling slaves is quite often usage of modbus protocol. Assume you develop a real-time app which show a temperature from thermostats.
// For this app you need to poll all thermostats in loop, and update Ui when temperature changed.
//
// When polling in loop you have to wait response of all yours request, otherwise pause between loop will be not work.
//
// Check also [slave-model] example to see how make this code better and more fun.

// create serial port with params. Refer to node-serialport for documentation
const serialPort = new SerialPort('/dev/ttyUSB0', {
    baudrate: 2400,
});

new modbus.Master(serialPort, function (master) {
    // Create an array for promises
    const promises = [];

    (function loop() {
        // Push all returned promises into array

        // Read from slave 1
        promises.push(master.readHoldingRegisters(1, 0, 4).then(function (data) {
            console.log('slave 1', data);
        }));

        // Read from slave 2
        promises.push(master.readHoldingRegisters(2, 0, 4).then(function (data) {
            console.log('slave 2', data);
        }));

        // Read from slave 3
        promises.push(master.readHoldingRegisters(3, 0, 4).then(function (data) {
            console.log('slave 3', data);
        }));

        // Wait while all requests finished, and then restart loop() with 300ms timeout.
        Promise.all(promises).catch(function (err) {
            console.log(err); // catch all errors
        }).finally(function () {
            setTimeout(loop, 300);
        });
    })();
});

new modbus.Master(new SerialPort('/dev/ttyUSB0', {
    baudrate: 2400,
}));