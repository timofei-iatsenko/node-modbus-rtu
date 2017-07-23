import Promise from 'bluebird';

const EXCEPTION_LENGTH = 5;
const MIN_DATA_LENGTH = 6;
const MAX_BUFFER_LENGTH = 256;

export class Task {
    /**
     * @param {Buffer} payload
     */
    constructor(payload) {
        /**
         * @private
         */
        this.deferred = this.createDeferred();
        /**
         *
         * @type {Promise}
         */
        this.promise = this.deferred.promise;

        /**
         * @type {Buffer}
         */
        this.payload = payload;

        /**
         * @private
         */
        this.id = payload[0];

        /**
         * @private
         */
        this.cmd = payload[1];

        /**
         * @private
         */
        this.length = this.getExpectedLength(this.cmd, payload);

        /**
         * @private
         */
        this.buffer = new Buffer(0);
    }

    resolve(data) {
        this.deferred.resolve(data);
    }

    reject(error) {
        this.deferred.reject(error);
    }

    /**
     *
     * @param {Buffer} data
     * @param {function(response: Buffer)} done
     * @returns {Buffer}
     */
    receiveData(data, done) {
        this.buffer = Buffer.concat([this.buffer, data]);

        const expectedLength = this.length;
        let bufferLength = this.buffer.length;

        if (expectedLength < MIN_DATA_LENGTH || bufferLength < EXCEPTION_LENGTH) { return; }

        if (bufferLength > MAX_BUFFER_LENGTH) {
            this.buffer = this.buffer.slice(-MAX_BUFFER_LENGTH);
            bufferLength = MAX_BUFFER_LENGTH;
        }

        // loop and check length-sized buffer chunks
        const maxOffset = bufferLength - EXCEPTION_LENGTH;
        for (let i = 0; i <= maxOffset; i++) {
            const unitId = this.buffer[i];
            const functionCode = this.buffer[i + 1];

            if (unitId !== this.id) { continue; }

            if (functionCode === this.cmd && i + expectedLength <= bufferLength) {
                return done(this.getMessage(i, expectedLength));
            }
            if (functionCode === (0x80 | this.cmd) && i + EXCEPTION_LENGTH <= bufferLength) {
                return done(this.getMessage(i, EXCEPTION_LENGTH));
            }

            // frame header matches, but still missing bytes pending
            if (functionCode === (0x7f & this.cmd)) { break; }
        }
    }

    /**
     * @private
     * @param {number} start
     * @param {number} length
     * @returns {Buffer}
     */
    getMessage(start, length) {
        const msg = this.buffer.slice(start, start + length);
        this.buffer = this.buffer.slice(start + length);
        return msg;
    }

    /**
     * @private
     * @param {number} cmd
     * @param {Buffer} payload
     * @return number
     */
    getExpectedLength(cmd, payload) {
        const length = payload.readUInt16BE(4);

        switch (cmd) {
            case 1:
            case 2:
                return 3 + parseInt((length - 1) / 8 + 1, 10) + 2;
            case 3:
            case 4:
                return 3 + 2 * length + 2;
            case 5:
            case 6:
            case 15:
            case 16:
                return 6 + 2;
            default:
                return 0;
        }
    }

    /**
     * @private
     * @returns {{}}
     */
    createDeferred() {
        const deferred = {};

        deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });

        return deferred;
    }
}