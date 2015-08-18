# node-modbus-rtu
Pure NodeJS implementation of ModbusRTU protocol using [node-serialport](https://github.com/voodootikigod/node-serialport) and promises

## Implementation notes
This library implement ONLY **ModbusRTU Master** and only few most important features:
 * **03** Read Holding Registers
 * **06** Write Single Register
 * **16** Write Multiple Registers

Coil functions (readCoils, writeCoils) is not implemented yet. But you can fork and add this.

Also Modbus response error doesn't checks (if your slave device return exception packet, you can't understand it), but crc is checked.

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

**NOTE!** [node-serialport](https://github.com/voodootikigod/node-serialport) doesn't support  node 0.11.11+. Check [documentation](https://github.com/voodootikigod/node-serialport) to more info


## Benefits
The main goal of this library, that is native js implementation.
There is another nodejs modbusrtu implementation but it use native libmodbus library which work only on *nix systems and have no more support (binaries don't compile for current version of node).

Also there are few implementation of ModbusTCP protocol but it doesn't compatible with RTU protocol.

This library use node-serialport which has active community, node buffers and promises.

You don't need deal with timeouts or think about sequental writing to serialport, all of this done by this library.

## Examples

### The basic example
```js
var SerialPort = require('serialport').SerialPort;
var modbus = require('modbus-rtu');

//create serail port with params. Refer to node-serialport for documentation
var serialPort = new SerialPort("/dev/ttyUSB0", {
   baudrate: 2400
});

//create ModbusMaster instance and feed them serial port
new modbus.Master(serialPort, function (master) {
      //Read from slave with address 1 four holding registers starting from 0.
      master.readHoldingRegisters(1, 0, 4).then(function(data){
        //promise will be fulfilled with parsed data
        console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
      }, function(err){
        //or will be rejected with error
        //for example timeout error or crc.
      })

      //Write to first slave into second register value 150.
      //slave, register, value
      master.writeSingleRegister(1, 2, 150).then(success, error);
})
```

### Polling data from slaves in loop.

When polling in loop you have to wait response of all yours request, otherwise pause between loop will be not work.

We collect all promises in array, then use Q.all() and create new promise which will be fullfiled when all requests finished.

```js
var SerialPort = require('serialport').SerialPort;
var modbus = require('modbus-rtu');
var Q = require('q');

//create serail port with params. Refer to node-serialport for documentation
var serialPort = new SerialPort("/dev/ttyUSB0", {
   baudrate: 2400
});

new modbus.Master(serialPort, function (master) {
   var promises = [];

   (function loop (){
      //Read from slave 1
      promises.push(master.readHoldingRegisters(1, 0, 4).then(function(data){
        console.log('slave 1', data);
      }))

      //Read from slave 2
      promises.push(master.readHoldingRegisters(2, 0, 4).then(function(data){
         console.log('slave 2', data);
      }))

      //Read from slave 3
       promises.push(master.readHoldingRegisters(3, 0, 4).then(function(data){
          console.log('slave 3', data);
       }))

      Q.all(promises).catch(function(err){
        console.log(err); //catch all errors
      }).finally(function(){
        //when all promises fullfiled or rejected, restart loop with timeout
        setTimeout(loop, 300);
      })
   })()
})
```
This approach is very similar to arduino or PLC programming workflow, but it extremely uncomfortable in JS.

Imagine that you need do something after response is received. In this approach you need to do it in a promise callback of particular request.
If you need to wait more than one request or do a cascade (wait one, then second, one by one) Your code became into callback doom very quickly.

So i suggest another approach: apply OOP and IoC pattern to code and write some classes for our slaves:

### Use in real project: creating objects for slaves
For example we have a modbus thermostat, and we want to do something when data from thermostat is changed.
Create class for this thermostat (i suggest extract it to another file):

```js
var _ = require('lodash'); //npm i lodash
var MicroEvent  = require('microevent'); //npm i microevent

module.exports = Thermostat;

var ENABLED_REGISTER = 0,
    FAN_SPEED_REGISTER = 1,
    MODE_REGISTER = 2,
    ROOM_TEMP_REGISTER = 3,
    TEMP_SETPOINT_REGISTER = 4,


function Thermostat(modbusMaster, modbusAddr) {
    this.modbusMaster = modbusMaster;
    this.modbusAddr = modbusAddr;

    this.enabled = false;
    this.fanSpeed = null;
    this.mode = null;
    this.roomTemp = null;
    this.tempSetpoint = null;

    this._rawData = [];
    this._oldData = [];

    this.watch();
}

MicroEvent.mixin(Thermostat);

_.extend(Thermostat.prototype, {
    update: function () {
        var th = this;
        return this.modbusMaster.readHoldingRegisters(this.modbusAddr, 0, 6)
        .then(function (data) {
            th._rawData = data;

            th.enabled = data[ENABLED_REGISTER] != 90;
            th.fanSpeed = data[FAN_SPEED_REGISTER];
            th.mode = data[MODE_REGISTER];
            th.roomTemp = data[ROOM_TEMP_REGISTER] / 2;
            th.tempSetpoint = data[TEMP_SETPOINT_REGISTER] / 2;

        })
    },

    toString: function(){
       return 'Status: '+ (this.enabled ? 'on' : 'off') +
        '; Room temp: ' + this.roomTemp + 'C; Set temp: ' + this.tempSetpoint +'C;'
    },

    watch: function () {
        var self = this;

        self.update().finally(function () {
            if (!_.isEqual(self._oldData, self._rawData)) {
                self.trigger('change', self);
                self._oldData = self._rawData.slice(0); //clone data array
            }

            setTimeout(function () {
                self.watch();
            }, 300)
        }).catch(function(err){
            console.log(err);
        }).done();
    }
})

```

This simple class blackboxing all modbus communication inside and provide to us simple and clean api.

```js
new modbus.Master(serialPort, function (modbus) {
    var t = new Thermostat(modbus, slave);
    t.bind('change', function(){
        console.log('Thermostat '+ i +'. '+ t.toString());
        onThermostatUpdate();
    });
})
```

Now our thermostat will trigger callback only if data is changed.

You can write similar classes for all slave devices, add events which make sense for you and write useful code more comfortable.


### How it works inside

Communicating via serial port is sequential. It means you can't write few requests and then read few responses.

You have to write something then wait the answer and then writing another request.

Also you need determine the end of packet via timeout (different for various baudrate).


The problem is, if we call functions in script in synchronus style (one by one without callbacks),
they will write to port immediately without waiting of response of previous request, as result we receive trash


For dealing with this problem is a simple queue inside library.
When you call any of modbus function they didn't write to port immediately instead of that the adds to queue and return a promise.
When the queue start to process entire request it add a timeout to promise.
If result will not received in `constants.RESPONSE_TIMEOUT` promise will be rejected with timeout error.

SerialPort receive data randomly. It means it can receive 2 bytes per tick or 4 or more.
Modbus packet can contain a various count of bytes.

So our task is collect all bytes and correctly determine end of packet.

This library use debounce function for collecting buffer.

Each time serialPort receive data it trigger a function which store response buffer in array and call debounced function.


Debounced function ignores calls which happen to often and while it we store buffers.

When pause between calls reach setted timeout, function inside debounce will called and all stored buffers will be concatenated.

It means packet is end and we can fulfill the promise.

Both of timeouts can be tuned for you project.

If you set **too small timeout** in debounce function it will be incorrect collect buffers and you will often response CRC error.

If you set **too big timeout** in debounce function you will waist a lot of time on that.

Its important when you have many slave device. Request loop in your script may be more than 1 minute!

#### How to set timeouts
All constants stored in `modbus-rtu/constants.js`. You can require this file and override default values:

```js
var constants = require('modbus-rtu/constants');
constants.END_PACKET_TIMEOUT = 15;
constants.RESPONSE_TIMEOUT = 500;
```

### API Documentation

#### new modbus.Master(serialPort, onReady)

Constructor of modbus class.

* **serialPort** - instance of serialPort object
* **onReady** - onReady callback. Modbus Master object will be passed as first parameter

Example:
```js
var serialPort = new SerialPort("/dev/ttyUSB0", {
   baudrate: 2400
});

new modbus.Master(serialPort, function (master) {
    //call master function here
})
```

#### master.readHoldingRegisters(slave, start, length) -> promise
Modbus function read holding registers

* **slave** - slave address (1..247)
* **start** - start register for reading
* **length** - how many registers to read

**Returns promise** which will be fulfilled with array of data

Example:
```js
new modbus.Master(serialPort, function (master) {
    master.readHoldingRegisters(1, 0, 4).then(function(data){
        //promise will be fulfilled with parsed data
        console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
    }, function(err){
        //or will be rejected with error
        //for example timeout error or crc.
    })
})
```

#### master.writeSingleRegister(slave, register, value) -> promise
Modbus function write single register

* **slave** - slave address (1..247)
* **register** - register number for write
* **value** - int value

**Returns promise**

Example:
```js
new modbus.Master(serialPort, function (master) {
  master.writeSingleRegister(1, 2, 150);
}
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