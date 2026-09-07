const ora = require('ora');

function createProgress(initialText, options = {}) {
    const stream = options.stream || process.stderr;
    const interactive = options.interactive ?? Boolean(stream.isTTY);
    const spinner = ora({ text: initialText, stream, isEnabled: interactive });
    let active = true;
    let lastText = initialText;

    if (interactive) spinner.start();
    else stream.write(`${initialText}\n`);

    const update = text => {
        if (!active || !text || text === lastText) return;
        lastText = text;
        if (interactive) spinner.text = text;
        else stream.write(`${text}\n`);
    };

    const finish = (method, text) => {
        if (!active) return;
        active = false;
        if (interactive) spinner[method](text);
        else stream.write(`${text}\n`);
    };

    return {
        update,
        succeed: text => finish('succeed', text),
        fail: text => finish('fail', text),
    };
}

module.exports = { createProgress };
