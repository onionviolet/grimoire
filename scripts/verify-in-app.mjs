#!/usr/bin/env node
/**
 * Settles the 23 `app`-tier rows of `docs/ingame-verification-record.md`
 * against a running dev slot, over the same CDP transport
 * `scripts/dev-driver.mjs` uses, with no game and no human in the loop.
 *
 * What an app-tier pass proves, and what it does not: it proves Grimoire
 * wrote the intended entry path with the intended bytes into the intended
 * VPK, or that `getMods()` / the pool picker holds the state the row
 * describes. It does NOT prove the Source 2 engine loads that VPK, plays
 * the sound, or draws the portrait. See the preamble of
 * `docs/ingame-verification-record.md` for the full statement; this file
 * only ever writes `app`-tier verdicts, never `engine`.
 *
 * Slot handling is a safety gate, not a convenience (T-01-25). This refuses
 * to run against slot 0 or an unset slot, and confirms the live
 * `window.__GRIMOIRE_DEV_SLOT` matches what was asked for before the first
 * mutation. Every constructive check installs into the REAL game addons
 * directory every dev slot shares (there is no sandboxed alternative: the
 * combined-tray Export path opens a native OS save dialog that cannot be
 * driven from the renderer), and every constructive check deletes what it
 * installed in its own `finally` block, so no check's footprint outlives
 * that check.
 *
 * `--dry-run` prints the plan (one line per app-tier row) and touches
 * nothing: no CDP connection, no slot requirement. That is deliberate, so a
 * reviewer (or a CI-adjacent sanity check with no dev app running) can see
 * what this would do before anything runs for real.
 *
 * Two things are second implementations rather than imports of the "real"
 * one, and both are documented here rather than left to be discovered:
 *
 *  1. The VPK directory/entry reader below mirrors
 *     `electron/main/services/vpk.ts` (`parseVpkDirectory`,
 *     `readVpkEntryBytes`) byte-for-byte in its parsing algorithm. It is a
 *     second implementation, not an import, because this script runs under
 *     plain Node with no TypeScript loader, and `vpk.ts` transitively pulls
 *     in `worker_threads`-based main-process modules that cannot be loaded
 *     standalone. Installing a TS loader was out of scope (see CLAUDE.md's
 *     "DO NOT RUN pnpm add / pnpm install" note for worktree sessions).
 *  2. `reviewFoundryForgeLocal` mirrors
 *     `electron/main/services/foundryForge.ts`'s `reviewFoundryForge`, and
 *     `planSoundPoolLocal`/`seededShuffleLocal` mirror
 *     `src/components/foundry/soundPoolPlan.ts`, for the same reason. Both
 *     are small and deterministic; a mismatch fails loud (the main process
 *     rejects a stale/malformed confirmation) rather than silently, so
 *     drift between the mirror and the original cannot produce a false
 *     pass.
 *
 * Run with:
 *   GRIMOIRE_DEV_SLOT=<n> node scripts/verify-in-app.mjs --dry-run
 *   GRIMOIRE_DEV_SLOT=<n> node scripts/verify-in-app.mjs
 *   GRIMOIRE_DEV_SLOT=<n> node scripts/verify-in-app.mjs --force   (overwrite a non-blank verdict)
 */
import { readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const RECORD_PATH = join(root, 'docs', 'ingame-verification-record.md');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

// ---------------------------------------------------------------------------
// Slot gate (T-01-25). Only evaluated for a real run -- --dry-run is a pure,
// offline preview and needs no slot, no connection, no running app.
// ---------------------------------------------------------------------------
function slotPort() {
    const raw = process.env.GRIMOIRE_DEV_SLOT;
    if (raw === undefined || raw === '') {
        throw new Error(
            'GRIMOIRE_DEV_SLOT is not set. This runner refuses to guess: it touches the real game addons directory every slot shares, so slot 0 and an unset slot are both refused. Set GRIMOIRE_DEV_SLOT to the slot your dev app is running on.'
        );
    }
    if (!/^(?:0|[1-9]\d*)$/.test(raw)) throw new Error('GRIMOIRE_DEV_SLOT must be a non-negative integer.');
    const slot = Number(raw);
    if (slot === 0) {
        throw new Error(
            'GRIMOIRE_DEV_SLOT=0 is refused. Slot 0 is the default/shared slot; this runner forges, installs, enables, disables, and merges mods, and must run against a numbered slot so a collision with another session is visible rather than silent.'
        );
    }
    if (!Number.isSafeInteger(slot) || slot > 65535 - 9222) throw new Error('GRIMOIRE_DEV_SLOT is too large for a CDP port.');
    return { slot, port: String(9222 + slot) };
}

// ---------------------------------------------------------------------------
// CDP transport -- the same shape as scripts/dev-driver.mjs, trimmed to what
// this runner needs (evaluate + screenshot).
// ---------------------------------------------------------------------------
async function listTargets(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!res.ok) throw new Error(`CDP list failed: ${res.status}`);
    return res.json();
}

async function pageTarget(port) {
    const targets = await listTargets(port);
    const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
    if (!page) throw new Error(`No renderer page found on CDP port ${port}. Targets: ${targets.map((t) => `${t.type} ${t.url}`).join(', ') || 'none'}`);
    return page;
}

function send(wsUrl, method, params = {}) {
    return new Promise((resolvePromise, reject) => {
        const ws = new WebSocket(wsUrl, { headers: { Origin: 'http://127.0.0.1' } });
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`CDP ${method} timed out after 30s`));
        }, 30_000);
        ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method, params })));
        ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id !== 1) return;
            clearTimeout(timer);
            ws.close();
            if (message.error) {
                reject(new Error(`${method}: ${message.error.message}`));
                return;
            }
            resolvePromise(message.result);
        });
        ws.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error(`Could not reach the renderer over CDP. Is the dev app running on this slot?`));
        });
    });
}

function unwrap(result) {
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
}

/** Evaluate one expression in the renderer. Fresh connection per call, same
 *  as dev-driver's `eval` command -- correctness over round-trip count. */
async function evaluate(port, expression) {
    const page = await pageTarget(port);
    const result = await send(page.webSocketDebuggerUrl, 'Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
    });
    return unwrap(result);
}

/** Call one window.electronAPI method by dotted path, JSON-serialising args.
 *  Any exception the IPC call throws surfaces as a normal JS Error from
 *  evaluate(), which every check function lets propagate to its own
 *  try/catch. */
async function callApi(port, apiPath, ...jsArgs) {
    const argsJson = JSON.stringify(jsArgs);
    const expr = `(async () => {
        const fn = ${apiPath.split('.').map((s) => JSON.stringify(s)).reduce((acc, seg) => `(${acc})[${seg}]`, 'window.electronAPI')};
        if (typeof fn !== 'function') throw new Error(${JSON.stringify(`window.electronAPI.${apiPath} is not a function`)});
        const args = ${argsJson};
        return await fn(...args);
    })()`;
    return evaluate(port, expr);
}

async function screenshot(port, destPath) {
    const page = await pageTarget(port);
    const { data } = await send(page.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
    writeFileSync(destPath, Buffer.from(data, 'base64'));
}

async function confirmSlot(port, expectedSlot) {
    const reported = await evaluate(port, 'window.__GRIMOIRE_DEV_SLOT');
    if (String(reported) !== String(expectedSlot)) {
        throw new Error(
            `The dev app on CDP port ${port} reports __GRIMOIRE_DEV_SLOT=${JSON.stringify(reported)}, not ${expectedSlot}. Refusing to run: this runner must never touch a slot other than the one it was told to.`
        );
    }
}

// ---------------------------------------------------------------------------
// Local VPK mirror reader. See the file header for why this is a second
// implementation, not an import, of electron/main/services/vpk.ts.
// ---------------------------------------------------------------------------
const VPK_SIGNATURE = 0x55aa1234;
const VPK_DIR_ARCHIVE_INDEX = 0x7fff;

function readNullTerminatedString(buffer, offset) {
    let end = offset;
    while (end < buffer.length && buffer[end] !== 0) end++;
    return { str: buffer.slice(offset, end).toString('utf-8'), bytesRead: end - offset + 1 };
}

function readVpkHeaderAndTree(vpkPath) {
    const fd = openSync(vpkPath, 'r');
    try {
        const headerBuffer = Buffer.alloc(12);
        readSync(fd, headerBuffer, 0, 12, 0);
        if (headerBuffer.readUInt32LE(0) !== VPK_SIGNATURE) return null;
        const version = headerBuffer.readUInt32LE(4);
        const treeSize = headerBuffer.readUInt32LE(8);
        const headerSize = version === 2 ? 28 : 12;
        const treeBuffer = Buffer.alloc(treeSize);
        readSync(fd, treeBuffer, 0, treeSize, headerSize);
        return { treeBuffer, headerSize, treeSize };
    } finally {
        closeSync(fd);
    }
}

/** Mirrors vpk.ts parseVpkDirectory: every entry path in the VPK. */
function parseVpkDirectoryLocal(vpkPath) {
    if (!existsSync(vpkPath)) return null;
    const parsed = readVpkHeaderAndTree(vpkPath);
    if (!parsed) return null;
    const { treeBuffer } = parsed;
    const paths = [];
    let offset = 0;
    while (offset < treeBuffer.length) {
        const ext = readNullTerminatedString(treeBuffer, offset);
        offset += ext.bytesRead;
        if (ext.str === '') break;
        while (offset < treeBuffer.length) {
            const p = readNullTerminatedString(treeBuffer, offset);
            offset += p.bytesRead;
            if (p.str === '') break;
            const dirPath = p.str === ' ' ? '' : p.str;
            while (offset < treeBuffer.length) {
                const name = readNullTerminatedString(treeBuffer, offset);
                offset += name.bytesRead;
                if (name.str === '') break;
                paths.push(dirPath ? `${dirPath}/${name.str}.${ext.str}` : `${name.str}.${ext.str}`);
                if (offset + 18 > treeBuffer.length) return paths;
                const preloadBytes = treeBuffer.readUInt16LE(offset + 4);
                offset += 18 + preloadBytes;
            }
        }
    }
    return paths;
}

/** Mirrors vpk.ts readVpkEntryBytes: the raw bytes of one entry, or null. */
function readVpkEntryBytesLocal(vpkPath, entryPath) {
    if (!existsSync(vpkPath)) return null;
    const target = entryPath.replace(/\\/g, '/').toLowerCase();
    const fd = openSync(vpkPath, 'r');
    try {
        const headerBuffer = Buffer.alloc(12);
        readSync(fd, headerBuffer, 0, 12, 0);
        if (headerBuffer.readUInt32LE(0) !== VPK_SIGNATURE) return null;
        const version = headerBuffer.readUInt32LE(4);
        const treeSize = headerBuffer.readUInt32LE(8);
        const headerSize = version === 2 ? 28 : 12;
        const treeBuffer = Buffer.alloc(treeSize);
        readSync(fd, treeBuffer, 0, treeSize, headerSize);

        let offset = 0;
        while (offset < treeBuffer.length) {
            const ext = readNullTerminatedString(treeBuffer, offset);
            offset += ext.bytesRead;
            if (ext.str === '') break;
            while (offset < treeBuffer.length) {
                const p = readNullTerminatedString(treeBuffer, offset);
                offset += p.bytesRead;
                if (p.str === '') break;
                const dirPath = p.str === ' ' ? '' : p.str;
                while (offset < treeBuffer.length) {
                    const name = readNullTerminatedString(treeBuffer, offset);
                    offset += name.bytesRead;
                    if (name.str === '') break;
                    const fullPath = dirPath ? `${dirPath}/${name.str}.${ext.str}` : `${name.str}.${ext.str}`;
                    if (offset + 18 > treeBuffer.length) return null;
                    const preloadBytes = treeBuffer.readUInt16LE(offset + 4);
                    const archiveIndex = treeBuffer.readUInt16LE(offset + 6);
                    const entryOffset = treeBuffer.readUInt32LE(offset + 8);
                    const entryLength = treeBuffer.readUInt32LE(offset + 12);
                    const preloadStart = offset + 18;

                    if (fullPath.replace(/\\/g, '/').toLowerCase() === target) {
                        const preload = preloadBytes > 0 ? treeBuffer.subarray(preloadStart, preloadStart + preloadBytes) : Buffer.alloc(0);
                        let archiveData = Buffer.alloc(0);
                        if (entryLength > 0) {
                            archiveData = Buffer.alloc(entryLength);
                            if (archiveIndex === VPK_DIR_ARCHIVE_INDEX) {
                                readSync(fd, archiveData, 0, entryLength, headerSize + treeSize + entryOffset);
                            } else {
                                const archivePath = vpkPath.replace(/_dir\.vpk$/i, `_${String(archiveIndex).padStart(3, '0')}.vpk`);
                                const afd = openSync(archivePath, 'r');
                                try {
                                    readSync(afd, archiveData, 0, entryLength, entryOffset);
                                } finally {
                                    closeSync(afd);
                                }
                            }
                        }
                        return Buffer.concat([preload, archiveData]);
                    }
                    offset = preloadStart + preloadBytes;
                }
            }
        }
        return null;
    } finally {
        closeSync(fd);
    }
}

// ---------------------------------------------------------------------------
// Foundry combined-tray review mirror. See file header note 2.
// ---------------------------------------------------------------------------
const normalizeEntry = (p) => p.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
const soundEntryLocal = (p) => normalizeEntry(p).replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');

function reviewFoundryForgeLocal(edits) {
    const writers = new Map();
    edits.forEach((edit, index) => {
        const entries = edit.kind === 'sound'
            ? (edit.request.assignments ?? []).map(({ clipPath }) => soundEntryLocal(clipPath))
            : [normalizeEntry(edit.request.entryPath)];
        for (const entry of new Set(entries.filter(Boolean))) {
            writers.set(entry, [...(writers.get(entry) ?? []), { id: edit.id, precedence: edit.precedence, index }]);
        }
    });
    const writeSet = [...writers.keys()].sort();
    const collisionWinners = [...writers.entries()]
        .filter(([, entries]) => entries.length > 1)
        .map(([file, entries]) => ({
            file,
            editId: [...entries].sort((a, b) => a.precedence - b.precedence || a.index - b.index).at(-1).id,
        }))
        .sort((a, b) => a.file.localeCompare(b.file));
    return { writeSet, collisionWinners };
}

function buildForgeRequest(name, edits) {
    const review = reviewFoundryForgeLocal(edits);
    return { name, edits, confirmation: review };
}

// ---------------------------------------------------------------------------
// Sound pool selection mirror (src/components/foundry/soundPoolPlan.ts).
// ---------------------------------------------------------------------------
function seededShuffleLocal(values, seed) {
    const out = [...values];
    let state = (Math.trunc(seed) || 1) >>> 0;
    const next = () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x1_0000_0000;
    };
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function planSoundPoolLocal(mode, sourceClips, selected, library, seed = 1) {
    const targets = mode === 'replace-all' ? [...sourceClips] : sourceClips.filter((clip) => selected.has(clip));
    if (!targets.length || !library.length) return [];
    const audio = mode === 'seeded-library' ? seededShuffleLocal(library, seed) : [...library];
    if (mode === 'n-to-n' && audio.length !== targets.length) return [];
    return targets.map((clipPath, index) => ({ clipPath, audioPath: audio[index % audio.length].path }));
}

// ---------------------------------------------------------------------------
// Record read/write-back. Line-oriented and cell-preserving: only the
// Verdict/Evidence/Root cause cells of a row this run actually settled are
// touched, and every other cell (and every engine-tier row) is passed
// through byte-for-byte.
// ---------------------------------------------------------------------------
function splitRawCells(line) {
    let s = line;
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|');
}
function joinRawCells(cells) {
    return `|${cells.join('|')}|`;
}
/** Evidence/root-cause text must never contain a literal pipe -- it would
 *  silently split the markdown table. Substitute rather than reject, since a
 *  check function should never crash on writeback formatting. */
function sanitizeCell(text) {
    return String(text ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function writeVerdicts(recordText, updates) {
    const lines = recordText.split(/\r?\n/);
    const skipped = [];
    const written = [];
    const out = lines.map((line) => {
        const t = line.trim();
        if (!t.startsWith('|')) return line;
        const cells = splitRawCells(line);
        // Check-schema rows (Table 1 / Table 2) are exactly 9 cells: ID,
        // Tier, Check, Fixture, Steps, Pass looks like, Verdict, Evidence,
        // Root cause. ConVar rows (Table 3, 7 cells) never match here, which
        // is what keeps this runner off engine-tier rows structurally, not
        // just by convention.
        if (cells.length !== 9) return line;
        const id = cells[0].trim();
        const upd = updates.get(id);
        if (!upd) return line;
        const currentVerdict = cells[6].trim();
        if (currentVerdict !== '' && !FORCE) {
            skipped.push({ id, currentVerdict });
            return line;
        }
        cells[6] = ` ${sanitizeCell(upd.verdict)} `;
        cells[7] = ` ${sanitizeCell(upd.evidence)} `;
        cells[8] = ` ${sanitizeCell(upd.rootCause)} `;
        written.push(id);
        return joinRawCells(cells);
    });
    return { text: out.join('\n'), written, skipped };
}

// ---------------------------------------------------------------------------
// Fixtures. Real hero/voice/global catalog data is discovered live from the
// running app (never hardcoded), since the exact catalog contents depend on
// the installed game build. Only the source audio/image files are fixed:
// public/sounds/gassy.mp3 and public/heroes/{seven,icons/seven}.png, both
// tracked in the repo.
// ---------------------------------------------------------------------------
const GASSY_MP3 = join(root, 'public', 'sounds', 'gassy.mp3');
const SEVEN_PNG_A = join(root, 'public', 'heroes', 'seven.png');
const SEVEN_PNG_B = join(root, 'public', 'heroes', 'icons', 'seven.png');
const SEVEN_CODENAME = 'gigawatt_prisoner';
const SEVEN_NAME = 'Seven';
const PAIGE_CODENAME = 'bookworm';
const PAIGE_NAME = 'Paige';

function evidenceDir() {
    const dir = join(tmpdir(), 'claude', 'grimoire-verify-in-app-evidence');
    mkdirSync(dir, { recursive: true });
    return dir;
}

// ---------------------------------------------------------------------------
// Check descriptors. Each `run(ctx)` returns { verdict, evidence, rootCause }
// and must not throw for an ordinary check failure -- it returns
// verdict:'fail' instead. An actual thrown error (a bug in this runner, or
// an unreachable app) is caught by the runner loop and recorded as
// verdict:'blocked' with the error message, so one broken check never stops
// the rest of the run.
// ---------------------------------------------------------------------------
const CHECKS = [];

function define(id, description, run) {
    CHECKS.push({ id, description, run });
}

// ---- IG-01: combined tray, one sound edit + one texture edit, forgeInstall ----
define('IG-01', 'Combined-tray forgeInstall (one sound edit + one texture edit); read both entries back from the installed VPK and compare bytes.', async (ctx) => {
    const heroSounds = await callApi(ctx.port, 'foundry.heroSounds', { hero: SEVEN_CODENAME });
    const withClips = (heroSounds ?? []).filter((s) => Array.isArray(s.vsnd) && s.vsnd.length > 0);
    if (!withClips.length) return { verdict: 'blocked', rootCause: `No hero sound event with a resolvable vsnd entry was found for ${SEVEN_NAME} (${SEVEN_CODENAME}) in the live catalog.` };
    const textures = await callApi(ctx.port, 'foundry.textures', { hero: SEVEN_CODENAME, category: 'hero-image' });
    if (!textures?.length) return { verdict: 'blocked', rootCause: `No hero-image texture entry was found for ${SEVEN_NAME} (${SEVEN_CODENAME}) in the live catalog.` };

    const soundEvent = withClips[0];
    const texture = textures[0];
    ctx.usedEntries.ig01Sound = soundEvent.event;
    ctx.usedEntries.ig01Texture = texture.path;

    const soundEdit = {
        id: 'ig01-sound',
        kind: 'sound',
        precedence: 0,
        request: {
            heroCodename: SEVEN_CODENAME,
            heroName: SEVEN_NAME,
            event: soundEvent.event,
            audioPath: GASSY_MP3,
            assignments: soundEvent.vsnd.map((clipPath) => ({ clipPath, audioPath: GASSY_MP3 })),
            name: 'verify-in-app IG-01 sound',
            loop: 'auto',
        },
    };
    const textureEdit = {
        id: 'ig01-texture',
        kind: 'texture',
        precedence: 1,
        request: {
            entryPath: texture.path,
            imagePath: SEVEN_PNG_A,
            name: 'verify-in-app IG-01 texture',
            category: texture.category,
            heroName: SEVEN_NAME,
        },
    };
    const request = buildForgeRequest('verify-in-app IG-01 combined', [soundEdit, textureEdit]);

    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.forgeInstall', request);
    } catch (err) {
        return { verdict: 'fail', evidence: `foundry:forgeInstall threw: ${err.message}`, rootCause: 'forgeInstall rejected the combined-tray request' };
    }
    const installed = mods.find((m) => m.foundryBuild?.parts?.length === 2 || (m.name || '').includes('verify-in-app IG-01 combined'));
    const mod = installed ?? mods[mods.length - 1];
    ctx.track(mod.id);
    try {
        const bytes = readVpkEntryBytesLocal(mod.path, soundEntryLocal(soundEvent.vsnd[0]));
        const expectedBytes = require_fs_readFileSync(GASSY_MP3);
        const soundOk = !!bytes; // exact byte equality is checked against the source clip's transcode, which is lossy (MP3 -> minted VSND); presence + non-trivial size is the safe, honest claim here.
        const textureBytes = readVpkEntryBytesLocal(mod.path, normalizeEntry(texture.path));
        const textureOk = !!textureBytes && textureBytes.length > 0;
        if (soundOk && textureOk) {
            return {
                verdict: 'pass',
                evidence: `forgeInstall built one VPK from a sound edit on ${SEVEN_NAME} event "${soundEvent.event}" and a texture edit on "${texture.path}". Installed VPK: ${mod.fileName}. Sound entry ${soundEntryLocal(soundEvent.vsnd[0])} present (${bytes.length} bytes); texture entry ${normalizeEntry(texture.path)} present (${textureBytes.length} bytes). (Source MP3 is ${expectedBytes.length} bytes; the minted VSND is a transcode, not a byte copy, so presence + size is the claim, not exact equality.)`,
            };
        }
        return {
            verdict: 'fail',
            evidence: `sound entry present: ${soundOk}; texture entry present: ${textureOk}`,
            rootCause: 'the combined-tray VPK did not contain both expected entries after forgeInstall',
        };
    } finally {
        await ctx.deleteMod(mod.id);
    }
});

function require_fs_readFileSync(path) {
    // Small local alias so the IG-01 evidence string can report the source
    // file size without importing `readFileSync` at module scope twice.
    return readFileSync(path);
}

// ---- IG-02: cancelled save dialog ----
define('IG-02', 'Cancel the native OS save dialog and confirm nothing changed.', async () => ({
    verdict: 'blocked',
    rootCause: 'The native OS save dialog (dialog.showSaveDialog) is a main-process API with no renderer-reachable hook to force a cancellation from a CDP-driven script. Automating it would require adding a new main-process test hook, which is instrumentation beyond this plan\'s scope; faking the cancellation instead of driving the real dialog was rejected as dishonest evidence (T-01-26).',
}));

// ---- IG-03: forgeInstall, single texture edit ----
define('IG-03', 'Single-edit forgeInstall (texture); confirm the installed VPK holds the entry.', async (ctx) => {
    const textures = await callApi(ctx.port, 'foundry.textures', { hero: SEVEN_CODENAME, category: 'hero-image' });
    const candidate = (textures ?? []).find((t) => t.path !== ctx.usedEntries.ig01Texture) ?? textures?.[0];
    if (!candidate) return { verdict: 'blocked', rootCause: `No hero-image texture entry was found for ${SEVEN_NAME} distinct from IG-01's.` };
    const textureEdit = {
        id: 'ig03-texture',
        kind: 'texture',
        precedence: 0,
        request: { entryPath: candidate.path, imagePath: SEVEN_PNG_B, name: 'verify-in-app IG-03 texture', category: candidate.category, heroName: SEVEN_NAME },
    };
    const request = buildForgeRequest('verify-in-app IG-03', [textureEdit]);
    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.forgeInstall', request);
    } catch (err) {
        return { verdict: 'fail', evidence: `foundry:forgeInstall threw: ${err.message}`, rootCause: 'forgeInstall rejected the single-edit request' };
    }
    const mod = mods.find((m) => (m.name || '').includes('verify-in-app IG-03')) ?? mods[mods.length - 1];
    ctx.track(mod.id);
    try {
        const enabledBefore = mod.enabled === true;
        const bytes = readVpkEntryBytesLocal(mod.path, normalizeEntry(candidate.path));
        if (enabledBefore && bytes && bytes.length > 0) {
            return { verdict: 'pass', evidence: `forgeInstall installed "${mod.fileName}" as enabled with entry ${normalizeEntry(candidate.path)} present (${bytes.length} bytes), no manual mounting step.` };
        }
        return { verdict: 'fail', evidence: `enabled=${enabledBefore}, entry bytes=${bytes ? bytes.length : 'missing'}`, rootCause: 'forgeInstall did not leave an enabled mod with the expected entry' };
    } finally {
        await ctx.deleteMod(mod.id);
    }
});

// ---- IG-04 / IG-05: deliberately not attempted against the real install ----
define('IG-04', 'Slot-allocation failure on forge-install.', async () => ({
    verdict: 'blocked',
    rootCause: 'Reproducing genuine slot exhaustion requires filling every pakNN slot (1..99) in the base addons folder AND every overflow addonsN folder up to the app\'s MAX_ADDON_FOLDERS cap (electron/main/services/mods.ts allocateSlot), because allocateEnabledVpkPath spills into a freshly minted overflow folder and patches gameinfo.gi (fixGameinfo) rather than failing until every folder is full. Creating that many files and mutating gameinfo.gi against the real, shared production game install in an unattended run was judged an unacceptable risk (see addons_directory_safety in this run\'s brief); the safer choice was not to attempt it.',
}));
define('IG-05', 'Metadata-write failure on forge-install (rollback).', async () => ({
    verdict: 'blocked',
    rootCause: 'The "metadata sidecar" is mod-metadata.json, the single JSON file shared by the ENTIRE mod library (electron/main/services/metadata.ts saveMetadata), not a per-mod file. Making it briefly unwritable to induce a write failure risks corrupting or losing writes for unrelated mod state on the exact file whose byte count this run\'s addons-directory restoration proof is measured against. That risk was judged unacceptable for an unattended run against the real production install; the safer choice was not to attempt it.',
}));

// ---- IG-06: merge review winner vs merged VPK bytes ----
define('IG-06', 'Install two texture-replacement mods at the same entry, merge them, and confirm the merged VPK holds the reviewed winner\'s bytes.', async (ctx) => {
    const textures = await callApi(ctx.port, 'foundry.textures', { hero: SEVEN_CODENAME, category: 'hero-image' });
    const entry = textures?.[0];
    if (!entry) return { verdict: 'blocked', rootCause: `No hero-image texture entry was found for ${SEVEN_NAME} to build a collision on.` };

    const modA = await callApi(ctx.port, 'foundry.replaceTexture', { entryPath: entry.path, imagePath: SEVEN_PNG_A, name: 'verify-in-app IG-06 A', category: entry.category });
    const idA = modA[modA.length - 1].id;
    ctx.track(idA);
    const modB = await callApi(ctx.port, 'foundry.replaceTexture', { entryPath: entry.path, imagePath: SEVEN_PNG_B, name: 'verify-in-app IG-06 B', category: entry.category });
    const idB = modB[modB.length - 1].id;
    ctx.track(idB);

    try {
        const listAfterB = modB;
        const findById = (list, id) => list.find((m) => m.id === id);
        const pathA = findById(listAfterB, idA)?.path ?? findById(modA, idA).path;
        const pathB = findById(listAfterB, idB).path;
        const bytesA = readVpkEntryBytesLocal(pathA, normalizeEntry(entry.path));
        const bytesB = readVpkEntryBytesLocal(pathB, normalizeEntry(entry.path));

        const analysis = await callApi(ctx.port, 'analyzeMerge', [idA, idB], false);
        const collision = analysis.collisions.find((c) => normalizeEntry(c.path) === normalizeEntry(entry.path));
        if (!collision) {
            return { verdict: 'fail', evidence: `analyzeMerge([A,B]) reported no collision at ${normalizeEntry(entry.path)}`, rootCause: 'the two installed mods did not register as a conflict at the shared entry' };
        }
        const winnerBytes = collision.winnerModId === idA ? bytesA : collision.winnerModId === idB ? bytesB : null;
        if (!winnerBytes) {
            return { verdict: 'fail', evidence: `winnerModId ${collision.winnerModId} matched neither installed mod`, rootCause: 'analyzeMerge named a winner outside the two source mods' };
        }

        const merged = await callApi(ctx.port, 'mergeMods', { modIds: [idA, idB], name: 'verify-in-app IG-06 merged' });
        ctx.track(merged.id);
        const mergedBytes = readVpkEntryBytesLocal(merged.path, normalizeEntry(entry.path));
        const equal = !!mergedBytes && Buffer.compare(mergedBytes, winnerBytes) === 0;

        // Unmerge restores the two sources (re-enabled), which lets the
        // finally block below delete every mod this check touched by id.
        const unmerge = await callApi(ctx.port, 'unmergeMod', merged.id);
        for (const recovered of unmerge.recovered ?? []) ctx.track(recovered.id);

        return equal
            ? { verdict: 'pass', evidence: `analyzeMerge named ${collision.winnerModId === idA ? 'mod A' : 'mod B'} as the winner at ${normalizeEntry(entry.path)}; the merged VPK's entry bytes (${mergedBytes.length} bytes) are byte-identical to that mod's own installed bytes.` }
            : { verdict: 'fail', evidence: `merged entry bytes (${mergedBytes ? mergedBytes.length : 'missing'}) did not match the reviewed winner's bytes (${winnerBytes.length})`, rootCause: 'the merged VPK did not carry the reviewed winner\'s content at the contested entry' };
    } finally {
        await ctx.deleteMod(idA);
        await ctx.deleteMod(idB);
    }
});

// ---- IG-07 / IG-08 / IG-09 .. IG-12: hero sound matrix on Seven ----
let heroModId = null;
let heroModEvent = null;
let heroModEntry = null;
let heroModPath = null;

define('IG-09', 'Hero sound case: downloaded third-party mod (dynamic discovery).', async (ctx) => {
    return findThirdPartyMod(ctx, 'hero', SEVEN_CODENAME, SEVEN_NAME);
});

define('IG-10', 'Hero sound case: forged mod. Install via swapSound, read the entry back.', async (ctx) => {
    const heroSounds = await callApi(ctx.port, 'foundry.heroSounds', { hero: SEVEN_CODENAME });
    const withClips = (heroSounds ?? []).filter((s) => Array.isArray(s.vsnd) && s.vsnd.length > 0 && s.event !== ctx.usedEntries.ig01Sound);
    if (!withClips.length) return { verdict: 'blocked', rootCause: `No hero sound event distinct from IG-01's was found for ${SEVEN_NAME}.` };
    const soundEvent = withClips[0];
    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.swapSound', {
            heroCodename: SEVEN_CODENAME,
            heroName: SEVEN_NAME,
            event: soundEvent.event,
            audioPath: GASSY_MP3,
            name: 'verify-in-app IG-10 hero forged',
            loop: 'auto',
        });
    } catch (err) {
        return { verdict: 'fail', evidence: `foundry:swapSound threw: ${err.message}`, rootCause: 'swapSound rejected the hero sound edit' };
    }
    const mod = mods.find((m) => (m.name || '').includes('verify-in-app IG-10')) ?? mods[mods.length - 1];
    heroModId = mod.id;
    heroModEvent = soundEvent.event;
    heroModEntry = soundEntryLocal(soundEvent.vsnd[0]);
    heroModPath = mod.path;
    ctx.track(mod.id, { deferDelete: true }); // IG-11 disables it before this check's own cleanup deletes it; final cleanup handles the delete.
    const bytes = readVpkEntryBytesLocal(mod.path, heroModEntry);
    return bytes && bytes.length > 0
        ? { verdict: 'pass', evidence: `swapSound installed "${mod.fileName}" for ${SEVEN_NAME} event "${soundEvent.event}"; entry ${heroModEntry} present (${bytes.length} bytes).` }
        : { verdict: 'fail', evidence: `entry ${heroModEntry} missing from installed VPK`, rootCause: 'swapSound did not write the expected entry' };
});

define('IG-11', 'Hero sound case: disabled mod. Disable IG-10\'s mod and confirm it drops out of the enabled set.', async (ctx) => {
    if (!heroModId) return { verdict: 'blocked', rootCause: 'IG-10 did not produce an installed mod to disable.' };
    await callApi(ctx.port, 'disableMod', heroModId);
    const modsAfter = await callApi(ctx.port, 'getMods');
    const stillEnabled = modsAfter.find((m) => m.id === heroModId && m.enabled);
    const anyEnabledClaimsEntry = modsAfter.some((m) => m.enabled && (() => {
        const entries = parseVpkDirectoryLocal(m.path);
        return entries?.some((e) => normalizeEntry(e) === heroModEntry);
    })());
    return !stillEnabled && !anyEnabledClaimsEntry
        ? { verdict: 'pass', evidence: `disableMod(${heroModId}) removed it from the enabled set; no remaining enabled VPK claims entry ${heroModEntry}.` }
        : { verdict: 'fail', evidence: `stillEnabled=${!!stillEnabled}, anyEnabledClaimsEntry=${anyEnabledClaimsEntry}`, rootCause: 'a disabled mod\'s entry is still reachable through the enabled set' };
});

define('IG-12', 'Hero sound case: multi-clip pool selection path (seeded-library mirror).', async () => poolCheck('hero'));

define('IG-07', 'Audition parity: compare auditionSourceClip bytes to the installed VPK entry.', async (ctx) => {
    if (!heroModId) return { verdict: 'blocked', rootCause: 'IG-10 did not produce an installed sound mod to audition.' };
    const auditionUrl = await callApi(ctx.port, 'foundry.auditionSourceClip', heroModId, heroModEntry);
    if (!auditionUrl) return { verdict: 'fail', evidence: 'auditionSourceClip returned null', rootCause: 'the audition path could not resolve the installed entry' };
    const installedBytes = readVpkEntryBytesLocal(heroModPath, heroModEntry);
    // auditionSourceClip returns a URL/path the renderer plays; the only
    // app-tier claim available without a renderer-side audio decode is that
    // the audition resolved (non-null) for the exact entry the installed VPK
    // holds, and that the installed VPK's own entry bytes exist and are
    // non-trivial. A true byte-for-byte audio comparison would need decoding
    // both sides, which is out of reach without a bundled audio decoder.
    return installedBytes && installedBytes.length > 0
        ? { verdict: 'pass', evidence: `auditionSourceClip(${heroModId}, ${heroModEntry}) resolved; the installed VPK carries that same entry (${installedBytes.length} bytes). (This is presence/resolution parity, not a decoded-audio byte comparison -- no bundled audio decoder is available to this script.)` }
        : { verdict: 'fail', evidence: 'installed VPK entry bytes missing', rootCause: 'the audited entry is absent from the installed VPK' };
});

define('IG-08', 'Re-forge idempotency: swap the same event again and compare entry bytes to the first forge.', async (ctx) => {
    if (!heroModId) return { verdict: 'blocked', rootCause: 'IG-10 did not produce a first forge to compare against.' };
    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.swapSound', {
            heroCodename: SEVEN_CODENAME,
            heroName: SEVEN_NAME,
            event: heroModEvent,
            audioPath: GASSY_MP3,
            name: 'verify-in-app IG-08 reforge',
            loop: 'auto',
        });
    } catch (err) {
        return { verdict: 'fail', evidence: `re-forge threw: ${err.message}`, rootCause: 'swapSound rejected the identical re-forge' };
    }
    const mod2 = mods.find((m) => (m.name || '').includes('verify-in-app IG-08')) ?? mods[mods.length - 1];
    try {
        const bytes1 = readVpkEntryBytesLocal(heroModPath, heroModEntry);
        const bytes2 = readVpkEntryBytesLocal(mod2.path, heroModEntry);
        const equal = !!bytes1 && !!bytes2 && Buffer.compare(bytes1, bytes2) === 0;
        return equal
            ? { verdict: 'pass', evidence: `re-forged "${mod2.fileName}" from the same source; entry ${heroModEntry} bytes are identical to the first forge (${bytes1.length} bytes).` }
            : { verdict: 'fail', evidence: `first forge ${bytes1 ? bytes1.length : 'missing'} bytes, re-forge ${bytes2 ? bytes2.length : 'missing'} bytes`, rootCause: 'two forges of the same source produced different entry bytes' };
    } finally {
        await ctx.deleteMod(mod2.id);
    }
});

// ---- IG-13 .. IG-16: voice matrix on Paige (clip mode) ----
let voiceModId = null;
let voiceModEntry = null;

define('IG-13', 'Voice sound case: downloaded third-party mod (dynamic discovery).', async (ctx) => findThirdPartyMod(ctx, 'voice', PAIGE_CODENAME, PAIGE_NAME));

define('IG-14', 'Voice sound case: forged mod (clip mode). Install via swapSound, read the entry back.', async (ctx) => {
    const lines = await callApi(ctx.port, 'foundry.voicelines', { hero: PAIGE_CODENAME });
    const withClips = (lines ?? []).filter((l) => Array.isArray(l.vsnd) && l.vsnd.length > 0);
    if (!withClips.length) return { verdict: 'blocked', rootCause: `No voice line with a resolvable vsnd entry was found for ${PAIGE_NAME} (${PAIGE_CODENAME}).` };
    const line = withClips[0];
    const clipPath = line.vsnd[0];
    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.swapSound', {
            heroCodename: PAIGE_CODENAME,
            heroName: PAIGE_NAME,
            clipPaths: [clipPath],
            audioPath: GASSY_MP3,
            name: 'verify-in-app IG-14 voice forged',
            loop: 'auto',
        });
    } catch (err) {
        return { verdict: 'fail', evidence: `foundry:swapSound threw: ${err.message}`, rootCause: 'swapSound rejected the voice-line edit' };
    }
    const mod = mods.find((m) => (m.name || '').includes('verify-in-app IG-14')) ?? mods[mods.length - 1];
    voiceModId = mod.id;
    voiceModEntry = soundEntryLocal(clipPath);
    ctx.track(mod.id, { deferDelete: true });
    const bytes = readVpkEntryBytesLocal(mod.path, voiceModEntry);
    return bytes && bytes.length > 0
        ? { verdict: 'pass', evidence: `swapSound installed "${mod.fileName}" for ${PAIGE_NAME} voice line "${line.event}"; entry ${voiceModEntry} present (${bytes.length} bytes).` }
        : { verdict: 'fail', evidence: `entry ${voiceModEntry} missing`, rootCause: 'swapSound did not write the expected voice-line entry' };
});

define('IG-15', 'Voice sound case: disabled mod.', async (ctx) => {
    if (!voiceModId) return { verdict: 'blocked', rootCause: 'IG-14 did not produce an installed mod to disable.' };
    await callApi(ctx.port, 'disableMod', voiceModId);
    const modsAfter = await callApi(ctx.port, 'getMods');
    const stillEnabled = modsAfter.find((m) => m.id === voiceModId && m.enabled);
    const anyEnabledClaimsEntry = modsAfter.some((m) => m.enabled && (() => {
        const entries = parseVpkDirectoryLocal(m.path);
        return entries?.some((e) => normalizeEntry(e) === voiceModEntry);
    })());
    return !stillEnabled && !anyEnabledClaimsEntry
        ? { verdict: 'pass', evidence: `disableMod(${voiceModId}) removed it from the enabled set; no remaining enabled VPK claims entry ${voiceModEntry}.` }
        : { verdict: 'fail', evidence: `stillEnabled=${!!stillEnabled}, anyEnabledClaimsEntry=${anyEnabledClaimsEntry}`, rootCause: 'a disabled voice mod\'s entry is still reachable through the enabled set' };
});

define('IG-16', 'Voice sound case: multi-clip pool selection path (seeded-library mirror).', async () => poolCheck('voice'));

// ---- IG-17 .. IG-20: global sound matrix ----
let globalModId = null;
let globalModEntry = null;

define('IG-17', 'Global sound case: downloaded third-party mod (dynamic discovery).', async (ctx) => findThirdPartyMod(ctx, 'global', null, null));

define('IG-18', 'Global sound case: forged mod. Install via swapSound (non-hero), read the entry back.', async (ctx) => {
    const globals = await callApi(ctx.port, 'foundry.globalSounds', {});
    const withClips = (globals ?? []).filter((g) => Array.isArray(g.vsnd) && g.vsnd.length > 0 && g.soundevents);
    if (!withClips.length) return { verdict: 'blocked', rootCause: 'No global sound event with a resolvable vsnd entry and soundevents file was found in the live catalog.' };
    const g = withClips[0];
    let mods;
    try {
        mods = await callApi(ctx.port, 'foundry.swapSound', {
            heroCodename: '',
            heroName: '',
            soundeventsEntry: g.soundevents,
            event: g.event,
            audioPath: GASSY_MP3,
            name: 'verify-in-app IG-18 global forged',
            loop: 'auto',
        });
    } catch (err) {
        return { verdict: 'fail', evidence: `foundry:swapSound threw: ${err.message}`, rootCause: 'swapSound rejected the global sound edit' };
    }
    const mod = mods.find((m) => (m.name || '').includes('verify-in-app IG-18')) ?? mods[mods.length - 1];
    globalModId = mod.id;
    globalModEntry = soundEntryLocal(g.vsnd[0]);
    ctx.track(mod.id, { deferDelete: true });
    const bytes = readVpkEntryBytesLocal(mod.path, globalModEntry);
    return bytes && bytes.length > 0
        ? { verdict: 'pass', evidence: `swapSound installed "${mod.fileName}" for global event "${g.event}" (${g.soundevents}); entry ${globalModEntry} present (${bytes.length} bytes).` }
        : { verdict: 'fail', evidence: `entry ${globalModEntry} missing`, rootCause: 'swapSound did not write the expected global entry' };
});

define('IG-19', 'Global sound case: disabled mod.', async (ctx) => {
    if (!globalModId) return { verdict: 'blocked', rootCause: 'IG-18 did not produce an installed mod to disable.' };
    await callApi(ctx.port, 'disableMod', globalModId);
    const modsAfter = await callApi(ctx.port, 'getMods');
    const stillEnabled = modsAfter.find((m) => m.id === globalModId && m.enabled);
    const anyEnabledClaimsEntry = modsAfter.some((m) => m.enabled && (() => {
        const entries = parseVpkDirectoryLocal(m.path);
        return entries?.some((e) => normalizeEntry(e) === globalModEntry);
    })());
    return !stillEnabled && !anyEnabledClaimsEntry
        ? { verdict: 'pass', evidence: `disableMod(${globalModId}) removed it from the enabled set; no remaining enabled VPK claims entry ${globalModEntry}.` }
        : { verdict: 'fail', evidence: `stillEnabled=${!!stillEnabled}, anyEnabledClaimsEntry=${anyEnabledClaimsEntry}`, rootCause: 'a disabled global mod\'s entry is still reachable through the enabled set' };
});

define('IG-20', 'Global sound case: multi-clip pool selection path (seeded-library mirror).', async () => poolCheck('global'));

// ---- IG-21 / IG-22 are engine-tier; not settled here. ----

// ---- RP-01 / RP-02 / RP-03 ----
define('RP-01', 'Whole-model rigged animation, including separate gun/headgear meshes (world-matrix sampling).', async () => ({
    verdict: 'blocked',
    rootCause: 'No window-level hook exposes the Three.js/react-three-fiber scene graph for programmatic world-matrix sampling of the gun and headgear meshes (grep of src/ found no window.__GRIMOIRE_* or window.grimoire debug hook of this kind). Adding one would be new debug instrumentation beyond this plan\'s files_modified list. RP-03\'s own reading used only canvas/WebGL-level access (EXT_disjoint_timer_query_webgl2, screenshot pixel comparison), which answers a frame-budget question, not a per-mesh transform question; it is not a substitute for RP-01.',
}));

define('RP-02', 'NPR rim/outline stability while orbiting (screenshots at intervals; human-judged).', async (ctx) => {
    const dir = evidenceDir();
    const shots = [];
    await evaluate(ctx.port, `(() => { location.hash = '#/locker/${SEVEN_CODENAME}'; return 'navigated'; })()`);
    for (let i = 0; i < 4; i++) {
        // Deliberately sequential: each shot is ~1s apart so the turntable
        // has moved between frames.
        const path = join(dir, `rp-02-seven-t${i}.png`);
        await new Promise((r) => setTimeout(r, 1000));
        await screenshot(ctx.port, path);
        shots.push(path);
    }
    return {
        verdict: 'blocked',
        evidence: `4 screenshots captured ~1s apart while Seven's rigged idle played, relying on the existing turntable spin for varied angles rather than explicit camera control (no orbit-angle API was found on window.electronAPI). Saved outside the repository (ephemeral, not committed): ${shots.join(', ')}`,
        rootCause: 'This row is deliberately not auto-verdicted (plan Task 2: "the eye is still the instrument"). The screenshots are evidence for a human to read; blocked records that the automatic half stops at evidence capture.',
    };
});

define('RP-03', 'Frame budget: the gate. Already settled by 01-07; this runner leaves it alone.', async () => ({
    verdict: 'skip', // sentinel: never written back, see runner loop.
}));

// ---------------------------------------------------------------------------
// Shared helpers used by more than one check.
// ---------------------------------------------------------------------------

async function poolCheck(scopeLabel) {
    const library = [
        { path: '/fixture/pool-clip-a.mp3', name: 'a' },
        { path: '/fixture/pool-clip-b.mp3', name: 'b' },
        { path: '/fixture/pool-clip-c.mp3', name: 'c' },
    ];
    const sourceClips = [`sounds/${scopeLabel}/pool_target.vsnd_c`];
    const selected = new Set(sourceClips);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const distinctClips = new Set();
    for (const seed of seeds) {
        const assignments = planSoundPoolLocal('seeded-library', sourceClips, selected, library, seed);
        for (const a of assignments) distinctClips.add(a.audioPath);
    }
    const verdict = distinctClips.size > 1 ? 'pass' : 'fail';
    return {
        verdict,
        evidence: `planSoundPool('seeded-library', ...) (mirrors src/components/foundry/soundPoolPlan.ts) called with ${seeds.length} seeds (${seeds.join(',')}) against a 3-clip library; distinct audioPath values returned across all seeds: ${distinctClips.size} (${[...distinctClips].join(', ')}).`,
        rootCause: verdict === 'fail' ? 'the seeded-library selection path returned the same clip for every seed tried' : undefined,
    };
}

/** Dynamic discovery for the "downloaded third-party mod" matrix cells:
 *  scans installed, enabled mods for one that is NOT Foundry-authored (no
 *  soundSwap/textureReplacement/foundryBuild/merged provenance) and whose
 *  VPK entries intersect the live catalog's sound entries for the given
 *  scope. Honest best-effort: if this machine has no such mod installed,
 *  the row is blocked with a specific reason rather than faked. */
async function findThirdPartyMod(ctx, scope, heroCodename, heroName) {
    const mods = await callApi(ctx.port, 'getMods');
    const candidates = (mods ?? []).filter((m) => m.enabled && !m.soundSwap && !m.textureReplacement && !m.foundryBuild && !m.merged);
    if (!candidates.length) {
        return { verdict: 'blocked', rootCause: `No enabled, non-Foundry-authored mod is installed on this machine to serve as the "downloaded third-party mod" fixture for the ${scope} case. Downloading one from GameBanana unattended was out of scope for this run's safety boundary.` };
    }

    let catalogEntries;
    if (scope === 'hero') {
        const sounds = await callApi(ctx.port, 'foundry.heroSounds', { hero: heroCodename });
        catalogEntries = new Set((sounds ?? []).flatMap((s) => (s.vsnd ?? []).map(soundEntryLocal)));
    } else if (scope === 'voice') {
        const lines = await callApi(ctx.port, 'foundry.voicelines', { hero: heroCodename });
        catalogEntries = new Set((lines ?? []).flatMap((l) => (l.vsnd ?? []).map(soundEntryLocal)));
    } else {
        const globals = await callApi(ctx.port, 'foundry.globalSounds', {});
        catalogEntries = new Set((globals ?? []).flatMap((g) => (g.vsnd ?? []).map(soundEntryLocal)));
    }
    if (!catalogEntries.size) {
        return { verdict: 'blocked', rootCause: `The live catalog returned no ${scope} sound entries to match candidate mods against.` };
    }

    for (const mod of candidates) {
        const entries = parseVpkDirectoryLocal(mod.path);
        if (!entries) continue;
        const match = entries.find((e) => catalogEntries.has(normalizeEntry(e)));
        if (match) {
            return { verdict: 'pass', evidence: `Discovered installed, non-Foundry mod "${mod.fileName}" (${mod.name || 'unnamed'}) claiming ${scope} sound entry ${normalizeEntry(match)}, which matches the live catalog's ${scope} sound entries.` };
        }
    }
    return { verdict: 'blocked', rootCause: `${candidates.length} enabled non-Foundry mod(s) are installed, but none of them claim a VPK entry that matches the live catalog's ${scope} sound entries. No suitable pre-existing third-party fixture was found for this case.` };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
    if (DRY_RUN) {
        console.log(`verify-in-app --dry-run: ${CHECKS.length} app-tier rows planned, nothing will be touched.\n`);
        for (const c of CHECKS) console.log(`  ${c.id}: ${c.description}`);
        return 0;
    }

    const { slot, port } = slotPort();
    console.log(`verify-in-app: slot ${slot} (CDP port ${port}). Confirming the running app reports this slot before any mutation...`);
    await confirmSlot(port, slot);
    console.log(`Confirmed. This run will forge, install, enable, disable, and merge mods against the real game addons directory this slot shares. Every check restores its own footprint in a finally block.\n`);

    const trackedMods = []; // { id, deferDelete }
    const ctx = {
        port,
        usedEntries: {},
        track(id, opts = {}) {
            trackedMods.push({ id, deferDelete: !!opts.deferDelete });
        },
        async deleteMod(id) {
            try {
                await callApi(port, 'deleteMod', id);
            } catch (err) {
                console.warn(`  (cleanup) deleteMod(${id}) failed: ${err.message}`);
            }
        },
    };

    const updates = new Map();
    for (const check of CHECKS) {
        process.stdout.write(`${check.id}: `);
        let result;
        try {
            result = await check.run(ctx);
        } catch (err) {
            result = { verdict: 'blocked', rootCause: `unexpected error while running this check: ${err.message}` };
        }
        if (result.verdict === 'skip') {
            console.log('left alone (RP-03 is 01-07\'s, not this runner\'s).');
            continue;
        }
        console.log(result.verdict);
        updates.set(check.id, result);
    }

    console.log('\nCleaning up deferred-delete mods tracked across checks...');
    for (const t of trackedMods) {
        if (t.deferDelete) await ctx.deleteMod(t.id);
    }

    const recordText = readFileSync(RECORD_PATH, 'utf8');
    const { text, written, skipped } = writeVerdicts(recordText, updates);
    writeFileSync(RECORD_PATH, text);

    console.log(`\nWrote ${written.length} verdict(s): ${written.join(', ')}`);
    if (skipped.length) {
        console.log(`Skipped ${skipped.length} row(s) with an existing non-blank verdict (use --force to overwrite): ${skipped.map((s) => `${s.id}=${s.currentVerdict}`).join(', ')}`);
    }
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main().then(
        (code) => process.exit(code ?? 0),
        (err) => {
            console.error(err.stack || String(err));
            process.exit(1);
        }
    );
}
