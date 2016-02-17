var Promise = require("bluebird");
var _ = require('lodash');
var constants = require('./constants');

module.exports = SerialHelper;

function SerialHelper(serialPort, onReady) {
    var self = this;

    this.queue = [];

    this.serialPort = serialPort;
    this.buffers = [];
    this.currentTask = null;

    this.serialPort.on("open", function () {
        self.processQueue();
        if (onReady)
            onReady();
    });

    var onData = _.debounce(function () {
        var buffer = Buffer.concat(self.buffers);
        constants.DEBUG && console.log('resp', buffer);
        self.currentTask.deferred.resolve(buffer);

        self.buffers = [];
    }, constants.END_PACKET_TIMEOUT);

    serialPort.on('data', function (data) {
        if (self.currentTask) {
            self.buffers.push(data);
            onData(data);
        }
    });
}

SerialHelper.prototype._write = function(buffer, deferred) {
    constants.DEBUG && console.log('write', buffer);
    this.serialPort.write(buffer, function (error) {
        if (error)
            deferred.reject(error);
    });

    return deferred.promise.timeout(constants.RESPONSE_TIMEOUT, 'Response timeout exceed!');
};

SerialHelper.prototype.processQueue = function () {
    var self = this;

    function continueQueue() {
        setTimeout(function(){
            self.processQueue();
        }, constants.QUEUE_TIMEOUT) //pause between calls
    }

    if (this.queue.length) {
        this.currentTask = this.queue[0];
        this._write(this.currentTask.buffer, this.currentTask.deferred)
            .catch(function(err){
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
};

SerialHelper.prototype.write = function (buffer) {
    var deferred = {};

    deferred.promise = new Promise(function (resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });


    this.queue.push({
        deferred: deferred,
        buffer: buffer
    })

    return deferred.promise;
};

