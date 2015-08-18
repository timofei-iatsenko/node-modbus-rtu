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
There is another nodejs modbusrtu implementation but it use native libmodbus library work only on *nix systems and no more support (binaries don't compile for current version of node).
Also there are few implementation of ModbusTCP protocol.

This library use node-serialport wich has active community, node buffers and async stack works on promises.
You don't need deal with timeouts or think about sequental writing to serialport, all of this done by this library.
