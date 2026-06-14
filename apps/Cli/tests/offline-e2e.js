#!/usr/bin/env node

/**
 * Offline end-to-end test for the Gent CLI.
 *
 * Drives the real CLI (src/index.js) through init → add → commit → branch →
 * diverge → merge, entirely on the local filesystem with an isolated HOME and
 * NO network. Its main job is to prove that a 3-way merge with a one-sided
 * insertion (the case that used to crash with "Invalid array length") now
 * succeeds, and that a genuine conflict produces markers instead of crashing.
 *
 * Run with:  node tests/offline-e2e.js
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.resolve(__dirname, '..', 'src', 'index.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-offline-e2e-'));
const home = path.join(root, 'home');
fs.mkdirSync(home, { recursive: true });

const env = { ...process.env, HOME: home, USERPROFILE: home };

let scenario = 'setup';
function run(cwd, args) {
    const res = spawnSync('node', [CLI, ...args], { cwd, env, encoding: 'utf-8' });
    if (res.status !== 0) {
        console.error(`\n[${scenario}] command failed: gent ${args.join(' ')}`);
        console.error('stdout:\n' + res.stdout);
        console.error('stderr:\n' + res.stderr);
        throw new Error(`gent ${args[0]} exited with ${res.status}`);
    }
    // Combine streams: ora spinners write to stderr, console.log to stdout.
    return (res.stdout || '') + (res.stderr || '');
}

function setIdentity(workDir) {
    const cfgPath = path.join(workDir, '.gent', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    cfg.user = { name: 'E2E Tester', email: 'e2e@gent.test' };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

function newRepo(name) {
    const work = path.join(root, name);
    fs.mkdirSync(work, { recursive: true });
    run(work, ['init', '-y']);
    setIdentity(work);
    return work;
}

const write = (dir, file, lines) => fs.writeFileSync(path.join(dir, file), lines.join('\n'));
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf-8');

// ── Scenario 1: clean 3-way merge with a one-sided insertion ───────────────
scenario = 'clean-merge';
{
    const w = newRepo('clean');

    write(w, 'foo.txt', ['alpha', 'beta', 'gamma']);
    run(w, ['add', 'foo.txt']);
    run(w, ['commit', '-m', 'base']);

    // feature branch: insert a line after alpha
    run(w, ['checkout', '-b', 'feature']);
    write(w, 'foo.txt', ['alpha', 'INSERTED', 'beta', 'gamma']);
    run(w, ['add', 'foo.txt']);
    run(w, ['commit', '-m', 'feature insert']);

    // back to main: change the last line (disjoint from the insertion)
    run(w, ['checkout', 'main']);
    write(w, 'foo.txt', ['alpha', 'beta', 'gamma-MAIN']);
    run(w, ['add', 'foo.txt']);
    run(w, ['commit', '-m', 'main change']);

    const out = run(w, ['merge', 'feature']);
    assert.match(out, /Merged 'feature' into 'main'/);

    const merged = read(w, 'foo.txt');
    assert.equal(merged, 'alpha\nINSERTED\nbeta\ngamma-MAIN');
    console.log('  ok   clean 3-way merge (one-sided insertion) — no crash, correct output');
}

// ── Scenario 2: real conflict produces markers, no crash ───────────────────
scenario = 'conflict-merge';
{
    const w = newRepo('conflict');

    write(w, 'bar.txt', ['alpha', 'beta']);
    run(w, ['add', 'bar.txt']);
    run(w, ['commit', '-m', 'base']);

    run(w, ['checkout', '-b', 'feature']);
    write(w, 'bar.txt', ['alpha', 'BETA-FEATURE']);
    run(w, ['add', 'bar.txt']);
    run(w, ['commit', '-m', 'feature edit']);

    run(w, ['checkout', 'main']);
    write(w, 'bar.txt', ['alpha', 'BETA-MAIN']);
    run(w, ['add', 'bar.txt']);
    run(w, ['commit', '-m', 'main edit']);

    const out = run(w, ['merge', 'feature']);
    assert.match(out, /CONFLICT/);

    const conflicted = read(w, 'bar.txt');
    assert.match(conflicted, /<<<<<<< ours/);
    assert.match(conflicted, /=======/);
    assert.match(conflicted, />>>>>>> theirs/);

    // merge state recorded for `gent resolve`
    const staging = JSON.parse(read(w, path.join('.gent', 'staging.json')));
    assert.ok(staging.mergeState, 'mergeState should be recorded on conflict');
    console.log('  ok   conflicting merge — markers written, merge state recorded');
}

// ── Scenario 3: undo / redo a commit ───────────────────────────────────────
scenario = 'undo-redo';
{
    const w = newRepo('undo');
    const headOf = () => JSON.parse(read(w, path.join('.gent', 'commits.json'))).branches.main;

    write(w, 'note.txt', ['v1']);
    run(w, ['add', 'note.txt']);
    run(w, ['commit', '-m', 'first']);
    const head1 = headOf();

    write(w, 'note.txt', ['v1', 'v2']);
    run(w, ['add', 'note.txt']);
    run(w, ['commit', '-m', 'second']);
    const head2 = headOf();
    assert.notEqual(head1, head2);

    const undoOut = run(w, ['undo']);
    assert.match(undoOut, /Undid commit/);
    assert.equal(headOf(), head1, 'undo should move branch back to the first commit');

    // working file is preserved (non-destructive undo)
    assert.equal(read(w, 'note.txt'), 'v1\nv2');

    const redoOut = run(w, ['redo']);
    assert.match(redoOut, /Redid commit/);
    assert.equal(headOf(), head2, 'redo should restore the second commit');

    // history listing works
    assert.match(run(w, ['undo', '--list']), /commit/);
    console.log('  ok   undo/redo a commit — pointer moves, working file preserved');
}

// ── Scenario 4: read-only insight commands run cleanly ─────────────────────
scenario = 'insight-commands';
{
    const w = newRepo('insight');
    write(w, 'app.js', ['const x = 1;', 'console.log(x);']);
    run(w, ['add', 'app.js']);
    run(w, ['commit', '-m', 'initial app']);
    write(w, 'app.js', ['const x = 2;', 'console.log(x);', 'console.log("more");']);
    run(w, ['add', 'app.js']);
    run(w, ['commit', '-m', 'tweak app']);

    const sum = run(w, ['summary']);
    assert.match(sum, /Commits:\s*2/);
    assert.match(sum, /Tracked:/);

    const graph = run(w, ['log', '--graph']);
    assert.match(graph, /Commit graph/);
    assert.match(graph, /\(HEAD\)/);

    // explain without an API key still prints the diff + a hint
    const explained = run(w, ['explain']);
    assert.match(explained, /Commit [0-9a-f]{7}/);
    assert.match(explained, /ANTHROPIC_API_KEY/);
    console.log('  ok   summary / log --graph / explain run cleanly');
}

console.log('\noffline e2e: all scenarios passed');
