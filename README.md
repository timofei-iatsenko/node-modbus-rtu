# node-modbus-rtu
Pure NodeJS implementation of ModbusRTU protocol
using [node-serialport](https://github.com/voodootikigod/node-serialport) and [Bluebird promises](https://github.com/petkaantonov/bluebird)

## Implementation notes
This library implement ONLY **ModbusRTU Master** and only most important features:
 * **03** Read Holding Registers
 * **06** Write Single Register
 * **16** Write Multiple Registers

Coil functions (readCoils, writeCoils) is not implemented yet. But you can fork and add this.

## Installation
The simplest way, install via npm.

Add to `packages.json` 2 dependencies:

```js
  "dependencies": {
    //...
    "modbus-rtu" : "*",
    "serialport" : "*",
    //...
   }
```

Then run `npm i`.

## Benefits
1. **Queue**. Thst is a killer-feature of this library. Behind the scene it use a simple queue.
All request what you do stack to this queue and execute only if previous was finished.
It means that using this library you can write to modbus without waiting a response of previously command.
That make you code much cleaner and decoupled. See examples below.

2. **Promises** Promises is a great pattern for the last time. Promises make async code more clean and readable.
All communication functions return promises, so you can easily process data or catch exceptions.

## Examples

### The basic example
```js
var SerialPort = require('serialport').SerialPort;
var modbus = require('modbus-rtu');

//create serail port with params. Refer to node-serialport for documentation
var serialPort = new SerialPort("/dev/ttyUSB0", {
   baudrate: 2400
});

//create ModbusMaster instance and pass the serial port object
var master = new modbus.Master(serialPort);

//Read from slave with address 1 four holding registers starting from 0.
master.readHoldingRegisters(1, 0, 4).then(function(data){
    //promise will be fulfilled with parsed data
    console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
}, function(err){
    //or will be rejected with error
})

//Write to first slave into second register value 150.
//slave, register, value
master.writeSingleRegister(1, 2, 150).then(success, error);
```

### Queueing

Queue turn this:

```js
//  requests
master.readHoldingRegisters(1, 0, 4).then(function(data) {
    console.log(data);

    master.readHoldingRegisters(2, 0, 4).then(function(data) {
        console.log(data);

        master.readHoldingRegisters(2, 0, 4).then(function(data) {
            console.log(data);

            master.readHoldingRegisters(2, 0, 4).then(function(data) {
                console.log(data);
            })
        })
    })
})
```

Into this:

```js
master.readHoldingRegisters(1, 0, 4).then(function(data){
    console.log(data);
})
master.readHoldingRegisters(2, 0, 4).then(function(data){
    console.log(data);
})
master.readHoldingRegisters(3, 0, 4).then(function(data){
    console.log(data);
})
master.readHoldingRegisters(4, 0, 4).then(function(data){
    console.log(data);
})
```

This makes possible to write code in synchronous style.

Check more examples in `/examples` folder in repository.

## How it works

Communicating via serial port is sequential. It means you can't write few requests and then read few responses.

You have to write request then wait response and then writing another request, one by one.

The first problem is, if we call functions in script in synchronous style (one by one without callbacks),
they will write to port immediately. As result response from slaves will returns unordered and we receive trash.


To deal with this problem all request put to the queue, instead of directly writing to port and promise is returned.
When the queue start to process entire request it add timeout to promise.
If result will not received in `constants.RESPONSE_TIMEOUT`, worker throw Timeout error for this promise.

The second problem is SerialPort receive data randomly. That means it can receive 2 bytes per tick or 4 or more.
So we have to buffer all serial port data, and detect the end of Modbus packet.

Modbus use a timeout as end of packet. So we have to collect buffer until pause between data chunks reaches expected value.
Unfortunately it is impossible to set end of packet timeout in accordance to standard.
So you need to tune this parameter for you system by himself

If you set **too small timeout** worker will incorrect collect buffers and you will often receive CRC error.

If you set **too big timeout** communication will be very slow.


## How to set timeouts
All constants stored in `modbus-rtu/constants.js`. You can require this file and override default values:

```js
var constants = require('modbus-rtu/constants');
constants.END_PACKET_TIMEOUT = 15;
constants.RESPONSE_TIMEOUT = 500;
```

### API Documentation

#### new modbus.Master(serialPort)

Constructor of modbus class.

* **serialPort** - instance of serialPort object

Example:
```js
new modbus.Master(new SerialPort("/dev/ttyUSB0", {
    baudrate: 9600
}))
```

#### master.readHoldingRegisters(slave, start, length) -> Promise
Modbus function read holding registers

* **slave** - slave address (1..247)
* **start** - start register for reading
* **length** - how many registers to read

**Returns promise** which will be fulfilled with array of data

Example:
```js
var master = new modbus.Master(serialPort);

master.readHoldingRegisters(1, 0, 4).then(function(data){
    //promise will be fulfilled with parsed data
    console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
}, function(err){
    //or will be rejected with error
    //for example timeout error or crc.
})
```

#### master.writeSingleRegister(slave, register, value, retryCount=10) -> promise
Modbus function write single register.
If fails will be repeated `retryCount` times.

* **slave** - slave address (1..247)
* **register** - register number for write
* **value** - int value
* **retryCount** - int count of attempts. Set 1, if you don't want to retry request on fail.

**Returns Promise**

Example:
```js
var master = new modbus.Master(serialPort);
master.writeSingleRegister(1, 2, 150);
```

#### master.writeMultipleRegisters(slave, start, array) -> promise
Modbus function write multiple registers.

You can set starting register and data array. Register from `start` to `array.length` will be filled with array data

* **slave** - slave address (1..247)
* **start** - starting register number for write
* **array** - array of values

**Returns promise**

Example:
```js
new modbus.Master(serialPort, function (master) {
  master.writeMultipleRegisters(1, 2, [150, 100, 20]);
}
```

### Roadmap
1. Refactoring. Extract queue to separate entity. Replace console.log() to powerfull logger.
2. Write test
3. Add rest modbus functions
