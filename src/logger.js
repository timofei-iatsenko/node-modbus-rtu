export class Logger {
    constructor(options) {
        this.options = options;
    }

    info(string) {
        if (this.options.debug) {
            console.log(string);
        }
    }
}