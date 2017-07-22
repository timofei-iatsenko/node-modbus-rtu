const Task = require('./task').Task;
const Queue = require('./queue').Queue;
const ModbusResponseTimeout = require('./errors').ModbusResponseTimeout;
const Logger = require('./logger').Logger;

class SerialHelper {
    /**
     * @param {SerialPort} serialPort
     * @param options
     */
    constructor(serialPort, options) {
        /**
         * @type {Queue<Task>}
         */
        this.queue = new Queue(this.handleTask.bind(this), options.queueTimeout);
        /**
         * @private
         */
        this.options = options;
        this.serialPort = serialPort;
        this.logger = new Logger(options);

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
        this.serialPort.on('open', () => {
            this.queue.start();
        });
    }

    /**
     *
     * @param {Task} task
     * @param {function} done
     * @private
     */
    handleTask(task, done) {
        this.logger.info('write ' + task.payload.toString());
        this.serialPort.write(task.payload, (error) => {
            if (error) {
                task.reject(error);
            }
        });

        // set execution timeout for task
        setTimeout(() => {
            task.reject(new ModbusResponseTimeout(this.options.responseTimeout));
        }, this.options.responseTimeout);

        const onData = (data) => {
            task.receiveData(data, (response) => {
                this.logger.info('resp ' + response.toString());
                task.resolve(response);
            });
        };

        this.serialPort.on('data', onData);

        task.promise.finally(() => {
            this.serialPort.removeListener('data', onData);
            done();
        });
    }
}

module.exports = {
    SerialHelper,
};
