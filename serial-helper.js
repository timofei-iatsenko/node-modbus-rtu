var Promise = require("bluebird");
var _ = require('lodash');

module.exports = SerialHelper;

function SerialHelper(serialPort, options) {
    var self = this;

    this.queue = [];
    this._options = options;
    this.serialPort = serialPort;
    this.buffers = [];
    this.currentTask = null;

    this.serialPort.on("open", function () {
        self.processQueue();
    });

    var onData = _.debounce(function () {
        var buffer = Buffer.concat(self.buffers);
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

SerialHelper.prototype._write = function(buffer, deferred) {
  this._options.debug && console.log('write', buffer);
    this.serialPort.write(buffer, function (error) {
        if (error)
            deferred.reject(error);
    });

    return deferred.promise.timeout(this._options.responseTimeout, 'Response timeout exceed!');
};

SerialHelper.prototype.processQueue = function () {
    var self = this;

    function continueQueue() {
        setTimeout(function(){
            self.processQueue();
        }, self._options.queueTimeout);  //pause between calls
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

    var task = {
      deferred: deferred,
      buffer: buffer
    };

    this.queue.push(task);

    deferred.promise.abort = function() {
      var _self = this;

      if (deferred.promise.isPending()) {
        deferred.reject();
        _.pull(_self.queue, task);
      }
    };

    return deferred.promise;
};

