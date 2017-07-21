const Promise = require("bluebird");
const _ = require('lodash');

module.exports = SerialHelper;

class SerialHelper {
    /**
     * @param {SerialPort} serialPort
     * @param options
     */
    constructor(serialPort, options) {
        const self = this;

        this.queue = [];
        this._options = options;
        this.serialPort = serialPort;
        this.buffers = [];
        this.currentTask = null;

        this.serialPort.on("open", function () {
            self.processQueue();
        });

        const onData = _.debounce(function () {
            const buffer = Buffer.concat(self.buffers);
            self._options.debug && console.log('resp', buffer);
            self.currentTask.deferred.resolve(buffer);

            self.buffers = [];
        }, options.endPacketTimeout);

        serialPort.on('data', function (data) {
            if (self.currentTask) {
                self.buffers.push(data);
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
    _write(buffer, deferred) {
        this._options.debug && console.log('write', buffer);
        this.serialPort.write(buffer, function (error) {
            if (error)
                deferred.reject(error);
        });

        return deferred.promise.timeout(this._options.responseTimeout, 'Response timeout exceed!');
    }

    processQueue() {
        const self = this;

        function continueQueue() {
            setTimeout(function () {
                self.processQueue();
            }, self._options.queueTimeout);  //pause between calls
        }

        if (this.queue.length) {
            this.currentTask = this.queue[0];
            this._write(this.currentTask.buffer, this.currentTask.deferred)
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
}

