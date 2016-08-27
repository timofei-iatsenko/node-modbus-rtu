const test = require('tape');

if (process.env.NODE_ENV !== 'test') {
    const tapSpec = require('tap-spec');
    test.createStream()
        .pipe(tapSpec())
        .pipe(process.stdout);
}

module.exports = test;
