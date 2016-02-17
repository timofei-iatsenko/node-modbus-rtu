// In real projects polling all you slaves in one loop is extremely uncomfortable in JS.
// The better way is create an abstraction. For example class for each you device.
//
// Assume we have a modbus thermostat, and we want to do something when data from thermostat is changed.
//
// Create class for this thermostat:

var _ = require('lodash'); //npm i lodash
var MicroEvent = require('microevent'); //npm i microevent

module.exports = Thermostat;

//Describe all slave registers
var ENABLED_REGISTER = 0,
    ROOM_TEMP_REGISTER = 3,
    TEMP_SETPOINT_REGISTER = 4;

function Thermostat(modbusMaster, modbusAddr) {
    this.modbusMaster = modbusMaster;
    this.modbusAddr = modbusAddr;

    // create properties
    this.enabled = false;
    this.roomTemp = null;
    this.tempSetpoint = null;

    this._rawData = [];
    this._oldData = [];

    this.watch();
}

MicroEvent.mixin(Thermostat);

_.extend(Thermostat.prototype, {
    update: function() {
        var th = this;
        //read data from thermostat
        return this.modbusMaster.readHoldingRegisters(this.modbusAddr, 0, 6)
            .then(function(data) {
                // when data received store it in the object properties
                th._rawData = data;

                th.enabled = data[ENABLED_REGISTER] != 90;
                th.roomTemp = data[ROOM_TEMP_REGISTER] / 2;
                th.tempSetpoint = data[TEMP_SETPOINT_REGISTER] / 2;

            })
    },

    toString: function() {
        return 'Status: ' + (this.enabled ? 'on' : 'off') +
            '; Room temp: ' + this.roomTemp + 'C; Set temp: ' + this.tempSetpoint + 'C;'
    },

    watch: function() {
        var self = this;

        // make internal loop.
        self.update().finally(function() {
            if (!_.isEqual(self._oldData, self._rawData)) {
                self.trigger('change', self);
                self._oldData = self._rawData.slice(0); //clone data array
            }

            setTimeout(function() {
                self.watch();
            }, 300)
        }).catch(function(err) {
            console.log(err);
        });
    }
});

//This simple class blackboxing all modbus communication inside and provide to us simple and clean api.
new modbus.Master(serialPort, function(modbus) {
    var t = new Thermostat(modbus, slave);
    t.bind('change', function() {
        //this code execute only when thermostat is changed
        console.log('Thermostat ' + i + '. ' + t.toString());
    });
});
