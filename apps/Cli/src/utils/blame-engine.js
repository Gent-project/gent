const { buildLineOperations } = require('./diff-engine');

function linesOf(text) {
    if (!text) return [];
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    return lines;
}

/**
 * Trace each line in the newest snapshot through a first-parent history.
 * History items are newest first and contain { oid, author, timestamp, text }.
 */
function traceBlame(history) {
    if (!history.length) return [];
    const targetLines = linesOf(history[0].text);
    const attributions = targetLines.map(() => history[0]);
    let currentLines = targetLines;
    let currentToTarget = currentLines.map((_, index) => [index]);

    for (let h = 1; h < history.length; h++) {
        const parent = history[h];
        const parentLines = linesOf(parent.text);
        const parentToTarget = parentLines.map(() => []);

        for (const op of buildLineOperations(parentLines, currentLines)) {
            if (op.type !== 'equal') continue;
            const targets = currentToTarget[op.newLine - 1] || [];
            parentToTarget[op.oldLine - 1].push(...targets);
            for (const targetIndex of targets) attributions[targetIndex] = parent;
        }

        currentLines = parentLines;
        currentToTarget = parentToTarget;
    }

    return targetLines.map((line, index) => ({
        line,
        lineNumber: index + 1,
        ...attributions[index],
    }));
}

module.exports = { traceBlame, linesOf };
