# node-modbus-rtu [![Build Status](https://travis-ci.org/thekip/node-modbus-rtu.svg?branch=master)](https://travis-ci.org/thekip/node-modbus-rtu)
Pure NodeJS implementation of ModbusRTU protocol
using [node-serialport](https://github.com/voodootikigod/node-serialport) and [Bluebird promises](https://github.com/petkaantonov/bluebird)

## Implementation notes
This library implement ONLY **ModbusRTU Master** and only most important features:
 * **03** Read Holding Registers
 * **06** Write Single Register
 * **16** Write Multiple Registers

Coil functions (readCoils, writeCoils) is not implemented yet. But you can fork and add this.

## Minimal requirements
NodeJS >=0.11.13

if you have older NodeJS version, you should install `modbus-rtu@0.0.2` version 
or update NodeJS (the 6.0 version is out, how long you will be use legacy builds? :) )

## Installation
The simplest way, install via npm, type to console:

`npm i modbus-rtu serialport --save`

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

**or**

Pass options directly to Modbus constructor: 

```js
new modbus.Master(serialPort, {
   endPacketTimeout: 50,
   queueTimeout: 50,
   responseTimeout: 150
})
```

## How to get raw buffer
Modbus holding register can store only 16-bit data types.

Registers could be combined together to form any of these 32-bit data types:
* A 32-bit unsigned integer (a number between 0 and 4,294,967,295)
* A 32-bit signed integer (a number between -2,147,483,648 and 2,147,483,647)
* A 32-bit single precision IEEE floating point number.
* A four character ASCII string (4 typed letters)

More registers can be combined to form longer ASCII strings.  
Each register being used to store two ASCII characters (two bytes).

To parse this combined data types, you can get raw buffer in callback 
and make anything you want with that.

```js
master.readHoldingRegisters(1, 0, 2, function(rawBuffer) {
    //buffer here contains only data without pdu header and crc
    return rawBuffer.readUInt32BE(0);
}).then(function(bigNumber){
    //promise will be fullfilled with result of callback
    console.log(bigNumber); //2923517522
})
```

### API Documentation

#### new modbus.Master(serialPort, [options])

Constructor of modbus class.

* **serialPort** - instance of serialPort object
* **options** - object with Modbus options

**List of options:**
* `endPacketTimeout`: default `constants.END_PACKET_TIMEOUT`
* `queueTimeout`: default `constants.QUEUE_TIMEOUT`
* `responseTimeout`: default `constants.RESPONSE_TIMEOUT`
* `debug`: default `false`; enable logging to console. 

Example:
```js
new modbus.Master(new SerialPort("/dev/ttyUSB0", {
    baudrate: 9600
}))
```

#### master.readHoldingRegisters(slave, start, length, [dataType]) -> Promise<number[]>
Modbus function read holding registers.

The Modbus specification doesn't define exactly what data type is stored in the holding register.
By default this function treat bytes as **signed integer**.

If you want to change default data type, you should pass preferred type as last parameter.  

* **slave** - slave address (1..247)
* **start** - start register for reading
* **length** - how many registers to read
* **dataType** - dataType or function. If function is provided, this will be used for parsing raw buffer.
dataType is one of `Modbus.DATA_TYPES`

**Returns promise** which will be fulfilled with array of data

Example:
```js
var master = new modbus.Master(serialPort);

master.readHoldingRegisters(1, 0, 4).then(function(data){
    //promise will be fulfilled with parsed data
    console.log(data); //output will be [-10, 100, 110, 50] (numbers just for example)
}, function(err){
    //or will be rejected with error
    //for example timeout error or crc.
})

master.readHoldingRegisters(1, 0, 4, modbus.Master.DATA_TYPES.UINT).then(function(data){
    // data will be treat as unsigned integer
    console.log(data); //output will be [20, 100, 110, 50] (numbers just for example)
})

master.readHoldingRegisters(1, 0, 2, function(rawBuffer) {
    //buffer here contains only data without pdu header and crc
    return rawBuffer.readUInt32BE(0);
}).then(function(bigNumber){
    //promise will be fullfilled with result of callback
    console.log(bigNumber); //2923517522
})
```

**Allowed Data Types**

* `DATA_TYPES.UINT` A 16-bit unsigned integer (a whole number between 0 and 65535)
* `DATA_TYPES.INT` A 16-bit signed integer (a whole number between -32768 and 32767)
* `DATA_TYPES.ASCII` A two character ASCII string (2 typed letters)

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
})
```

###Testing
Tests written in ES6 syntax, so minimal NodeJS version to start it is 5.0.

To run test, type to console:

`npm test`

Or run manually entire test (by executing test file via node).

Please feel free to create PR with you tests.

### Roadmap
1. Refactoring. Extract queue to separate entity. Replace console.log() to powerfull logger.
2. Write test
3. Add rest modbus functions
