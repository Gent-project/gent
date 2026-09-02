/**
 * Pet Command — "Genti", the gent mascot.
 *
 * A chunky pixel-block creature that lives in your terminal and *acts out*
 * gent workflows:
 *
 *   gent pet            → idle: Genti breathes, blinks, waves, drops a tip
 *   gent pet push       → walks a file crate to the cloud, over and over
 *   gent pet pull       → carries a crate back from the cloud
 *   gent pet merge      → stands between two branches and "thinks" them together
 *   gent pet auth       → little sign-in scene
 *
 *   --once      play a few cycles, then exit (good for scripts / shell startup)
 *   --no-color  plain output (also honors NO_COLOR)
 *
 * Rendering: everything is drawn onto a colored character Canvas (one cell =
 * one terminal column with its own color), then flushed as ANSI each frame.
 * This keeps every sprite pixel-aligned regardless of color runs.
 */

const chalk = require('chalk');
const authStorage = require('../utils/auth-storage');

const FRAME_MS = 90;

// ── Palette ──────────────────────────────────────────────────────────────
const C = {
    body:   chalk.hex('#c97b5a'),   // Genti's orange skin
    shade:  chalk.hex('#9c5a3f'),   // bottom shading
    eye:    chalk.hex('#15110f'),   // dark eye holes
    mouth:  chalk.hex('#5a2f22'),
    crate:  chalk.hex('#e0b64d'),   // file crate edges
    crateIn:chalk.hex('#b98a1f'),   // crate fill
    cloud:  chalk.hex('#d6def0'),   // remote / cloud
    cloudSh:chalk.hex('#8a93ad'),
    spark:  chalk.hex('#ffe08a'),
    branchA:chalk.hex('#5ac8c9'),
    branchB:chalk.hex('#c98ad6'),
    node:   chalk.hex('#8ae06a'),
    ok:     chalk.hex('#8ae06a'),
    dim:    chalk.gray,
    say:    chalk.hex('#e6e6e6'),
};

// legend char → { color fn, glyph }
const INK = {
    '#': [C.body,    '█'],
    '@': [C.shade,   '█'],
    'O': [C.eye,     '█'],
    '_': [C.mouth,   '▄'],
    'o': [C.mouth,   '▄'],
    '=': [C.crate,   '█'],
    ':': [C.crateIn, '▒'],
    '%': [C.cloud,   '█'],
    '&': [C.cloudSh, '█'],
    '*': [C.spark,   '✦'],
    '|': [C.branchA, '│'],
    '/': [C.branchA, '╱'],
    'A': [C.branchA, '●'],
    '\\':[C.branchB, '╲'],
    'B': [C.branchB, '●'],
    'M': [C.node,    '●'],
};

// ── Canvas ───────────────────────────────────────────────────────────────
class Canvas {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.clear();
    }
    clear() {
        this.cells = Array.from({ length: this.h }, () =>
            Array.from({ length: this.w }, () => ({ ch: ' ', fn: null })));
    }
    put(x, y, ch, fn) {
        if (y < 0 || y >= this.h || x < 0 || x >= this.w) return;
        this.cells[y][x] = { ch, fn };
    }
    // Draw a sprite (array of strings). ' ' and '.' are transparent.
    sprite(rows, x, y) {
        rows.forEach((row, dy) => {
            for (let dx = 0; dx < row.length; dx++) {
                const c = row[dx];
                if (c === ' ' || c === '.') continue;
                const ink = INK[c];
                if (ink) this.put(x + dx, y + dy, ink[1], ink[0]);
                else this.put(x + dx, y + dy, c, C.say);
            }
        });
    }
    text(x, y, str, fn) {
        for (let i = 0; i < str.length; i++) this.put(x + i, y, str[i], fn);
    }
    render() {
        const out = [];
        for (let y = 0; y < this.h; y++) {
            let line = '';
            let run = '';
            let runFn = null;
            const flush = () => {
                if (!run) return;
                line += runFn ? runFn(run) : run;
                run = '';
            };
            for (let x = 0; x < this.w; x++) {
                const cell = this.cells[y][x];
                if (cell.fn !== runFn) { flush(); runFn = cell.fn; }
                run += cell.ch;
            }
            flush();
            out.push(line);
        }
        return out.join('\n');
    }
}

// ── Mascot sprite ────────────────────────────────────────────────────────
// Body is a 12-wide block with a 1-col margin (transparent) each side.
function mascot({ blink = false, mouth = '_', armUp = false } = {}) {
    const W = 12;
    const rows = [];
    rows[0] = ' ' + '#'.repeat(W) + ' ';
    rows[1] = ' ' + '#'.repeat(W) + ' ';
    rows[2] = ' ' + '#'.repeat(W) + ' ';   // eyes row
    rows[3] = ' ' + '#'.repeat(W) + ' ';
    rows[4] = ' ' + '#'.repeat(W) + ' ';   // mouth row
    rows[5] = ' ' + '@'.repeat(W) + ' ';   // shaded chin

    const grid = rows.map(r => r.split(''));
    const eye = blink ? '#' : 'O';
    // eyes at body cols 3-4 and 8-9 → +1 for margin
    [3, 4].forEach(c => grid[2][c + 1] = eye);
    [8, 9].forEach(c => grid[2][c + 1] = eye);
    // mouth at cols 5-8 (row4)
    for (let c = 5; c <= 8; c++) grid[4][c + 1] = mouth;
    // ears (stick out at row2)
    grid[2][0] = '#';
    grid[2][W + 1] = '#';

    let body = grid.map(r => r.join(''));

    // arm (raised wave) sits to the right of the head on row1
    if (armUp) {
        const r1 = body[1].split('');
        r1[W + 1] = '#';
        body[1] = r1.join('');
        body.unshift('             #'); // tiny raised hand
    } else {
        body.unshift('              ');
    }
    return body; // 7 rows (incl. leading arm/space row), 14 wide
}

// Legs are separate so they can shuffle while the body glides.
function legs(step) {
    // step: 'stand' | 'a' | 'b'
    const map = {
        stand: '   ##      ##  ',
        a:     '   ##       #  ',
        b:     '   #       ##  ',
    };
    return [map[step] || map.stand];
}

// ── Props ────────────────────────────────────────────────────────────────
const CRATE = [
    '======',
    '=::::=',
    '=::::=',
    '======',
];

const CLOUD = [
    '  %%%%%%  ',
    '%%%%%%%%%%',
    '&&%%%%%%&&',
];

// ── Speech bubble (drawn straight to canvas as text) ─────────────────────
function drawBubble(cv, line1, line2, color) {
    const w = Math.max(line1.length, (line2 || '').length);
    cv.text(2, 0, '╭' + '─'.repeat(w + 2) + '╮', C.dim);
    cv.text(2, 1, '│ ', C.dim);
    cv.text(4, 1, line1.padEnd(w), color || C.say);
    cv.text(4 + w, 1, ' │', C.dim);
    if (line2) {
        cv.text(2, 2, '│ ', C.dim);
        cv.text(4, 2, line2.padEnd(w), chalk.bold.white);
        cv.text(4 + w, 2, ' │', C.dim);
        cv.text(2, 3, '╰┬' + '─'.repeat(w) + '─╯', C.dim);
        cv.text(4, 4, '╲', C.dim);
    } else {
        cv.text(2, 2, '╰┬' + '─'.repeat(w) + '─╯', C.dim);
        cv.text(4, 3, '╲', C.dim);
    }
}

// ── Scenes ───────────────────────────────────────────────────────────────
// Every scene fills a fresh canvas for tick `t`. Stage lives below the bubble.
const STAGE_TOP = 5;      // first row used by the world floor
const CV_W = 52;
const CV_H = 15;

function walkStep(t) { return (Math.floor(t / 3) % 2) ? 'a' : 'b'; }

function sceneIdle(cv, t, tip) {
    drawBubble(cv, tip.say, tip.cmd ? '$ ' + tip.cmd : null, tip.color);
    const bob = (Math.floor(t / 8) % 2);          // gentle breathing
    const blink = (t % 40) < 2;
    const wave = (t % 60) < 12;                    // occasional wave
    const y = STAGE_TOP + bob;
    cv.sprite(mascot({ blink, armUp: wave }), 6, y);
    cv.sprite(legs('stand'), 6, y + 7);
}

function sceneAuth(cv, t) {
    const stages = [
        ['Knock knock — let me in!', 'gent login'],
        ['New around here?',          'gent register'],
        ['Who am I again?',           'gent whoami'],
    ];
    const idx = Math.floor(t / 34) % stages.length;
    const [say, cmd] = stages[idx];
    drawBubble(cv, say, '$ ' + cmd, C.branchA);
    const blink = (t % 30) < 2;
    const y = STAGE_TOP + (Math.floor(t / 8) % 2);
    // a little door/key on the right
    cv.sprite(['%%%%', '%::%', '%::%', '%%%%'], 34, STAGE_TOP + 1);
    cv.text(34, STAGE_TOP, ' remote', C.cloudSh);
    cv.sprite(mascot({ blink, armUp: (t % 40) < 14 }), 6, y);
    cv.sprite(legs('stand'), 6, y + 7);
}

// PUSH: walk crate right → toss into cloud → walk back. Repeat.
function scenePush(cv, t, state) {
    drawBubble(cv, 'Pushing your commits to the cloud…', '$ gent push', C.ok);
    const cloudX = 40, cloudY = STAGE_TOP;
    cv.sprite(CLOUD, cloudX, cloudY);
    cv.text(cloudX + 2, cloudY + 3, 'remote', C.cloudSh);

    const CYCLE = 66;
    const p = t % CYCLE;
    const my = STAGE_TOP + 1;

    const startX = 4, turnX = 30;
    if (p < 26) {
        // walk out carrying crate
        const mx = startX + Math.round((turnX - startX) * (p / 26));
        cv.sprite(mascot({ blink: (t % 22) < 2 }), mx, my);
        cv.sprite(legs(walkStep(t)), mx, my + 7);
        cv.sprite(CRATE, mx + 14, my + 2);
    } else if (p < 34) {
        // toss: crate flies up-right into the cloud, sparkle
        const k = (p - 26) / 8;
        const bx = Math.round(turnX + 14 + (cloudX - (turnX + 14)) * k);
        const by = Math.round((my + 2) - 3 * k);
        cv.sprite(mascot({ mouth: 'o', armUp: true }), turnX, my);
        cv.sprite(legs('stand'), turnX, my + 7);
        cv.sprite(CRATE, bx, by);
        if (k > 0.6) cv.text(cloudX + 4, cloudY + 1, '*', C.spark);
    } else if (p < 58) {
        // walk back empty-handed
        const mx = turnX - Math.round((turnX - startX) * ((p - 34) / 24));
        cv.sprite(mascot({ blink: (t % 22) < 2 }), mx, my);
        cv.sprite(legs(walkStep(t)), mx, my + 7);
    } else {
        // brief cheer + count up
        if (p === 58) state.count++;
        cv.sprite(mascot({ mouth: 'o', armUp: (p % 4 < 2) }), startX, my);
        cv.sprite(legs('stand'), startX, my + 7);
        cv.text(cloudX + 1, cloudY + 1, '*  *', C.spark);
    }
    cv.text(2, CV_H - 1, `pushed ${state.count} crate${state.count === 1 ? '' : 's'} ✓`, C.ok);
}

// PULL: crate drops from cloud → Genti catches → carries it home.
function scenePull(cv, t, state) {
    drawBubble(cv, 'Pulling the latest from remote…', '$ gent pull', C.branchA);
    const cloudX = 40, cloudY = STAGE_TOP;
    cv.sprite(CLOUD, cloudX, cloudY);
    cv.text(cloudX + 2, cloudY + 3, 'remote', C.cloudSh);

    const CYCLE = 64;
    const p = t % CYCLE;
    const my = STAGE_TOP + 1;
    const homeX = 4, catchX = 30;

    if (p < 10) {
        // Genti walks out to meet the delivery
        const mx = homeX + Math.round((catchX - homeX) * (p / 10));
        cv.sprite(mascot({ blink: (t % 20) < 2 }), mx, my);
        cv.sprite(legs(walkStep(t)), mx, my + 7);
    } else if (p < 20) {
        // crate falls from cloud toward Genti's hands
        const k = (p - 10) / 10;
        const bx = Math.round(cloudX - (cloudX - (catchX + 14)) * k);
        const by = Math.round((cloudY + 2) + ((my + 2) - (cloudY + 2)) * k);
        cv.sprite(mascot({ mouth: 'o', armUp: true }), catchX, my);
        cv.sprite(legs('stand'), catchX, my + 7);
        cv.sprite(CRATE, bx, by);
    } else if (p < 46) {
        // carry it home
        const mx = catchX - Math.round((catchX - homeX) * ((p - 20) / 26));
        cv.sprite(mascot({ blink: (t % 22) < 2 }), mx, my);
        cv.sprite(legs(walkStep(t)), mx, my + 7);
        cv.sprite(CRATE, mx + 14, my + 2);
    } else {
        if (p === 46) state.count++;
        cv.sprite(mascot({ mouth: 'o' }), homeX, my);
        cv.sprite(legs('stand'), homeX, my + 7);
        cv.sprite(CRATE, homeX + 14, my + 2);
        cv.text(homeX + 6, my - 1, '*', C.spark);
    }
    cv.text(2, CV_H - 1, `pulled ${state.count} crate${state.count === 1 ? '' : 's'} ✓`, C.branchA);
}

// MERGE: two branches converge; Genti thinks, then a merge node lights up.
function sceneMerge(cv, t, state) {
    const CYCLE = 70;
    const p = t % CYCLE;
    const thinking = p < 40;
    const dots = '.'.repeat(1 + (Math.floor(t / 5) % 3));
    drawBubble(cv,
        thinking ? `Reconciling two histories${dots}` : 'Merged cleanly — no conflicts!',
        '$ gent merge feature',
        thinking ? C.branchB : C.ok);

    const my = STAGE_TOP + 1;
    const baseY = my + 3;
    // branch A (top) flows down-right, branch B (bottom) flows up-right, meet at node
    const nodeX = 40, nodeY = baseY;
    for (let x = 24; x < nodeX; x++) {
        const ay = baseY - 3 + Math.round((x - 24) / (nodeX - 24) * 3);
        const by = baseY + 3 - Math.round((x - 24) / (nodeX - 24) * 3);
        cv.put(x, ay, '╲'.length ? '╲' : '\\', C.branchA);
        cv.put(x, by, '╱', C.branchB);
    }
    cv.put(23, baseY - 3, '●', C.branchA);
    cv.put(23, baseY + 3, '●', C.branchB);

    if (thinking) {
        // thought bubble ". o O" above head
        cv.text(18, my - 1, '. o O', C.dim);
        cv.sprite(mascot({ mouth: 'o', blink: (t % 16) < 2 }), 6, my);
    } else {
        if (p === 40) state.count++;
        cv.put(nodeX, nodeY, '●', C.node);
        cv.text(nodeX - 1, nodeY - 1, '*', C.spark);
        cv.text(nodeX - 1, nodeY + 1, '*', C.spark);
        cv.sprite(mascot({ mouth: 'o', armUp: (p % 4 < 2) }), 6, my);
    }
    cv.sprite(legs('stand'), 6, my + 7);
    cv.text(2, CV_H - 1, `merges resolved ${state.count} ✓`, C.node);
}

// ── Idle tips (used only by the idle scene) ─────────────────────────────
const TIPS = [
    { say: 'Ready when you are.',                 cmd: 'gent status',   color: C.body },
    { say: 'Publish your work to the cloud.',     cmd: 'gent push',     color: C.ok },
    { say: 'Grab everyone else\'s changes.',      cmd: 'gent pull',     color: C.branchA },
    { say: 'New idea? Branch it.',                cmd: 'gent checkout -b idea', color: C.spark },
    { say: 'Ask me about this repo.',             cmd: 'gent ask "what is this?"', color: C.branchB },
    { say: 'Want a review of your diff?',         cmd: 'gent review',   color: C.node },
    { say: 'Commit small, commit often.',         cmd: 'gent commit -m "wip"', color: C.body },
];

// ── Scene registry ───────────────────────────────────────────────────────
// `cycle` = ticks in one full loop; playing "once" runs exactly one cycle.
const SCENES = {
    idle:  { fn: (cv, t, st) => sceneIdle(cv, t, st.tip), cycle: 66 },
    push:  { fn: scenePush,  cycle: 66 },
    pull:  { fn: scenePull,  cycle: 64 },
    merge: { fn: sceneMerge, cycle: 70 },
    auth:  { fn: (cv, t) => sceneAuth(cv, t), cycle: 102 },
    login: { fn: (cv, t) => sceneAuth(cv, t), cycle: 102 },
};

// ── ANSI helpers ─────────────────────────────────────────────────────────
const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';
const CLEAR_LINE = '\x1b[2K';
const HOME = '\x1b[H';
const ENTER_ALT = '\x1b[?1049h';   // switch to the alternate screen buffer
const LEAVE_ALT = '\x1b[?1049l';   // …and restore the user's scrollback on exit
const up = (n) => `\x1b[${n}A`;

/**
 * Play a scene. Resolves when finished.
 *
 * Two redraw strategies:
 *  - altScreen:true  → take over the whole screen (alternate buffer), redraw
 *    from HOME each frame, restore on exit. Zero scrollback drift. Used by the
 *    standalone `gent pet` command.
 *  - altScreen:false → inline redraw below existing output via cursor-up, so a
 *    command's own text stays visible above. Used by post-command celebrations.
 *
 * @param {string}  sceneName
 * @param {object}  opts
 * @param {boolean} opts.loop       keep looping until Ctrl+C (default: play once)
 * @param {boolean} opts.footer     show the hint line under the stage
 * @param {boolean} opts.goodbye    print a farewell line when done
 * @param {boolean} opts.altScreen  use the alternate screen buffer
 * @returns {Promise<void>}
 */
function runLoop(sceneName, {
    loop = false, footer = true, goodbye = false, altScreen = false,
    maxTicks = Infinity, clearOnStop = false, exitOnSig = false,
} = {}) {
    const scene = SCENES[sceneName] || SCENES.idle;
    const cv = new Canvas(CV_W, CV_H);
    const state = { count: 0, tip: TIPS[Math.floor(Math.random() * TIPS.length)] };
    const totalTicks = loop ? Infinity : Math.min(scene.cycle + 1, maxTicks);
    const blockH = CV_H + (footer ? 1 : 0);
    let t = 0;
    let printed = false;
    let done = false;
    let resolveFn;
    const promise = new Promise((r) => { resolveFn = r; });

    const footerLine = () => footer
        ? chalk.gray('  ') +
          (loop ? chalk.gray('Ctrl+C to cancel') : C.body('Genti')) +
          chalk.gray('   ·   more scenes: ') + C.say('gent pet push|pull|merge')
        : '';

    const paint = () => {
        cv.clear();
        scene.fn(cv, t, state);
        if (sceneName === 'idle' && loop && t > 0 && t % scene.cycle === 0) {
            state.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
        }
        const lines = cv.render().split('\n');
        lines.push(footerLine());
        const block = lines.map(l => CLEAR_LINE + l).join('\n');
        if (altScreen) {
            process.stdout.write(HOME + block);
        } else {
            if (printed) process.stdout.write(up(lines.length));
            process.stdout.write(block + '\n');
        }
        printed = true;
    };

    // Erase the inline block so the caller can print clean output in its place.
    const eraseBlock = () => {
        if (!printed) return;
        process.stdout.write(up(blockH));
        for (let i = 0; i < blockH; i++) process.stdout.write(CLEAR_LINE + (i < blockH - 1 ? '\n' : ''));
        process.stdout.write(up(blockH - 1));
    };

    const stop = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        process.removeListener('SIGINT', onSig);
        if (clearOnStop && !altScreen) eraseBlock();
        process.stdout.write(SHOW + (altScreen ? LEAVE_ALT : ''));
        if (goodbye) {
            console.log(C.body('  Genti waves.') + chalk.gray(' Come back with ') + C.say('gent pet') + chalk.gray('.'));
        }
        resolveFn();
    };

    const onSig = () => { stop(); if (exitOnSig) process.exit(130); };

    process.stdout.write((altScreen ? ENTER_ALT + HOME : '') + HIDE);
    paint();
    const timer = setInterval(() => {
        t++;
        if (t >= totalTicks) { paint(); return stop(); }
        paint();
    }, FRAME_MS);
    process.on('SIGINT', onSig);

    return { promise, stop };
}

// Play a scene to completion (or until Ctrl+C when looping). Resolves when done.
function play(sceneName, opts = {}) {
    return runLoop(sceneName, opts).promise;
}

/**
 * A compact STATIC Genti header — safe to print above an interactive prompt
 * (inquirer, etc.) because it never animates or moves the cursor.
 * @param {string} greeting  bold line beside the mascot
 * @param {string} [sub]     dimmer line under the greeting
 */
function banner(greeting, sub) {
    if (process.env.GENT_NO_PET || !process.stdout.isTTY) return;
    const cv = new Canvas(52, 9);
    cv.sprite(mascot({}), 1, 0);
    cv.sprite(legs('stand'), 1, 7);
    cv.text(18, 2, greeting, C.body);
    if (sub) cv.text(18, 4, sub, C.say);
    console.log('\n' + cv.render());
}

// Static single frame for non-TTY (piped) output.
function still(sceneName) {
    const cv = new Canvas(CV_W, CV_H);
    const state = { count: 1, tip: TIPS[Math.floor(Math.random() * TIPS.length)] };
    (SCENES[sceneName] || SCENES.idle).fn(cv, 12, state);
    console.log(cv.render());
}

// ── Public: standalone `gent pet` command ────────────────────────────────
async function petCommand(scene, options = {}) {
    if (process.env.NO_COLOR || (options && options.color === false)) chalk.level = 0;

    let name = (scene || 'idle').toLowerCase();
    if (!SCENES[name]) {
        console.log(chalk.yellow(`Genti doesn't know the scene "${name}".`));
        console.log(chalk.gray('Try: ') + C.say('gent pet') + chalk.gray(' · ') +
            C.say('push') + chalk.gray(' · ') + C.say('pull') + chalk.gray(' · ') +
            C.say('merge') + chalk.gray(' · ') + C.say('auth'));
        return;
    }

    // Signed-out nudge: bare `gent pet` greets you at the door.
    if (name === 'idle') {
        const authed = await authStorage.isAuthenticated().catch(() => false);
        if (!authed) name = 'auth';
    }

    if (!process.stdout.isTTY) return still(name);
    // Default: play once, on the alternate screen so nothing pollutes scrollback.
    // `--loop` keeps it running until Ctrl+C.
    await play(name, { loop: !!options.loop, footer: true, goodbye: true, altScreen: true });
}

/**
 * Public: a one-shot celebration other commands fire after they succeed.
 * Silent + safe in non-interactive contexts (CI, pipes, GENT_NO_PET=1).
 * Never throws — a mascot must never break a real command.
 */
async function celebrate(scene) {
    try {
        if (!process.stdout.isTTY) return;
        if (process.env.NO_COLOR) { /* still animate, just uncolored */ }
        if (process.env.GENT_NO_PET || process.env.CI) return;
        if (!SCENES[scene]) return;
        console.log(); // one blank line between command output and Genti
        // Auth flows just need a quick friendly wave; action scenes tell a fuller story.
        const maxTicks = (scene === 'auth' || scene === 'login') ? 34 : Infinity;
        await play(scene, { loop: false, footer: false, goodbye: false, maxTicks });
    } catch (_) { /* ignore — decoration only */ }
}

/**
 * Public: run `task` while Genti animates as the live loader — carrying the
 * crate to the cloud on push, home on pull, etc. The animation loops until the
 * task settles, then erases itself so the command can print its own result.
 *
 * Safe + transparent: with no TTY / GENT_NO_PET / CI it simply awaits the task
 * with no animation. Always returns (or throws) exactly what `task` does.
 *
 * @param {string} scene           'push' | 'pull' | 'merge' | …
 * @param {() => Promise<any>} task the real async work (e.g. the network call)
 * @returns {Promise<any>}
 */
async function during(scene, task) {
    if (!process.stdout.isTTY || process.env.GENT_NO_PET || process.env.CI || !SCENES[scene]) {
        return task();
    }
    const anim = runLoop(scene, { loop: true, footer: true, altScreen: false, clearOnStop: true, exitOnSig: true });
    try {
        return await task();
    } finally {
        anim.stop();
        await anim.promise;
    }
}

module.exports = petCommand;
module.exports.celebrate = celebrate;
module.exports.banner = banner;
module.exports.during = during;
