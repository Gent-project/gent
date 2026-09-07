#!/usr/bin/env node

require('./utils/env-loader').load();

const { main } = require('./utils/git-graph-adapter');

main(process.argv.slice(2)).then(
    code => { process.exitCode = code; },
    error => {
        process.stderr.write(`gent-git-graph: ${error.message}\n`);
        process.exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
    }
);
