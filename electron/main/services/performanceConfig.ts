// Apply/remove the bundled OptimizationLock performance preset by patching
// the user's gameinfo.gi in place (never replacing the file). Every change is
// tagged with an inline "grimoire-perf" marker so removal needs no external
// state: added lines are deleted, edited lines restore the recorded original
// value, and removed lines are uncommented. fixGameinfo (system.ts) only
// rewrites the SearchPaths block, so the two never fight over the same lines.
//
// All patching runs on LF-normalized text and the file's original EOL style
// is restored on write: line-based regexes silently fail on CR-terminated
// lines otherwise (JS `.` does not match \r), which would inject duplicate
// convars with ambiguous engine precedence on Windows CRLF files.
import { createHash } from 'crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getGameinfoPath } from './deadlock';
import type {
    PerformanceConfigStatus,
    PerformanceConvarOrigin,
    PerformanceConvarState,
} from '../../../src/types/electron';
import {
    CONVARS,
    ADVANCED_GAMEINFO_CONVARS,
    HUD_CONVARS,
    PRESET_ID,
    PRESET_VERSION,
    SECTION_OPS,
    type SectionOp,
} from './performanceConfigData';

const MARKER = 'grimoire-perf';
const BEGIN_RE = /Grimoire Performance Config BEGIN \(preset=([\w-]+) v([\w.]+)\)/;

// The four inline marker shapes Grimoire writes, as recognizers. Managed
// (preset) edits use `added` / `was` / `removed`; the unmanaged single-ConVar
// path uses `hud-added` / `hud-was`. Kept together so the read side (status,
// provenance) and the write side (apply, remove, clear) can never drift apart
// on the exact bytes. Note `// grimoire-perf added` is not a substring of
// `// grimoire-perf hud-added`, so the plain-token tests stay unambiguous.
const ADDED_TOKEN = `// ${MARKER} added`;
const HUD_ADDED_TOKEN = `// ${MARKER} hud-added`;
const WAS_RE = new RegExp(`^(.*?) // ${MARKER} was ("[^"]*"|\\S+)\\s*$`);
// hud-was puts the marker before the line's trailing comment (see
// setConvarsInUnmanagedFile), so group 3 carries whatever followed it.
const HUD_WAS_RE = new RegExp(`^(.*?) // ${MARKER} hud-was ("[^"]*"|\\S+)(.*)$`);
const REMOVED_RE = new RegExp(`^([ \\t]*)// ${MARKER} removed: (.*)$`);
const GAMEINFO_BACKUP_SUFFIX = '.grimoire-bak';
// Applied-state sidecar, stored next to gameinfo.gi (game updates replace
// gameinfo.gi but leave foreign files alone). Owned by the main process only,
// so a renderer settings save can never clobber it. Its presence without the
// in-file BEGIN marker is how we detect "a game update wiped the config".
// Deliberately NOT named gameinfo.*: system.ts's findGameinfoCandidates
// surfaces gameinfo.* files as restore candidates and this is not one.
// Besides wiped-detection it carries the user's overrides: hand edits to
// preset-managed lines, harvested on reapply and layered onto every apply,
// so power-user tweaks survive reapplies, preset updates, and game-update
// wipes. Markers always record stock values (never override values), so
// Remove restores the original file regardless of overrides.
const STATE_FILENAME = 'grimoire-performance.json';

/** A user deviation from the preset for one managed key: a different value,
 *  or omit (the user deleted / commented out the preset line). Keys are
 *  `<section path>/<key>`, e.g. `ConVars/citadel_unit_status_use_new`. */
type OverrideEntry = { value?: string; omit?: boolean };
type Overrides = Record<string, OverrideEntry>;

function statePath(gameinfoPath: string): string {
    return join(dirname(gameinfoPath), STATE_FILENAME);
}

function backupPathFor(gameinfoPath: string): string {
    return `${gameinfoPath}${GAMEINFO_BACKUP_SUFFIX}`;
}

function hasConVars(text: string): boolean {
    const normalized = text.includes('\r\n') ? text.split('\r\n').join('\n') : text;
    return findSectionByPath(normalized, ['ConVars']) !== null;
}

// True when gameinfo.gi is too broken to patch (empty or missing its ConVars
// section, e.g. the user cleared it in the external editor) AND a Grimoire
// backup that is itself intact exists to restore from. Lets the UI offer a
// one-click recovery instead of dead-ending on the "no ConVars section"
// error. `content` is the raw live-file text (any EOL style). The backup is
// validated too: restoring an equally-broken backup would help no one.
function canRestoreBackup(gameinfoPath: string, content: string): boolean {
    if (hasConVars(content)) return false;
    try {
        return hasConVars(readFileSync(backupPathFor(gameinfoPath), 'utf-8'));
    } catch {
        return false; // no backup, or unreadable
    }
}

// ---------------------------------------------------------------------------
// gameinfo.gi text helpers. The file is Valve KV: sections are `Name {...}`,
// entries are `key "value"` (values quoted, keys usually bare), comments are
// `//`. All edits are line-based so untouched lines keep their exact bytes.
// ---------------------------------------------------------------------------

function stripComment(line: string): string {
    const idx = line.indexOf('//');
    return idx >= 0 ? line.slice(0, idx) : line;
}

// Locate a `name { ... }` block via balanced-brace scanning, searching only
// within [from, to). Returns the body range (inside the braces) or null.
// Comment-only mentions of the name don't match because they are never
// followed by an opening brace on the uncommented part of the text.
function findSection(
    content: string,
    name: string,
    from: number,
    to: number
): { bodyStart: number; bodyEnd: number } | null {
    const re = new RegExp(`(^|[\\s}])${name}\\s*\\{`, 'g');
    re.lastIndex = from;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) && match.index < to) {
        // Skip matches on commented lines.
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineText = content.slice(lineStart, content.indexOf('{', match.index));
        if (lineText.includes('//')) continue;

        const bodyStart = content.indexOf('{', match.index) + 1;
        let depth = 1;
        for (let i = bodyStart; i < to; i++) {
            const ch = content[i];
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return { bodyStart, bodyEnd: i };
            }
        }
        return null; // unbalanced
    }
    return null;
}

function findSectionByPath(
    content: string,
    path: string[]
): { bodyStart: number; bodyEnd: number } | null {
    let range = { bodyStart: 0, bodyEnd: content.length };
    for (const name of path) {
        const next = findSection(content, name, range.bodyStart, range.bodyEnd);
        if (!next) return null;
        range = next;
    }
    return range;
}

// Indentation used by the section's first non-empty line, so injected lines
// match the file's existing style (tabs in the stock file, spaces in some
// community configs).
function detectIndent(body: string): string {
    for (const line of body.split('\n')) {
        const m = /^([ \t]+)\S/.exec(line);
        if (m) return m[1];
    }
    return '\t\t';
}

// Match `key "value"` (or bare-token value) at the start of an uncommented
// line. Returns the pieces needed to rewrite just the value.
function matchEntryLine(
    line: string,
    key: string
): { prefix: string; value: string; suffix: string } | null {
    const re = new RegExp(`^([ \\t]*"?${key}"?[ \\t]+)("[^"]*"|[^\\s/]+)(.*)$`);
    const m = re.exec(line);
    if (!m) return null;
    // Reject hits where the key only appears inside a comment.
    const beforeKey = stripComment(line);
    if (!new RegExp(`(^|[ \\t"])${key}([ \\t"]|$)`).test(beforeKey)) return null;
    return { prefix: m[1], value: m[2], suffix: m[3] };
}

// The key of an active `key "value"` entry line, or null.
function entryKey(line: string): string | null {
    const m = /^[ \t]*"?([A-Za-z_]\w*)"?[ \t]+("[^"]*"|[^\s/]+)/.exec(stripComment(line));
    return m ? m[1] : null;
}

const quote = (v: string) => `"${v.replace(/^"|"$/g, '')}"`;
const unquote = (v: string) => v.replace(/^"|"$/g, '');

// ---------------------------------------------------------------------------
// Per-ConVar provenance
//
// Every user-facing control is badged with where its current value came from.
// Only the main process can answer that honestly: it takes the inline markers,
// the sidecar overrides and the preset tables together. The renderer used to
// carry its own fallback numbers and drew them as though the game had picked
// them, which is the exact confusion these states exist to remove.
// ---------------------------------------------------------------------------

const HUD_BY_KEY = new Map<string, (typeof HUD_CONVARS)[number]>(
    HUD_CONVARS.map((entry) => [entry.key, entry])
);
const ADVANCED_BY_KEY = new Map<string, (typeof ADVANCED_GAMEINFO_CONVARS)[number]>(
    ADVANCED_GAMEINFO_CONVARS.map((entry) => [entry.key, entry])
);
/** Every ConVar the card exposes. The clear path refuses anything outside it,
 *  so a renderer bug can never delete an unrelated line. */
const USER_FACING_KEYS = new Set<string>([...HUD_BY_KEY.keys(), ...ADVANCED_BY_KEY.keys()]);
const PRESET_CONVAR_VALUES = new Map<string, string>(CONVARS.map(([key, value]) => [key, value]));

/** One active `key "value"` line for a user-facing ConVar, plus which Grimoire
 *  marker (if any) tags it. `stock` is the pre-Grimoire value the was/hud-was
 *  marker recorded, which is the most trustworthy game default we ever have:
 *  it came out of this user's own file. */
interface ConvarLineInfo {
    value: string;
    marker: 'added' | 'was' | 'hud-added' | 'hud-was' | null;
    stock: string | null;
}

interface ConvarLineScan {
    /** Active entries, last occurrence wins (that is the one the engine ends
     *  up honoring in a file that carries duplicates). */
    active: Map<string, ConvarLineInfo>;
    /** Stock values parked in `removed:` marker comments, i.e. keys the user
     *  reset to the game default. Lets the badge name the value even though no
     *  active line exists. */
    removedStock: Map<string, string>;
}

function scanConvarLines(normalized: string): ConvarLineScan {
    const scan: ConvarLineScan = { active: new Map(), removedStock: new Map() };
    const range = findSectionByPath(normalized, ['ConVars']);
    if (!range) return scan;

    for (const line of normalized.slice(range.bodyStart, range.bodyEnd).split('\n')) {
        const removed = REMOVED_RE.exec(line);
        if (removed) {
            const key = entryKey(removed[2]);
            const entry = key ? matchEntryLine(removed[2], key) : null;
            if (key && entry && USER_FACING_KEYS.has(key)) {
                scan.removedStock.set(key, unquote(entry.value));
            }
            continue;
        }
        const key = entryKey(line);
        if (!key || !USER_FACING_KEYS.has(key)) continue;
        const entry = matchEntryLine(line, key);
        if (!entry) continue;

        let marker: ConvarLineInfo['marker'] = null;
        let stock: string | null = null;
        if (line.includes(ADDED_TOKEN)) marker = 'added';
        else if (line.includes(HUD_ADDED_TOKEN)) marker = 'hud-added';
        else {
            const was = WAS_RE.exec(line);
            const hudWas = was ? null : HUD_WAS_RE.exec(line);
            if (was) {
                marker = 'was';
                stock = unquote(was[2]);
            } else if (hudWas) {
                marker = 'hud-was';
                stock = unquote(hudWas[2]);
            }
        }
        scan.active.set(key, { value: unquote(entry.value), marker, stock });
    }
    return scan;
}

/** gameinfo.gi values are text, but "8" and "8.0" are the same slider
 *  position. Compare numerically when both sides parse, exactly otherwise. */
function valuesEqual(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.trim() === '' || b.trim() === '') return false;
    const na = Number(a);
    const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Where one control's value came from. `supported` is false when the line
 *  holds something this control cannot represent (a non-numeric slider value,
 *  a toggle value that is neither its on nor its off token); the caller has
 *  already decided that, because only it knows the control's shape. */
function classifyOrigin(args: {
    info: ConvarLineInfo | null;
    supported: boolean;
    applied: boolean;
    presetValue: string | null;
    gameDefault: string | null;
    override: OverrideEntry | undefined;
}): PerformanceConvarOrigin {
    const { info, supported, applied, presetValue, gameDefault, override } = args;
    // No line at all: the engine's built-in value is what runs.
    if (!info) return 'game-default';
    if (!supported) return 'unsupported';
    if (info.marker === null) {
        // A line Grimoire never tagged. If it still carries the value we know
        // the engine ships, nothing has been overridden yet.
        if (gameDefault !== null && valuesEqual(info.value, gameDefault)) return 'game-default';
        return 'user-override';
    }
    // A recorded sidecar deviation settles it: the user moved this away from
    // whatever the preset writes.
    if (override?.value !== undefined && override.value !== presetValue) return 'user-override';
    if (applied && presetValue !== null && info.value === presetValue) return 'managed-preset';
    return 'user-override';
}

/** Provenance for every user-facing ConVar. `rawContent` may use either EOL
 *  style. Returns an empty record only when there is no ConVars section to
 *  read, which the renderer treats as "cannot inspect" rather than "default". */
function computeConvarStates(
    rawContent: string,
    gameinfoPath: string
): Record<string, PerformanceConvarState> {
    const normalized = rawContent.includes('\r\n')
        ? rawContent.split('\r\n').join('\n')
        : rawContent;
    if (!findSectionByPath(normalized, ['ConVars'])) return {};

    const applied = BEGIN_RE.test(normalized);
    const scan = scanConvarLines(normalized);
    const overrides = readAppliedState(gameinfoPath)?.overrides ?? {};
    const states: Record<string, PerformanceConvarState> = {};

    const build = (
        key: string,
        supported: boolean,
        gameDefaultFallback: string | null,
        outOfRange: boolean
    ): PerformanceConvarState => {
        const info = scan.active.get(key) ?? null;
        const presetValue = PRESET_CONVAR_VALUES.get(key) ?? null;
        // Prefer values observed in this user's own file over the table.
        const gameDefault =
            info?.stock ?? scan.removedStock.get(key) ?? gameDefaultFallback ?? null;
        const origin = classifyOrigin({
            info,
            supported,
            applied,
            presetValue,
            gameDefault,
            override: overrides[`ConVars/${key}`],
        });
        return {
            origin,
            value: info?.value ?? null,
            presetValue,
            gameDefault,
            ...(outOfRange ? { outOfRange: true } : {}),
        };
    };

    for (const entry of HUD_CONVARS) {
        const value = scan.active.get(entry.key)?.value;
        const supported = value === undefined || value === entry.on || value === entry.off;
        states[entry.key] = build(entry.key, supported, entry.gameDefault, false);
    }
    for (const entry of ADVANCED_GAMEINFO_CONVARS) {
        const raw = scan.active.get(entry.key)?.value;
        const numeric = raw === undefined ? null : Number(raw);
        const supported = raw === undefined || (raw.trim() !== '' && Number.isFinite(numeric));
        // Out of range is not "unsupported": we understand the number fine, we
        // just refuse to draw it on a slider that cannot reach it. Replacing it
        // takes an explicit confirmation in the UI, never a silent clamp.
        const outOfRange =
            supported && numeric !== null && (numeric < entry.min || numeric > entry.max);
        states[entry.key] = build(entry.key, supported, String(entry.gameDefault), outOfRange);
    }
    return states;
}

// ---------------------------------------------------------------------------
// Overrides: harvest hand edits so they survive reapply and wipes
// ---------------------------------------------------------------------------

// Bare key -> preset value + override key. null marks a bare key that appears
// more than once in the preset (ambiguous: harvesting it could attribute a
// value to the wrong section, so we skip it). Remove-type ops carry no value
// and are not overridable.
function presetKeyIndex(): Map<string, { okey: string; value: string } | null> {
    const idx = new Map<string, { okey: string; value: string } | null>();
    const put = (bare: string, okey: string, value: string) => {
        idx.set(bare, idx.has(bare) ? null : { okey, value });
    };
    for (const [key, value] of CONVARS) put(key, `ConVars/${key}`, value);
    for (const op of SECTION_OPS) {
        if (!op.remove) put(op.key, `${op.path.join('/')}/${op.key}`, op.value!);
    }
    return idx;
}

// Read the user's deviations out of an applied file (LF-normalized): edits to
// marker-tagged lines, commented-out or deleted preset convars, and the
// user's own convars added inside the marked block. Runs on every reapply, so
// the result is a complete snapshot (reverting a line back to the preset
// value drops its override). Deletions are only detected for ConVars block
// keys: a missing section-op key usually means a game update restructured
// the section, not user intent.
function harvestOverrides(content: string): Overrides {
    const idx = presetKeyIndex();
    const overrides: Overrides = {};

    for (const line of content.split('\n')) {
        const addedAt = line.indexOf(ADDED_TOKEN);
        if (addedAt >= 0) {
            const body = line.slice(0, addedAt);
            const isCommented = /^[ \t]*\/\//.test(body);
            const active = isCommented ? body.replace(/^[ \t]*\/\/[ \t]*/, '') : body;
            const key = entryKey(active);
            if (!key) continue;
            const entry = matchEntryLine(active, key);
            const preset = idx.get(key);
            if (preset === null) continue; // ambiguous bare key
            if (!preset) {
                // Not in the preset: the user's own convar inside our block.
                if (!isCommented && entry) {
                    overrides[`ConVars/${key}`] = { value: unquote(entry.value) };
                }
                continue;
            }
            if (isCommented) overrides[preset.okey] = { omit: true };
            else if (entry && unquote(entry.value) !== preset.value) {
                overrides[preset.okey] = { value: unquote(entry.value) };
            }
            continue;
        }
        const was = WAS_RE.exec(line);
        if (was) {
            const key = entryKey(was[1]);
            const entry = key ? matchEntryLine(was[1], key) : null;
            const preset = key ? idx.get(key) : null;
            if (preset && entry && unquote(entry.value) !== preset.value) {
                overrides[preset.okey] = { value: unquote(entry.value) };
            }
        }
    }

    // Deleted preset convars: every CONVARS key is present after an apply
    // (edited in place or injected), so one with no active entry left in the
    // ConVars section was removed by the user.
    const convarRange = findSectionByPath(content, ['ConVars']);
    if (convarRange) {
        const activeKeys = new Set(
            content
                .slice(convarRange.bodyStart, convarRange.bodyEnd)
                .split('\n')
                .map(entryKey)
                .filter(Boolean)
        );
        for (const [key] of CONVARS) {
            if (!activeKeys.has(key)) overrides[`ConVars/${key}`] = { omit: true };
        }
    }
    return overrides;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

// Apply one op inside its section: edit existing entries in place (tagging
// the original value), or insert a new tagged line after the opening brace.
// Every active occurrence is edited, not just the first: some files (e.g. a
// manually installed OptimizationLock config) carry duplicate keys, and
// leaving one at a different value would reintroduce the engine-precedence
// ambiguity the edit-in-place strategy exists to avoid. Returns the updated
// content, or null when the section doesn't exist (a game update may
// restructure the file; we skip rather than guess).
function applyOp(content: string, op: SectionOp): string | null {
    const range = findSectionByPath(content, op.path);
    if (!range) return null;

    const body = content.slice(range.bodyStart, range.bodyEnd);
    const lines = body.split('\n');

    let edited = false;
    for (let i = 0; i < lines.length; i++) {
        const entry = matchEntryLine(lines[i], op.key);
        if (!entry) continue;
        if (op.remove) {
            const indent = /^[ \t]*/.exec(lines[i])![0];
            lines[i] = `${indent}// ${MARKER} removed: ${lines[i].trim()}`;
        } else {
            lines[i] = `${entry.prefix}${quote(op.value!)}${entry.suffix} // ${MARKER} was ${entry.value}`;
        }
        edited = true;
    }
    if (edited) {
        return content.slice(0, range.bodyStart) + lines.join('\n') + content.slice(range.bodyEnd);
    }

    if (op.remove) return content; // nothing to remove; engine default already active
    const indent = detectIndent(body);
    const added = `\n${indent}${op.key} ${quote(op.value!)} // ${MARKER} added`;
    return content.slice(0, range.bodyStart) + added + content.slice(range.bodyStart);
}

export function applyPerformanceConfig(
    deadlockPath: string | null,
    opts?: { resetOverrides?: boolean; convarOverrides?: Record<string, string> }
): PerformanceConfigStatus {
    if (!deadlockPath) return status('error', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    if (!existsSync(gameinfoPath)) {
        return status('error', 'gameinfo.gi not found. Configure your Deadlock path first.');
    }

    try {
        const original = readFileSync(gameinfoPath, 'utf-8');
        const crlf = original.includes('\r\n');

        // Work in LF-space (see header comment), restore the EOL style on write.
        let content = crlf ? original.split('\r\n').join('\n') : original;
        // User overrides: harvested fresh from the file when a config is
        // present (so hand edits made since the last apply are captured), or
        // carried over from the sidecar when a game update wiped the file.
        let overrides: Overrides = {};
        if (!opts?.resetOverrides) {
            overrides = BEGIN_RE.test(content)
                ? harvestOverrides(content)
                : (readAppliedState(gameinfoPath)?.overrides ?? {});
        }
        for (const [key, value] of Object.entries(opts?.convarOverrides ?? {})) {
            overrides[`ConVars/${key}`] = { value };
        }
        // Reapplying (e.g. after a preset data update) starts from a clean base.
        if (BEGIN_RE.test(content)) content = removeMarkers(content);

        // One-time recovery copy of the oldest version we have seen, shared
        // with fixGameinfo's backup so the user has a single restore point.
        // Only capture a structurally sane file (has ConVars): backing up an
        // already-empty/corrupt gameinfo would poison the single restore point
        // and make "Restore Backup" a no-op.
        const backupPath = backupPathFor(gameinfoPath);
        if (!existsSync(backupPath) && hasConVars(original)) {
            try {
                writeFileSync(backupPath, original, 'utf-8');
            } catch {
                // Best-effort: a failed backup must not block the apply.
            }
        }

        const skipped: string[] = [];
        for (const op of SECTION_OPS) {
            const okey = `${op.path.join('/')}/${op.key}`;
            const override = overrides[okey];
            if (override?.omit) continue;
            const effective =
                override?.value !== undefined && !op.remove
                    ? { ...op, value: override.value }
                    : op;
            const next = applyOp(content, effective);
            if (next === null) skipped.push(okey);
            else content = next;
        }

        // ConVars: edit keys that already exist (stock entries) in place, and
        // inject the rest as one marked block right after `ConVars {`, the
        // insertion point OptimizationLock's own instructions use. Never both:
        // a duplicate convar would have ambiguous engine precedence.
        let convarRange = findSectionByPath(content, ['ConVars']);
        if (!convarRange) {
            const restorable = canRestoreBackup(gameinfoPath, original);
            const how = restorable
                ? 'Restore the Grimoire backup below, or verify game files in Steam, then try again.'
                : 'Verify game files in Steam and try again.';
            return status('error', `gameinfo.gi has no ConVars section. ${how}`, 0, restorable);
        }
        const existingKeys = new Set(
            content
                .slice(convarRange.bodyStart, convarRange.bodyEnd)
                .split('\n')
                .map(entryKey)
                .filter(Boolean)
        );
        const toInject: Array<readonly [string, string]> = [];
        for (const [key, value] of CONVARS) {
            const override = overrides[`ConVars/${key}`];
            if (override?.omit) continue;
            const effective = override?.value ?? value;
            if (existingKeys.has(key)) {
                content = applyOp(content, { path: ['ConVars'], key, value: effective })!;
            } else {
                toInject.push([key, effective]);
            }
        }
        // The user's own convars (added inside the marked block by hand and
        // harvested as overrides) ride along in the injected block.
        const presetConvarKeys = new Set(CONVARS.map(([key]) => key));
        for (const [okey, override] of Object.entries(overrides)) {
            if (!okey.startsWith('ConVars/') || override.value === undefined) continue;
            const key = okey.slice('ConVars/'.length);
            if (presetConvarKeys.has(key)) continue;
            if (existingKeys.has(key)) {
                content = applyOp(content, { path: ['ConVars'], key, value: override.value })!;
            } else {
                toInject.push([key, override.value]);
            }
        }
        convarRange = findSectionByPath(content, ['ConVars'])!;
        const indent = detectIndent(content.slice(convarRange.bodyStart, convarRange.bodyEnd));
        const width = toInject.length ? Math.max(...toInject.map(([k]) => k.length)) + 1 : 0;
        const block = [
            `${indent}// ==== Grimoire Performance Config BEGIN (preset=${PRESET_ID} v${PRESET_VERSION}) ====`,
            `${indent}// Values from OptimizationLock by Sqooky and contributors (GPL-3.0) [${MARKER}]`,
            `${indent}// https://github.com/Sqooky/OptimizationLock - remove via Grimoire Settings [${MARKER}]`,
            ...toInject.map(([k, v]) => `${indent}${k.padEnd(width)}${quote(v)} // ${MARKER} added`),
            `${indent}// ==== Grimoire Performance Config END ====`,
        ].join('\n');
        content =
            content.slice(0, convarRange.bodyStart) + '\n' + block + content.slice(convarRange.bodyStart);

        // Sanity: line-based edits must never unbalance the file.
        if (braceCount(content) !== braceCount(original)) {
            return status('error', 'Patch produced an unbalanced gameinfo.gi; no changes were written.');
        }

        const finalText = crlf ? content.split('\n').join('\r\n') : content;
        writeFileSync(gameinfoPath, finalText, 'utf-8');
        writeAppliedState(gameinfoPath, true, sha256(finalText), overrides);

        const kept = Object.keys(overrides).length;
        const keptNote = kept
            ? ` Kept ${kept} of your override${kept === 1 ? '' : 's'}.`
            : '';
        const note = skipped.length
            ? ` (${skipped.length} setting${skipped.length === 1 ? '' : 's'} skipped: section not found, likely changed by a game update)`
            : '';
        return status('applied', `Performance config v${PRESET_VERSION} applied${note}.${keptNote}`, kept);
    } catch (err) {
        return status('error', `Failed to apply performance config: ${err}`);
    }
}

/** Update only user-exposed HUD ConVars while retaining the normal managed
 * performance patch and its backup/revert semantics. */
export function setPerformanceHudConvars(
    deadlockPath: string | null,
    values: Record<string, boolean>
): PerformanceConfigStatus {
    const convarValues: Record<string, string> = {};
    for (const [key, enabled] of Object.entries(values)) {
        const entry = HUD_BY_KEY.get(key);
        if (entry) convarValues[key] = enabled ? entry.on : entry.off;
    }
    return setPerformanceConvarValues(deadlockPath, convarValues, HUD_BY_KEY);
}

/** Write advanced numeric ConVars. Out-of-range input is refused outright
 *  rather than dropped or clamped: silently ignoring it made the UI report
 *  success while gameinfo.gi kept its old value, and clamping would replace a
 *  deliberate out-of-range number with one Grimoire picked. The card confirms
 *  a replacement with the user before it ever gets here. */
export function setPerformanceAdvancedConvars(
    deadlockPath: string | null,
    values: Record<string, number>
): PerformanceConfigStatus {
    const convarValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
        const entry = ADVANCED_BY_KEY.get(key);
        if (!entry) return status('error', `${key} is not a Grimoire-managed setting.`);
        if (!Number.isFinite(value)) return status('error', `${key} was given a value that is not a number.`);
        if (value < entry.min || value > entry.max) {
            return status(
                'error',
                `${key} must be between ${entry.min} and ${entry.max}. Grimoire will not clamp ${value} for you; reset the setting or edit gameinfo.gi directly.`
            );
        }
        convarValues[key] = String(value);
    }
    return setPerformanceConvarValues(deadlockPath, convarValues, ADVANCED_BY_KEY);
}

function setPerformanceConvarValues(
    deadlockPath: string | null,
    convarValues: Record<string, string>,
    allowed: Map<string, unknown>
): PerformanceConfigStatus {
    if (!deadlockPath) return status('error', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    if (existsSync(gameinfoPath) && !BEGIN_RE.test(readFileSync(gameinfoPath, 'utf-8'))) {
        return setConvarsInUnmanagedFile(gameinfoPath, convarValues, allowed);
    }
    if (Object.keys(convarValues).length === 0) {
        return getPerformanceConfigStatus(deadlockPath);
    }
    return applyPerformanceConfig(deadlockPath, { convarOverrides: convarValues });
}

/** Patch a manually managed gameinfo.gi without forcing the entire FPS preset
 * onto it. Each changed line keeps its original value in a marker comment so
 * the edit remains auditable and can be recognized on the next read. */
function setConvarsInUnmanagedFile(
    gameinfoPath: string,
    values: Record<string, string>,
    allowed: Map<string, unknown>
): PerformanceConfigStatus {
    try {
        const original = readFileSync(gameinfoPath, 'utf-8');
        const crlf = original.includes('\r\n');
        let content = crlf ? original.split('\r\n').join('\n') : original;
        const range = findSectionByPath(content, ['ConVars']);
        if (!range) return status('error', 'gameinfo.gi has no ConVars section.');
        let body = content.slice(range.bodyStart, range.bodyEnd);
        const lines = body.split('\n');
        for (const [key, value] of Object.entries(values)) {
            if (!allowed.has(key)) continue;
            const index = lines.findIndex((line) => entryKey(line) === key);
            if (index >= 0) {
                const line = lines[index];
                const match = matchEntryLine(line, key);
                if (!match) continue;
                if (line.includes(`// ${MARKER} hud-was`)) {
                    lines[index] = `${match.prefix}${quote(value)}${match.suffix}`;
                } else {
                    lines[index] = `${match.prefix}${quote(value)} // ${MARKER} hud-was ${quote(unquote(match.value))}${match.suffix}`;
                }
            } else {
                const indent = detectIndent(body);
                lines.unshift(`${indent}${key} ${quote(value)} // ${MARKER} hud-added`);
                body = lines.join('\n');
            }
        }
        body = lines.join('\n');
        content = content.slice(0, range.bodyStart) + body + content.slice(range.bodyEnd);
        if (!existsSync(backupPathFor(gameinfoPath)) && hasConVars(original)) {
            try { writeFileSync(backupPathFor(gameinfoPath), original, 'utf-8'); } catch { /* best effort */ }
        }
        writeFileSync(gameinfoPath, crlf ? content.split('\n').join('\r\n') : content, 'utf-8');
        return {
            ...status('not-applied', 'HUD ConVars are configured in gameinfo.gi.'),
            convarValues: readUserConvarValues(content),
            convarStates: computeConvarStates(content, gameinfoPath),
        };
    } catch (err) {
        return status('error', `Failed to update HUD ConVars: ${err}`);
    }
}

/** Reapply the pure preset, discarding the user's saved overrides. */
export function resetPerformanceConfigOverrides(
    deadlockPath: string | null
): PerformanceConfigStatus {
    return applyPerformanceConfig(deadlockPath, { resetOverrides: true });
}

function braceCount(content: string): number {
    let n = 0;
    for (const ch of content) if (ch === '{' || ch === '}') n++;
    return n;
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

// Reverse every marked line. Input and output are LF-normalized.
function removeMarkers(content: string): string {
    const out: string[] = [];
    for (const line of content.split('\n')) {
        // Block header/footer + injected entries: drop the line entirely.
        // Only lines Grimoire wrote carry these exact markers, so a manually
        // installed OptimizationLock config (full of "OptimizationLock"
        // comments of its own) is never touched.
        if (
            line.includes(ADDED_TOKEN) ||
            line.includes(`[${MARKER}]`) ||
            /Grimoire Performance Config (BEGIN|END)/.test(line)
        ) {
            continue;
        }
        // Edited stock entry: restore the recorded original value.
        const was = WAS_RE.exec(line);
        if (was) {
            const key = entryKey(was[1]);
            const entry = key ? matchEntryLine(was[1], key) : null;
            if (entry) {
                out.push(`${entry.prefix}${was[2]}${entry.suffix}`);
                continue;
            }
        }
        // Commented-out stock entry: bring the original line back.
        const removed = REMOVED_RE.exec(line);
        if (removed) {
            out.push(`${removed[1]}${removed[2]}`);
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
}

export function removePerformanceConfig(deadlockPath: string | null): PerformanceConfigStatus {
    if (!deadlockPath) return status('error', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    if (!existsSync(gameinfoPath)) {
        return status('error', 'gameinfo.gi not found.');
    }
    try {
        const content = readFileSync(gameinfoPath, 'utf-8');
        if (!content.includes(MARKER)) {
            writeAppliedState(gameinfoPath, false);
            return status('not-applied', 'No performance config to remove.');
        }
        const crlf = content.includes('\r\n');
        const restored = removeMarkers(crlf ? content.split('\r\n').join('\n') : content);
        writeFileSync(gameinfoPath, crlf ? restored.split('\n').join('\r\n') : restored, 'utf-8');
        writeAppliedState(gameinfoPath, false);
        return status('not-applied', 'Performance config removed; stock values restored.');
    } catch (err) {
        return status('error', `Failed to remove performance config: ${err}`);
    }
}

/** Reset user-facing ConVars to the game default by *removing* Grimoire's line
 *  for them, never by writing a number Grimoire picked.
 *
 *  Three shapes, one per marker:
 *  - `added` / `hud-added` (a line Grimoire injected): delete it outright. The
 *    key was not in the user's file before us, so leaving nothing behind is
 *    exactly the pre-Grimoire state.
 *  - `was` (a stock line the preset edited): rewrite it as a `removed:` marker
 *    comment carrying the original line. The engine then falls back to its own
 *    default, Remove still restores the user's file byte for byte, and reapply
 *    reads the key as deleted (harvestOverrides records `omit`), so the preset
 *    does not quietly re-add it on the next apply.
 *  - `hud-was` (a stock line edited in a hand-managed file): restore the
 *    original line and drop the marker. Commenting out a line in a file the
 *    user maintains themselves would be presumptuous; here the stock value is
 *    the honest end state.
 *
 *  Untagged lines are never touched (the marker-tagged-lines-only invariant),
 *  so a value the user typed into gameinfo.gi by hand is reported as
 *  not-clearable instead of being silently deleted. Clearing nothing writes
 *  nothing and says so. */
export function clearPerformanceConvars(
    deadlockPath: string | null,
    keys: string[]
): PerformanceConfigStatus {
    if (!deadlockPath) return status('error', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    if (!existsSync(gameinfoPath)) {
        return status('error', 'gameinfo.gi not found. Configure your Deadlock path first.');
    }
    const targets = [...new Set(keys.filter((key) => USER_FACING_KEYS.has(key)))];
    if (targets.length === 0) {
        return status('error', 'No Grimoire-managed setting was named, so nothing was reset.');
    }

    try {
        const original = readFileSync(gameinfoPath, 'utf-8');
        const crlf = original.includes('\r\n');
        let content = crlf ? original.split('\r\n').join('\n') : original;
        const range = findSectionByPath(content, ['ConVars']);
        if (!range) {
            const restorable = canRestoreBackup(gameinfoPath, original);
            const how = restorable
                ? 'Restore the Grimoire backup below, or verify game files in Steam, then try again.'
                : 'Verify game files in Steam and try again.';
            return status(
                'error',
                `gameinfo.gi has no ConVars section, so it cannot be inspected. ${how}`,
                0,
                restorable
            );
        }
        const managed = BEGIN_RE.test(content);
        const lines = content.slice(range.bodyStart, range.bodyEnd).split('\n');

        const cleared: string[] = [];
        for (const key of targets) {
            let touched = false;
            // Walk backwards: lines are spliced out, and a hand-edited file can
            // carry the same key more than once (all of them have to go, or the
            // engine keeps honoring the survivor).
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (entryKey(line) !== key) continue;
                if (line.includes(ADDED_TOKEN) || line.includes(HUD_ADDED_TOKEN)) {
                    lines.splice(i, 1);
                    touched = true;
                    continue;
                }
                const was = WAS_RE.exec(line);
                if (was) {
                    const entry = matchEntryLine(was[1], key);
                    if (!entry) continue;
                    const indent = /^[ \t]*/.exec(line)![0];
                    const stock = `${entry.prefix}${was[2]}${entry.suffix}`;
                    lines[i] = `${indent}// ${MARKER} removed: ${stock.trim()}`;
                    touched = true;
                    continue;
                }
                const hudWas = HUD_WAS_RE.exec(line);
                if (hudWas) {
                    const entry = matchEntryLine(hudWas[1], key);
                    if (!entry) continue;
                    lines[i] = `${entry.prefix}${hudWas[2]}${hudWas[3]}`;
                    touched = true;
                }
            }
            if (touched) cleared.push(key);
        }

        if (cleared.length === 0) {
            // Honest no-op: nothing Grimoire wrote is in the way, so there is
            // no override to remove and the file stays untouched.
            const current = getPerformanceConfigStatus(deadlockPath);
            return {
                ...current,
                message:
                    'Nothing to reset: Grimoire has no line of its own for those settings, so gameinfo.gi was left alone.',
            };
        }

        content = content.slice(0, range.bodyStart) + lines.join('\n') + content.slice(range.bodyEnd);
        if (braceCount(content) !== braceCount(original)) {
            return status('error', 'Reset produced an unbalanced gameinfo.gi; no changes were written.');
        }

        const finalText = crlf ? content.split('\n').join('\r\n') : content;
        writeFileSync(gameinfoPath, finalText, 'utf-8');

        // Managed files carry a sidecar: record the reset as an `omit` for
        // preset keys (so the next apply respects it) and drop the stored
        // deviation for everything else. Refreshing the content hash keeps the
        // status out of the false "hand edited" state.
        if (managed) {
            const sidecar = readAppliedState(gameinfoPath);
            const overrides: Overrides = { ...(sidecar?.overrides ?? {}) };
            for (const key of cleared) {
                const okey = `ConVars/${key}`;
                if (PRESET_CONVAR_VALUES.has(key)) overrides[okey] = { omit: true };
                else delete overrides[okey];
            }
            writeAppliedState(gameinfoPath, true, sha256(finalText), overrides);
        }

        const missed = targets.length - cleared.length;
        const missedNote = missed
            ? ` ${missed} had no Grimoire line to remove and was left as-is.`
            : '';
        return {
            ...getPerformanceConfigStatus(deadlockPath),
            message: `Reset ${cleared.length} setting${cleared.length === 1 ? '' : 's'} to the game default.${missedNote}`,
        };
    } catch (err) {
        return status('error', `Failed to reset performance ConVars: ${err}`);
    }
}

/** Restore gameinfo.gi from the Grimoire backup (.grimoire-bak), the pristine
 *  pre-apply copy shared with fixGameinfo. Recovery for an emptied or corrupt
 *  file the preset can no longer patch; after restoring, Apply runs normally.
 *  The applied-state sidecar is left intact so the user's saved overrides
 *  re-layer on the next apply. Refuses when no backup exists. */
export function restorePerformanceConfigBackup(
    deadlockPath: string | null
): PerformanceConfigStatus {
    if (!deadlockPath) return status('error', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    const backupPath = backupPathFor(gameinfoPath);
    if (!existsSync(backupPath)) {
        return status(
            'error',
            'No Grimoire backup of gameinfo.gi to restore. Verify game files in Steam instead.'
        );
    }
    try {
        const backup = readFileSync(backupPath, 'utf-8');
        writeFileSync(gameinfoPath, backup, 'utf-8');
        // Markers are gone (the backup predates any apply) but the sidecar
        // stays, so this reads back as a clean "wiped" state: Reapply re-adds
        // the preset and folds the saved overrides back in.
        const savedOverrides = Object.keys(readAppliedState(gameinfoPath)?.overrides ?? {}).length;
        const note = savedOverrides
            ? ` Your ${savedOverrides} saved override${savedOverrides === 1 ? '' : 's'} will be restored on reapply.`
            : '';
        return status(
            'wiped',
            `Restored gameinfo.gi from the Grimoire backup. Reapply to re-add the performance config.${note}`,
            savedOverrides
        );
    } catch (err) {
        return status('error', `Failed to restore gameinfo.gi backup: ${err}`);
    }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function getPerformanceConfigStatus(deadlockPath: string | null): PerformanceConfigStatus {
    if (!deadlockPath) return status('not-applied', 'Deadlock path not configured.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    if (!existsSync(gameinfoPath)) return status('not-applied', 'gameinfo.gi not found.');

    try {
        const content = readFileSync(gameinfoPath, 'utf-8');
        const convarValues = readUserConvarValues(content);
        const convarStates = computeConvarStates(content, gameinfoPath);
        const begin = BEGIN_RE.exec(content);
        if (begin) {
            // The sidecar records a hash of the exact bytes Grimoire wrote, so
            // a mismatch while the markers are intact means hand edits. Old
            // sidecars without a hash just never set the flag.
            const sidecar = readAppliedState(gameinfoPath);
            const handEdited =
                typeof sidecar?.contentHash === 'string' && sidecar.contentHash !== sha256(content);
            const overrideCount = Object.keys(sidecar?.overrides ?? {}).length;
            const base =
                begin[2] === PRESET_VERSION
                    ? `Performance config v${begin[2]} is applied.`
                    : `Performance config v${begin[2]} is applied; v${PRESET_VERSION} is available (reapply to update).`;
            const overrideNote = overrideCount
                ? ` Keeping ${overrideCount} of your override${overrideCount === 1 ? '' : 's'}.`
                : '';
            return {
                state: 'applied',
                appliedVersion: begin[2],
                bundledVersion: PRESET_VERSION,
                handEdited,
                overrideCount,
                convarValues,
                convarStates,
                message: handEdited
                    ? `${base}${overrideNote} The file has manual edits: Reapply folds them into your overrides.`
                    : `${base}${overrideNote}`,
            };
        }
        // Applied before, but the markers are gone: a game update replaced
        // gameinfo.gi (Valve resets it on major patches), or the user cleared
        // the file by hand. If the file is too broken to patch (no ConVars)
        // and we hold a backup, point at the restore path rather than a
        // Reapply that will only error.
        const wipedSidecar = readAppliedState(gameinfoPath);
        if (wipedSidecar) {
            const savedOverrides = Object.keys(wipedSidecar.overrides ?? {}).length;
            const restorable = canRestoreBackup(gameinfoPath, content);
            if (restorable) {
                return status(
                    'wiped',
                    'gameinfo.gi is empty or corrupt. Restore the Grimoire backup (or verify game files in Steam), then reapply.',
                    savedOverrides,
                    true
                );
            }
            const restoreNote = savedOverrides
                ? ` Your ${savedOverrides} saved override${savedOverrides === 1 ? '' : 's'} will be restored too.`
                : '';
            return {
                ...status(
                'wiped',
                `A game update reset gameinfo.gi and removed the performance config. Reapply to restore it.${restoreNote}`,
                savedOverrides
                ),
                convarValues,
                convarStates,
            };
        }
        return {
            ...status('not-applied', 'Performance config is not applied.'),
            convarValues,
            convarStates,
        };
    } catch (err) {
        return status('error', `Failed to read gameinfo.gi: ${err}`);
    }
}

/** Current values for every user-facing ConVar, HUD toggles and advanced
 *  sliders alike. This used to filter to HUD keys only, which meant the
 *  advanced sliders read `undefined` even immediately after the user set one
 *  and permanently claimed to be sitting on the game default. */
function readUserConvarValues(content: string): Record<string, string> {
    const normalized = content.includes('\r\n') ? content.split('\r\n').join('\n') : content;
    const values: Record<string, string> = {};
    for (const [key, info] of scanConvarLines(normalized).active) {
        values[key] = info.value;
    }
    return values;
}

function status(
    state: PerformanceConfigStatus['state'],
    message: string,
    overrideCount = 0,
    canRestore = false
): PerformanceConfigStatus {
    return {
        state,
        appliedVersion: state === 'applied' ? PRESET_VERSION : null,
        bundledVersion: PRESET_VERSION,
        overrideCount,
        ...(canRestore ? { canRestoreBackup: true } : {}),
        message,
    };
}

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf-8').digest('hex');
}

interface AppliedState {
    presetId: string;
    version: string;
    contentHash?: string;
    overrides?: Overrides;
}

function readAppliedState(gameinfoPath: string): AppliedState | null {
    try {
        const raw = readFileSync(statePath(gameinfoPath), 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.presetId === 'string' ? parsed : null;
    } catch {
        return null;
    }
}

function writeAppliedState(
    gameinfoPath: string,
    applied: boolean,
    contentHash?: string,
    overrides?: Overrides
): void {
    const file = statePath(gameinfoPath);
    try {
        if (applied) {
            const state: AppliedState = { presetId: PRESET_ID, version: PRESET_VERSION, contentHash };
            if (overrides && Object.keys(overrides).length) state.overrides = overrides;
            writeFileSync(file, JSON.stringify(state), 'utf-8');
        } else if (existsSync(file)) {
            unlinkSync(file);
        }
    } catch {
        // Best-effort: losing the sidecar only degrades wiped-detection to
        // "not applied"; it must never fail the apply/remove itself.
    }
}
