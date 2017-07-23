class Queue {
    /**
     * @template T
     * @param {function(task: T, done: function):void} onEachTask callback which will be called on each task
     * @param {number} timeout pause between queue tasks
     */
    constructor(onEachTask, timeout) {
        /** @private */
        this.onEachTask = onEachTask;

        /** @private */
        this.queueTimeout = timeout;

        /**
         * @private
         * @type {T[]}
         */
        this.queue = [];
    }

    /**
     * @param {T} task
     */
    push(task) {
        this.queue.push(task);
    }

    start() {
        this.isActive = true;
        this.handle();
    }

    stop() {
        this.isActive = false;
    }

    /**
     * @private
     */
    handle() {
        if (!this.isActive) {
            return;
        }

        if (this.queue.length) {
            const task = this.queue.shift();
            this.onEachTask(task, this.continueQueue.bind(this));
        } else {
            this.continueQueue();
        }
    }

    /**
     * @private
     */
    continueQueue() {
        // pause between calls
        setTimeout(this.handle.bind(this), this.queueTimeout);
    }
}

module.exports = {
    Queue,
};