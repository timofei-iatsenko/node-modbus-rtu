export class Queue {
    /**
     * @template T
     * @param {number} timeout pause between queue tasks
     */
    constructor(timeout) {
        /** @potected */
        this.taskHandler = (task, done) => done();

        /** @private */
        this.queueTimeout = timeout;

        /**
         * @protected
         * @type {T[]}
         */
        this.queue = [];
    }

    /**
     * Set handler which will be called on each task
     * @param {function(task: T, done: function):void} handler
     */
    setTaskHandler(handler) {
        this.taskHandler = handler;
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
            this.taskHandler(task, this.continueQueue.bind(this));
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