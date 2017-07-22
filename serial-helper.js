const _ = require('lodash');
const Task = require('./task').Task;
const ModbusResponseTimeout = require('./errors').ModbusResponseTimeout;

module.exports = SerialHelper;

class SerialHelper {
    /**
     * @param {SerialPort} serialPort
     * @param options
     */
    constructor(serialPort, options) {
        /**
         * @type {Task[]}
         */
        this.queue = [];
        /**
         * @private
         */
        this.options = options;
        this.serialPort = serialPort;

        this.bindToSerialPort();
    }

    /**
     *
     * @param {Buffer} buffer
     * @returns {Promise}
     */
    write(buffer) {
        const task = new Task(buffer);
        this.queue.push(task);

        return task.promise;
    }

    /**
     * @private
     */
    bindToSerialPort() {
        this.serialPort.on("open", () => {
            this.startQueue();
        });
    }

    /**
     *
     * @param {Task} task
     * @returns {Promise}
     * @private
     */
    processTask(task) {
        this.options.debug && console.log('write', task);
        this.serialPort.write(task.payload, (error) => {
            if (error) {
                task.reject(error);
            }
        });

        // set execution timeout for task
        setTimeout(() => {
            task.reject(new ModbusResponseTimeout(this.options.responseTimeout))
        }, this.options.responseTimeout);

        this.serialPort.on('data', (data) => {
            task.receiveData(data, (response) => {
                this.options.debug && console.log('resp', response);
                task.resolve(response);
            });
        });
        
        return task.promise;
    }

    /**
     * @private
     */
    startQueue() {
        const continueQueue = () => {
            setTimeout(() => {
                this.startQueue();
            }, this.options.queueTimeout);  //pause between calls
        };

        if (this.queue.length) {
            const task = this.queue.shift();
            this.processTask(task).finally(continueQueue);
        } else {
            continueQueue();
        }
    }
}

