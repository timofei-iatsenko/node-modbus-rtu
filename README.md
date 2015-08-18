# node-modbus-rtu
Pure NodeJS implementation of ModbusRTU protocol using node-serialport and promises


## Implementation notes
This library implement ONLY *ModbusRTU Master* and only few most important features:
 * 03 Read Holding Registers
 * 06 Write Single Register
 * 16 Write Multiple Registers

Function for work with coils is not implemented. But you can fork and add this.

## Benefits
The main goal of this library, this is native js implementation.
There is another nodejs modbusrtu implementation but it use native libmodbus library work only on *nix systems and have no more support (binaries don't compile for current version of node).
Also there are few implementation of ModbusTCP protocol but it doesn't compatible with RTU protocol.

This library use node-serialport wich has active community, node buffers and async stack works on promises.
You don't need deal with timeouts or think about sequental writing to serialport, all of this done by this library.

## Examples

### The basic example
```js
    var SerialPort = require('serialport').SerialPort;
    var modbus = require('./modbus-rtu');

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

```js
    var SerialPort = require('serialport').SerialPort;
    var modbus = require('./modbus-rtu');
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
           promises.push(master.readHoldingRegisters(2, 0, 4).then(function(data){
              console.log('slave 2', data);
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
This approach is very similar to arduino or PLC programming aproach, but it extremly uncomfortable in JS,
because if you need do something after response is recieved you need to do it in a promise callback, and very quickly it became into callback hell.
So i suggest another approach. Apply IoC pattern to our code and write some classes for our slaves:

### Use in real project: creating objects for slaves
For example we have a modbus thermostat, and we need set do something when data from thermostat is changed.
Create class for this thermostat (i suggest extract it another file):

```js
var _ = require('lodash'); //npm i lodash
var MicroEvent  = require('microevent'); //npm i microevent

module.exports = Thermostat;

var ENABLED_REGISTER = 0,
    FAN_SPEED_REGISTER = 1,
    MODE_REGISTER = 2,
    ROOM_TEMP_REGISTER = 3,
    TEMP_SETPOINT_REGISTER = 4,
    MANUAL_WEEKLY_PROG_REGISTER = 5,

    MINUTE_SECOND_REGISTER = 6,
    WEEK_HOUR_REGISTER = 7;


function Thermostat(modbusMaster, modbusAddr) {
    this.modbusMaster = modbusMaster;
    this.modbusAddr = modbusAddr;

    this.enabled = false;
    this.fanSpeed = null;
    this.mode = null;
    this.roomTemp = null;
    this.tempSetpoint = null;
    this.isWeeklyProgram = null;

    this._rawData = [];
    this._oldData = [];

    this.watch();
}

MicroEvent.mixin(Thermostat);

_.extend(Thermostat.prototype, {
    update: function () {
        var th = this;
        return this.modbusMaster.readHoldingRegisters(this.modbusAddr, 0, 6).then(function (data) {
            th._rawData = data;

            th.enabled = data[ENABLED_REGISTER] != 90;
            th.fanSpeed = data[FAN_SPEED_REGISTER];
            th.mode = data[MODE_REGISTER];
            th.roomTemp = data[ROOM_TEMP_REGISTER] / 2;
            th.tempSetpoint = data[TEMP_SETPOINT_REGISTER] / 2;
            th.isWeeklyProgram = data[MANUAL_WEEKLY_PROG_REGISTER];
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

Now our thermostat will be trigger callback only if data is changed.
You can write same classes for all you slave devices, create events which make sense for you and write useful code more comfortable.


### How it works inside

Communicating via serial port is sequental. It means you can't write few requests and then read few responses.
So you have to write something wait the answer and then writing another command.
Also Modbus is binary protocol, so you can't recognize end of packet by new line or something like that.
Packets separate only via timeout.

The problem is, if we call few functions sequental in js, it means they will not wait for answer, they write something immediatly.
And as result we recieve trash.

For dealing with that problem inside library is a simple queue. When you call any of modbus function this call adds to quue and immidiatly return a promise.
When queue process this request and response will be recieved promise will be fullfiled.
If result will not recieved in `constants.RESPONSE_TIMEOUT` time promise will be rejected with timput error.

SerialPort recieve data randomly. It means it can call `onData` event  for 2 bytes or 4 or more. Dut we know that between our packets we have a little timeout.
So i use debounce function for collecting buffer.
Each time serialPort `onData` event is fire it store response buffer in array and call debounced function,
when pause between calls reach setted timeout function inside debounce will called and all buffer will be concatenated.
It means packet is end and we can fullfill the promise.

TODO: review this section and add info about tuning timeouts

### API Documentation

#### new modbus.Master(serialPort, onReady)

Constructor of modbus class.

*serialPort - instance of serialPort object
*onReady - onReady callback. Modbus Master object will be passed as first parameter

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

*slave - slave address (1..247)
*start - start register for reading
*length - how many registers to read

Returns promise which will be fullfilled with array of data

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

*slave - slave address (1..247)
*register - register number for write
*value - int value

Returns promise

Example:
```js
   new modbus.Master(serialPort, function (master) {
      master.writeSingleRegister(1, 2, 150);
   }
```

#### master.writeMultipleRegisters(slave, start, array) -> promise
Modbus function write multiple registers.
You can set starting register and array with data. Register from start to `array.length` will be filled with array data

*slave - slave address (1..247)
*start - starting register number for write
*array - array of values

Returns promise

Example:
```js
   new modbus.Master(serialPort, function (master) {
      master.writeMultipleRegisters(1, 2, [150, 100, 20]);
   }