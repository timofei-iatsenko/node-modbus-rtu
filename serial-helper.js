const Promise = require("bluebird");
const _ = require('lodash');
const Task = require('./task').Task;

module.exports = SerialHelper;

class SerialHelper {
    /**
     * @param {SerialPort} serialPort
     * @param options
     */
    constructor(serialPort, options) {
        this.queue = [];
        this._options = options;
        this.serialPort = serialPort;
        this.buffers = [];
        this.currentTask = null;

        this.bindToSerialPort();
    }

    /**
     *
     * @param {Buffer} buffer
     * @returns {Promise}
     */
    write(buffer) {
        const deferred = {};

        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });

        const task = {
            deferred: deferred,
            buffer: buffer
        };

        this.queue.push(task);

        deferred.promise.abort = function () {
            const _self = this;

            if (deferred.promise.isPending()) {
                deferred.reject();
                _.pull(_self.queue, task);
            }
        };

        return deferred.promise;
    }

    /**
     * @private
     */
    bindToSerialPort() {
        this.serialPort.on("open", () => {
            this.processQueue();
        });

        const onData = _.debounce(() => {
            const buffer = Buffer.concat(self.buffers);
            this._options.debug && console.log('resp', buffer);
            this.currentTask.deferred.resolve(buffer);

            this.buffers = [];
        }, this._options.endPacketTimeout);

        this.serialPort.on('data', (data) => {
            if (this.currentTask) {
                this.buffers.push(data);
                onData(data);
            }
        });
    }

    /**
     *
     * @param {Buffer} buffer
     * @param deferred
     * @returns {Promise}
     * @private
     */
    writeInternal(buffer, deferred) {
        this._options.debug && console.log('write', buffer);
        this.serialPort.write(buffer, function (error) {
            if (error)
                deferred.reject(error);
        });

        return deferred.promise.timeout(this._options.responseTimeout, 'Response timeout exceed!');
    }

    /**
     * @private
     */
    processQueue() {
        const self = this;

        function continueQueue() {
            setTimeout(function () {
                self.processQueue();
            }, self._options.queueTimeout);  //pause between calls
        }

        if (this.queue.length) {
            this.currentTask = this.queue[0];
            this.writeInternal(this.currentTask.buffer, this.currentTask.deferred)
                .catch(function (err) {
                    self.currentTask.deferred.reject(err)
                })
                .finally(function () {
                    //remove current task
                    self.queue.shift();
                    continueQueue();
                }).done();
        } else {
            continueQueue();
        }
    }
}

