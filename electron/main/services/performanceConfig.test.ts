// Round-trip and isolation tests for the gameinfo.gi performance patcher.
//
// The load-bearing guarantee is that apply -> remove returns the user's file
// byte for byte, for every bundled preset, on both EOL styles, whatever the
// starting file looked like. Everything else in this feature (preset
// switching, opt-ins, overrides, wipe recovery) is layered on top of that, so
// it is asserted here rather than trusted.
//
// The fixture is the stock Deadlock gameinfo.gi the presets were diffed
// against (see scripts/performance-presets.json).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Without this, video.txt resolution would find the real Steam userdata.
const h = vi.hoisted(() => ({ steamRoot: '' }));
vi.mock('./steamRoots', () => ({ getSteamRoots: () => [h.steamRoot] }));
import {
    applyPerformanceConfig,
    getPerformanceConfigStatus,
    listPerformancePresets,
    reapplyWipedPerformanceConfig,
    removePerformanceConfig,
    resetPerformanceConfigOverrides,
    setPerformanceHudConvars,
    setPerformanceAdvancedConvars,
    clearPerformanceConvars,
} from './performanceConfig';
import { CLASSIFICATION, getFamily, getPreset } from './performanceConfigData';
import { pathExcluded } from './performancePresetGen';
import { CONFIG_KEY_BY_NAME } from './configKeyIndex';

const STOCK = readFileSync(join(__dirname, '__fixtures__/stock-gameinfo.gi'), 'utf-8').replace(/\r\n/g, '\n');
const STOCK_CRLF = STOCK.split('\n').join('\r\n');
const PRESETS = listPerformancePresets();

let gameRoot: string;
let gameinfo: string;
let sidecarPath: string;

beforeEach(() => {
    gameRoot = mkdtempSync(join(tmpdir(), 'grimoire-perf-'));
    h.steamRoot = join(gameRoot, 'steam');
    const dir = join(gameRoot, 'game', 'citadel');
    mkdirSync(dir, { recursive: true });
    gameinfo = join(dir, 'gameinfo.gi');
    sidecarPath = join(dir, 'grimoire-performance.json');
    writeFileSync(gameinfo, STOCK, 'utf-8');
});

afterEach(() => {
    rmSync(gameRoot, { recursive: true, force: true });
});

const read = () => readFileSync(gameinfo, 'utf-8');
const write = (text: string) => writeFileSync(gameinfo, text, 'utf-8');
const sidecar = () => (existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, 'utf-8')) : null);

/** Is `key` set on an active (uncommented) line? */
function activeHas(text: string, key: string): boolean {
    return text
        .split('\n')
        .some((line) => !line.trim().startsWith('//') && new RegExp(`(^|\\s)"?${key}"?\\s`).test(line));
}

/** Convar keys at the top level of the ConVars block. Nested constraint blocks
 *  (`rate { min/default/max }`) legitimately repeat their keys and are skipped. */
function topLevelConvarCounts(text: string): Map<string, number> {
    const start = text.indexOf('{', text.indexOf('\n    ConVars')) + 1;
    const counts = new Map<string, number>();
    let depth = 0;
    for (const line of text.slice(start).split('\n')) {
        const t = line.trim();
        if (t.startsWith('//')) continue;
        if (depth === 0 && t === '}') break;
        if (depth === 0) {
            const m = /^"?([A-Za-z_][\w.]*)"?\s+("[^"]*"|[^\s/]+)/.exec(t);
            if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
        }
        depth += (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
    }
    return counts;
}

describe('performance presets', () => {
    it('bundles a default preset and unique ids', () => {
        expect(PRESETS.length).toBeGreaterThanOrEqual(4);
        expect(PRESETS.filter((p) => p.isDefault)).toHaveLength(1);
        expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    });

    it('quarantines boot\'s crashing DistanceField edit', () => {
        expect(
            getPreset('boot-max-fps').sectionOps.some((op) => op.key === 'DistanceField')
        ).toBe(false);
    });

    it.each(PRESETS.map((p) => [p.id] as const))(
        '%s: apply then remove restores the file byte for byte (LF)',
        (id) => {
            expect(applyPerformanceConfig(gameRoot, { presetId: id }).state).toBe('applied');
            expect(read()).not.toBe(STOCK);
            expect(removePerformanceConfig(gameRoot).state).toBe('not-applied');
            expect(read()).toBe(STOCK);
        }
    );

    it.each(PRESETS.map((p) => [p.id] as const))(
        '%s: apply then remove restores the file byte for byte (CRLF)',
        (id) => {
            write(STOCK_CRLF);
            expect(applyPerformanceConfig(gameRoot, { presetId: id }).state).toBe('applied');
            removePerformanceConfig(gameRoot);
            expect(read()).toBe(STOCK_CRLF);
        }
    );

    it.each(PRESETS.map((p) => [p.id, p.version] as const))(
        '%s: writes a marker naming the preset and version',
        (id, version) => {
            applyPerformanceConfig(gameRoot, { presetId: id });
            expect(read()).toContain(`preset=${id} v${version}`);
        }
    );

    it.each(PRESETS.map((p) => [p.id] as const))(
        '%s: never writes a duplicate active convar, even with every opt-in on',
        (id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            applyPerformanceConfig(gameRoot, {
                presetId: id,
                optIns: preset.optIn.map((c) => c.key),
            });
            const dupes = [...topLevelConvarCounts(read())].filter(([, n]) => n > 1);
            expect(dupes).toEqual([]);
        }
    );

    it('is idempotent: applying repeatedly does not accumulate', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-max' });
        const once = read();
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-max' });
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-max' });
        expect(read()).toBe(once);
    });

    // Regression: the block used to splice in immediately after the `{` of
    // `ConVars {`, so trailing whitespace on that line rode along on the END
    // marker and vanished when Remove deleted it.
    it('preserves trailing whitespace after the ConVars opening brace', () => {
        const withTrailing = STOCK.replace(/(\n\s*ConVars\r?\n\s*\{)/, '$1\t ');
        expect(withTrailing).not.toBe(STOCK);
        write(withTrailing);
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(withTrailing);
    });
});

// Older releases are bundled so a user whose frame rate got worse after an
// upstream bump can go back. They are diffed against the CURRENT baseline, not
// the stock file of their own era, so "an old release still applies cleanly to
// today's gameinfo.gi" is an assumption that has to be tested rather than
// assumed: it is exactly what would rot silently as the game updates.
describe('preset version history', () => {
    /** Every (preset, bundled release) pair. */
    const ALL = PRESETS.flatMap((p) => p.versions.map((v) => [p.id, v.version] as const));

    it('every preset bundles at least one release, newest first', () => {
        for (const preset of PRESETS) {
            expect(preset.versions.length).toBeGreaterThanOrEqual(1);
            // The top-level fields must describe the newest release, or a caller
            // that ignores `versions` silently gets a different preset than the
            // one the card credits.
            expect(preset.versions[0].version).toBe(preset.version);
            const dates = preset.versions.map((v) => v.date);
            expect([...dates].sort().reverse()).toEqual(dates);
        }
    });

    it('no preset offers the same version twice', () => {
        for (const preset of PRESETS) {
            const versions = preset.versions.map((v) => v.version);
            expect(new Set(versions).size).toBe(versions.length);
        }
    });

    // `perf:presets --check` is not in CI (it needs the network), so this is
    // the offline guard against a regenerated body editing an excluded
    // section, e.g. the list-valued RenderModes.
    it.each(ALL)('%s v%s: no section op lands in an excluded section', (id, version) => {
        const ops = getPreset(id, version).sectionOps;
        expect(ops.filter((op) => pathExcluded(op.path, CLASSIFICATION.excludeSections))).toEqual([]);
    });

    it.each(ALL)('%s v%s: apply then remove restores the file byte for byte', (id, version) => {
        expect(applyPerformanceConfig(gameRoot, { presetId: id, version }).state).toBe('applied');
        expect(read()).not.toBe(STOCK);
        expect(removePerformanceConfig(gameRoot).state).toBe('not-applied');
        expect(read()).toBe(STOCK);
    });

    it.each(ALL)('%s v%s: writes a marker naming that release', (id, version) => {
        applyPerformanceConfig(gameRoot, { presetId: id, version });
        expect(read()).toContain(`preset=${id} v${version}`);
        expect(sidecar()?.version).toBe(version);
    });

    it.each(ALL)('%s v%s: no duplicate active convars with every opt-in on', (id, version) => {
        const release = PRESETS.find((p) => p.id === id)!.versions.find(
            (v) => v.version === version
        )!;
        applyPerformanceConfig(gameRoot, {
            presetId: id,
            version,
            optIns: release.optIn.map((c) => c.key),
        });
        const dupes = [...topLevelConvarCounts(read())].filter(([, n]) => n > 1);
        expect(dupes).toEqual([]);
    });

    const rollbackable = PRESETS.filter((p) => p.versions.length > 1);

    it('at least one preset has something to roll back to', () => {
        expect(rollbackable.length).toBeGreaterThan(0);
    });

    it.each(rollbackable.map((p) => [p.id] as const))(
        '%s: rolling back from newest to older leaves a clean file',
        (id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            const older = preset.versions[preset.versions.length - 1].version;
            applyPerformanceConfig(gameRoot, { presetId: id, version: preset.version });
            expect(read()).toContain(`preset=${id} v${preset.version}`);

            // Rolling back goes through the same revert-then-inject path as a
            // preset switch, so the newer release's lines must be gone, not
            // merely overwritten where the two happen to share a key.
            applyPerformanceConfig(gameRoot, { presetId: id, version: older });
            const after = read();
            expect(after).toContain(`preset=${id} v${older}`);
            expect(after).not.toContain(`v${preset.version})`);
            expect([...topLevelConvarCounts(after)].filter(([, n]) => n > 1)).toEqual([]);

            expect(removePerformanceConfig(gameRoot).state).toBe('not-applied');
            expect(read()).toBe(STOCK);
        }
    );

    it('an unknown version falls back to the newest release', () => {
        // A saved pin naming a release that has aged out of the bundle must not
        // error or write nothing: the window slides on every upstream bump.
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default', version: '0.0.1-gone' });
        const newest = PRESETS.find((p) => p.id === 'sqooky-default')!.version;
        expect(read()).toContain(`preset=sqooky-default v${newest}`);
    });

    // Release pairs where the newest holds back a gameplay key the older one
    // does not define at all. Asking for that key while the older release is
    // selected must drop it rather than write an unknown convar.
    const divergentOptIns = rollbackable.flatMap((p) =>
        p.versions.slice(1).flatMap((older) => {
            const onlyInNewest = p.versions[0].optIn
                .map((c) => c.key)
                .filter((key) => !older.optIn.some((c) => c.key === key));
            return onlyInNewest.length ? [[p.id, older.version, onlyInNewest] as const] : [];
        })
    );

    it('some release pair disagrees about opt-ins, so the next test is not vacuous', () => {
        expect(divergentOptIns.length).toBeGreaterThan(0);
    });

    it.each(divergentOptIns)(
        '%s v%s: opt-in keys are honoured per release, not per preset',
        (id, version, onlyInNewest) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            applyPerformanceConfig(gameRoot, {
                presetId: id,
                version,
                // Ask for every newest-release opt-in while an older release is
                // selected: the ones that release does not define must be dropped.
                optIns: preset.versions[0].optIn.map((c) => c.key),
            });
            const text = read();
            for (const key of onlyInNewest) expect(activeHas(text, key)).toBe(false);
        }
    );
});

describe('creator gameplay settings', () => {
    const withOptIns = PRESETS.filter((p) => p.optIn.length > 0);

    it('every preset exposes at least one creator gameplay convar', () => {
        expect(withOptIns.length).toBe(PRESETS.length);
    });

    it.each(withOptIns.map((p) => [p.id] as const))(
        '%s: defaults creator visibility/camera on and developer tools off',
        (id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            applyPerformanceConfig(gameRoot, { presetId: id });
            const text = read();
            for (const control of preset.optIn) {
                expect(activeHas(text, control.key), control.key).toBe(control.group !== 'devtools');
            }
        }
    );

    it.each(withOptIns.map((p) => [p.id] as const))(
        '%s: an explicit empty selection disables every creator gameplay setting',
        (id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            applyPerformanceConfig(gameRoot, { presetId: id, optIns: [] });
            const text = read();
            const included = preset.optIn.filter((c) => activeHas(text, c.key));
            expect(included.map((c) => c.key)).toEqual([]);
        }
    );

    it.each(withOptIns.map((p) => [p.id] as const))(
        '%s: writes exactly the selected keys and no others',
        (id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            const chosen = preset.optIn.slice(0, 2).map((c) => c.key);
            applyPerformanceConfig(gameRoot, { presetId: id, optIns: chosen });
            const text = read();
            for (const key of chosen) expect(activeHas(text, key)).toBe(true);
            const unwanted = preset.optIn
                .filter((c) => !chosen.includes(c.key) && activeHas(text, c.key))
                .map((c) => c.key);
            expect(unwanted).toEqual([]);
        }
    );

    it('removing after applying every creator setting still restores the file exactly', () => {
        const preset = PRESETS.find((p) => p.optIn.length)!;
        applyPerformanceConfig(gameRoot, {
            presetId: preset.id,
            optIns: preset.optIn.map((c) => c.key),
        });
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(STOCK);
    });

    it('ignores creator-setting keys the preset does not define', () => {
        applyPerformanceConfig(gameRoot, {
            presetId: 'sqooky-default',
            optIns: ['definitely_not_a_convar'],
        });
        expect(activeHas(read(), 'definitely_not_a_convar')).toBe(false);
    });
});

describe('preset switching', () => {
    it('replaces the previous preset instead of stacking on it', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const result = applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const text = read();

        expect(result.state).toBe('applied');
        expect(text).toContain('preset=optilock-fps');
        expect(text).not.toContain('preset=sqooky-default');
        expect(text.match(/Grimoire Performance Config BEGIN/g)).toHaveLength(1);
        expect(getPerformanceConfigStatus(gameRoot).appliedPresetId).toBe('optilock-fps');
    });

    it('restores the stock file after cycling through every preset', () => {
        for (const preset of PRESETS) applyPerformanceConfig(gameRoot, { presetId: preset.id });
        expect(read().match(/Grimoire Performance Config BEGIN/g)).toHaveLength(1);
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(STOCK);
    });

    it('falls back to the default preset for an unknown id', () => {
        const result = applyPerformanceConfig(gameRoot, { presetId: 'no-such-preset' });
        expect(result.state).toBe('applied');
        expect(read()).toContain(`preset=${PRESETS.find((p) => p.isDefault)!.id}`);
    });
});

describe('overrides', () => {
    // Hand-edit whichever key the preset actually injected: which settings a
    // preset owns changes with every upstream bump.
    function editFirstInjectedKey(value: string): string {
        const line = read()
            .split('\n')
            .find((l) => l.includes('// grimoire-perf added') && /^\s*[A-Za-z_]/.test(l))!;
        const key = /^\s*"?([A-Za-z_][\w.]*)"?\s/.exec(line)![1];
        write(
            read().replace(
                new RegExp(`^(\\s*"?${key}"?\\s+)("[^"]*"|\\S+)(\\s*// grimoire-perf added)$`, 'm'),
                `$1"${value}"$3`
            )
        );
        return key;
    }

    // The key may sit under ConVars or under an engine section (injected
    // section ops carry the same marker), so match on the leaf rather than
    // assuming a path.
    const bankedValue = (presetId: string, key: string): string | undefined => {
        const map: Record<string, { value?: string }> =
            sidecar()?.overridesByPreset?.[presetId] ?? {};
        return Object.entries(map).find(([k]) => k.endsWith(`/${key}`))?.[1]?.value;
    };

    it('harvests a hand edit and keeps it across reapplies', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const key = editFirstInjectedKey('144');

        const result = applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(result.overrideCount).toBeGreaterThanOrEqual(1);
        expect(read()).toMatch(new RegExp(`${key}\\s+"144"`));
        expect(bankedValue('sqooky-default', key)).toBe('144');
    });

    it('does not carry an override into a differently tuned preset', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const key = editFirstInjectedKey('144');
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(read()).not.toMatch(new RegExp(`${key}\\s+"144"`));
        // Still remembered for the preset it was made against.
        expect(bankedValue('sqooky-default', key)).toBe('144');

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(read()).toMatch(new RegExp(`${key}\\s+"144"`));
    });

    it('drops overrides on reset', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const key = editFirstInjectedKey('144');
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });

        resetPerformanceConfigOverrides(gameRoot, { presetId: 'sqooky-default' });
        expect(read()).not.toMatch(new RegExp(`${key}\\s+"144"`));
    });

    it('drops an excluded key an earlier build wrote instead of banking it as the user\'s', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato' });
        // What a build from before r_lightmap_size was excluded left behind.
        write(
            read().replace(
                /^(.*Grimoire Performance Config BEGIN.*)$/m,
                '$1\n\t\tr_lightmap_size "0" // grimoire-perf added'
            )
        );

        const result = applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato' });
        expect(result.overrideCount).toBe(0);
        expect(activeHas(read(), 'r_lightmap_size')).toBe(false);
        expect(bankedValue('optilock-ultra-potato', 'r_lightmap_size')).toBeUndefined();
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(STOCK);
    });

    it('does not read a key the old rules excluded as one the user deleted', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato' });
        // The file as a build that still excluded r_render_portals wrote it.
        write(read().replace(/^.*\br_render_portals\b.*\n/m, ''));
        writeFileSync(sidecarPath, JSON.stringify({ ...sidecar(), classification: 'older-rules' }), 'utf-8');

        const result = applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato' });
        expect(result.overrideCount).toBe(0);
        expect(activeHas(read(), 'r_render_portals')).toBe(true);
    });

    it('still removes cleanly with overrides in play', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        editFirstInjectedKey('144');
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(STOCK);
    });
});

describe('game-update wipe recovery', () => {
    it('detects a wipe and re-layers saved overrides on reapply', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const line = read()
            .split('\n')
            .find((l) => l.includes('// grimoire-perf added') && /^\s*[A-Za-z_]/.test(l))!;
        const key = /^\s*"?([A-Za-z_][\w.]*)"?\s/.exec(line)![1];
        write(
            read().replace(
                new RegExp(`^(\\s*"?${key}"?\\s+)("[^"]*"|\\S+)(\\s*// grimoire-perf added)$`, 'm'),
                '$1"144"$3'
            )
        );
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });

        // A game update replaces gameinfo.gi but leaves the sidecar alone.
        write(STOCK);
        const status = getPerformanceConfigStatus(gameRoot);
        expect(status.state).toBe('wiped');
        expect(status.overrideCount).toBe(1);

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(read()).toMatch(new RegExp(`${key}\\s+"144"`));
    });

    // Sidecars written before multi-preset support stored one flat override
    // map; it belongs to whichever preset was applied at the time.
    it('migrates a legacy flat sidecar into the per-preset map', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        writeFileSync(
            sidecarPath,
            JSON.stringify({
                presetId: 'sqooky-default',
                version: '2.4.6',
                overrides: { 'ConVars/r_ssao': { value: '1' } },
            }),
            'utf-8'
        );
        write(STOCK);

        const status = getPerformanceConfigStatus(gameRoot);
        expect(status.state).toBe('wiped');
        expect(status.overrideCount).toBe(1);

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(read()).toMatch(/r_ssao\s+"1"/);
        expect(sidecar().overridesByPreset['sqooky-default']['ConVars/r_ssao'].value).toBe('1');
        expect(sidecar().overrides).toBeUndefined();
    });
});

// A Grimoire update can change what a preset id MEANS: same id, different key
// list and values (sqooky-default went 2.4.6 -> 2.7 exactly this way). The file
// on disk still carries the old body, and the status message invites the user to
// reapply. Nothing about that older body is user intent, and reading it as such
// pinned retired upstream values forever, suppressed every key the new version
// added, and re-applied gameplay convars the creator-setting split keeps separate.
describe('a bundled preset whose definition moved under an applied file', () => {
    const DEFAULT_ID = 'sqooky-default';

    /** Rewrite the applied file to look like an older version of the same
     *  preset wrote it: an older marker version, one convar the current body no
     *  longer lists, one current convar missing entirely, and a gameplay convar
     *  the old body used to apply outright. */
    function rewriteAsOlderVersion(optInKey: string, optInValue: string): string {
        const preset = PRESETS.find((p) => p.id === DEFAULT_ID)!;
        const lines = read().split('\n');
        const beginAt = lines.findIndex((l) => l.includes('Performance Config BEGIN'));
        lines[beginAt] = lines[beginAt].replace(`v${preset.version}`, 'v2.4.6');

        // A key the current body still has, deleted from the file the way an
        // older version that never shipped it would leave things.
        const droppedAt = lines.findIndex(
            (l, i) => i > beginAt && l.includes('// grimoire-perf added') && /^\s*[A-Za-z_]/.test(l)
        );
        const stillBundled = /^\s*"?([A-Za-z_][\w.]*)"?\s/.exec(lines[droppedAt])![1];
        lines.splice(droppedAt, 1);

        const indent = /^[ \t]*/.exec(lines[beginAt])![0];
        lines.splice(
            beginAt + 1,
            0,
            `${indent}retired_upstream_convar "7" // grimoire-perf added`,
            `${indent}${optInKey} "${optInValue}" // grimoire-perf added`
        );
        write(lines.join('\n'));
        return stillBundled;
    }

    it('does not mistake the older body for the user hand-editing the file', () => {
        const preset = PRESETS.find((p) => p.id === DEFAULT_ID)!;
        const control = preset.optIn[0];
        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        const stillBundled = rewriteAsOlderVersion(control.key, control.value);

        const result = applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID, optIns: [] });
        const text = read();

        expect(result.overrideCount).toBe(0);
        expect(sidecar().overridesByPreset).toBeUndefined();
        // A convar the new version retired does not come back as "the user's".
        expect(activeHas(text, 'retired_upstream_convar')).toBe(false);
        // A convar the new version adds is written, not suppressed as a deletion.
        expect(activeHas(text, stillBundled)).toBe(true);
        // And the gameplay convar the old body applied silently stays out.
        expect(activeHas(text, control.key)).toBe(false);
    });

    it('still honours a line the user commented out, the one unambiguous signal', () => {
        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        const preset = PRESETS.find((p) => p.id === DEFAULT_ID)!;
        const line = read()
            .split('\n')
            .find((l) => l.includes('// grimoire-perf added') && /^\s*[A-Za-z_]/.test(l))!;
        const key = /^\s*"?([A-Za-z_][\w.]*)"?\s/.exec(line)![1];
        write(
            read()
                .replace(line, line.replace(/^(\s*)/, '$1// '))
                .replace(`v${preset.version}`, 'v2.4.6')
        );

        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        expect(activeHas(read(), key)).toBe(false);
        // The key may sit under ConVars or under an engine section, so match on
        // the leaf rather than assuming a path.
        const banked: Record<string, unknown> = sidecar().overridesByPreset[DEFAULT_ID] ?? {};
        expect(Object.entries(banked).find(([k]) => k.endsWith(`/${key}`))?.[1]).toEqual({
            omit: true,
        });
    });

    // These upstreams version in prose (Sqooky publishes no tags at all), so a
    // regenerated preset can easily carry the same version string and a
    // different body. The marker records the pinned commit for that reason.
    it('notices a regenerated preset even when the version string is unchanged', () => {
        const preset = PRESETS.find((p) => p.id === DEFAULT_ID)!;
        const control = preset.optIn[0];
        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        write(read().replace(/@[0-9a-f]{12}\)/, '@0123456789ab)'));
        const stillBundled = (() => {
            const lines = read().split('\n');
            const at = lines.findIndex(
                (l) => l.includes('// grimoire-perf added') && /^\s*[A-Za-z_]/.test(l)
            );
            const key = /^\s*"?([A-Za-z_][\w.]*)"?\s/.exec(lines[at])![1];
            const indent = /^[ \t]*/.exec(lines[at])![0];
            lines.splice(at, 1, `${indent}${control.key} "${control.value}" // grimoire-perf added`);
            write(lines.join('\n'));
            return key;
        })();

        const result = applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID, optIns: [] });
        expect(result.overrideCount).toBe(0);
        expect(activeHas(read(), control.key)).toBe(false);
        expect(activeHas(read(), stillBundled)).toBe(true);
    });

    it('treats a marker with no recorded commit as unprovable rather than current', () => {
        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        // A marker in the shape written before the commit was recorded.
        write(read().replace(/ @[0-9a-f]{12}\)/, ')'));
        const indent = /^([ \t]*)\/\/ ==== Grimoire/m.exec(read())![1];
        write(
            read().replace(
                /(\/\/ ==== Grimoire Performance Config BEGIN[^\n]*\n)/,
                `$1${indent}retired_upstream_convar "7" // grimoire-perf added\n`
            )
        );

        const result = applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        expect(result.overrideCount).toBe(0);
        expect(activeHas(read(), 'retired_upstream_convar')).toBe(false);
        // And the file is still fully reversible afterwards.
        removePerformanceConfig(gameRoot);
        expect(read()).toBe(STOCK);
    });

    it('keeps harvesting hand edits when the version has not moved', () => {
        applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        const indent = /^([ \t]*)\/\/ ==== Grimoire/m.exec(read())![1];
        write(
            read().replace(
                /(\/\/ ==== Grimoire Performance Config BEGIN[^\n]*\n)/,
                `$1${indent}my_own_convar "3" // grimoire-perf added\n`
            )
        );

        const result = applyPerformanceConfig(gameRoot, { presetId: DEFAULT_ID });
        expect(result.overrideCount).toBe(1);
        expect(activeHas(read(), 'my_own_convar')).toBe(true);
    });
});

describe('opt-ins without a sidecar', () => {
    // The sidecar is the only record of which opt-ins were written. Losing it
    // (hand-copied gameinfo.gi, a wiped userData, a user tidying up) must not
    // turn an opted-in convar into a permanent user override that survives the
    // user turning it back off.
    it('does not turn an opted-in convar into a permanent override', () => {
        const preset = PRESETS.find((p) => p.optIn.length)!;
        const control = preset.optIn[0];
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [control.key] });
        expect(activeHas(read(), control.key)).toBe(true);

        rmSync(sidecarPath, { force: true });
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [] });

        expect(activeHas(read(), control.key)).toBe(false);
        expect(sidecar().overridesByPreset).toBeUndefined();
    });
});


describe('HUD and advanced controls', () => {
    it('layers staged HUD and advanced values onto the active preset', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(setPerformanceHudConvars(gameRoot, { citadel_unit_status_use_new: true }).state).toBe('applied');
        expect(setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 }).state).toBe('applied');
        const state = getPerformanceConfigStatus(gameRoot);
        expect(state.convarValues?.citadel_unit_status_use_new).toBe('true');
        expect(state.convarValues?.citadel_minimap_player_width).toBe('10');
    });

    it('clears only a managed HUD or advanced setting', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 });
        const result = clearPerformanceConvars(gameRoot, ['citadel_minimap_player_width']);
        expect(result.state).toBe('applied');
        expect(read()).not.toContain('citadel_minimap_player_width "10"');
    });
});

describe('resolved ConVar status', () => {
    it('reports autoexec.cfg as the winning source for every indexed preset key', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        const cfg = join(gameRoot, 'game', 'citadel', 'cfg');
        mkdirSync(cfg, { recursive: true });
        writeFileSync(join(cfg, 'autoexec.cfg'), 'r_depth_of_field 1\n', 'utf-8');

        const state = getPerformanceConfigStatus(gameRoot).convarStates?.r_depth_of_field;
        expect(state).toMatchObject({
            value: '0',
            presetValue: '0',
            resolvedValue: '1',
            resolvedFrom: 'autoexec.cfg',
            autoexec: { value: '1', line: 1, managed: false },
        });
    });
});

// engineDefault is what a console reading reports, distinct from gameDefault
// (what stock gameinfo.gi writes). The catalogue ships every entry null until
// a reading exists, so these cases stage a reading by mutating the live
// CONFIG_KEY_BY_NAME definition rather than waiting on real console data.
describe('engine default', () => {
    const ENUM_KEY = 'citadel_hud_objective_health_enabled'; // numeric, gameDefault: null
    const HUD_KEY = 'citadel_unit_status_use_new'; // boolean, gameDefault: null

    const setEngineDefault = (key: string, value: string | null) => {
        const definition = CONFIG_KEY_BY_NAME.get(key);
        if (!definition) throw new Error(`unknown key ${key}`);
        (definition as { engineDefault: string | null }).engineDefault = value;
    };

    afterEach(() => {
        // Reset every key this describe block might have mutated so no other
        // test in the file observes a staged reading.
        setEngineDefault(ENUM_KEY, null);
        setEngineDefault(HUD_KEY, null);
    });

    /** Insert a raw ConVars line directly, without going through a preset or
     *  either writer, so the test controls the exact on-disk spelling. */
    const writeConvarLine = (key: string, rawValue: string) =>
        write(STOCK.replace(/(\n(\s*)ConVars\s*\n\s*\{)/, `$1\n$2\t${key} ${rawValue}`));

    it('a file value equal to the engine default reports the game-default origin', () => {
        setEngineDefault(ENUM_KEY, '2');
        writeConvarLine(ENUM_KEY, '2');
        const state = getPerformanceConfigStatus(gameRoot).convarStates![ENUM_KEY];
        expect(state.engineDefault).toBe('2');
        expect(state.origin).toBe('game-default');
    });

    it('a file value differing from both defaults still reports the user-override origin', () => {
        setEngineDefault(ENUM_KEY, '2');
        writeConvarLine(ENUM_KEY, '1');
        const state = getPerformanceConfigStatus(gameRoot).convarStates![ENUM_KEY];
        expect(state.engineDefault).toBe('2');
        expect(state.origin).toBe('user-override');
    });

    it('an unset key reports the engine default as its resolved value and keeps the game-default source', () => {
        setEngineDefault(ENUM_KEY, '2');
        const state = getPerformanceConfigStatus(gameRoot).convarStates![ENUM_KEY];
        expect(state.value).toBeNull();
        expect(state.engineDefault).toBe('2');
        expect(state.resolvedValue).toBe('2');
        expect(state.resolvedFrom).toBe('game-default');
    });

    it('a quoting-only or 1-versus-true spelling difference still reports the game-default origin', () => {
        setEngineDefault(HUD_KEY, 'true');
        writeConvarLine(HUD_KEY, '"1"');
        const state = getPerformanceConfigStatus(gameRoot).convarStates![HUD_KEY];
        expect(state.engineDefault).toBe('true');
        expect(state.origin).toBe('game-default');
    });

    it('a numeric key with an out-of-range engine default carries it verbatim and still reports out of range', () => {
        // Declared range for ENUM_KEY is 0-2; 5 is outside it. The reading is
        // recorded as-is, not clamped into range.
        setEngineDefault(ENUM_KEY, '5');
        writeConvarLine(ENUM_KEY, '5');
        const state = getPerformanceConfigStatus(gameRoot).convarStates![ENUM_KEY];
        expect(state.engineDefault).toBe('5');
        expect(state.outOfRange).toBe(true);
    });

    it('two consecutive status reads against an unchanged game root return deeply equal convarStates', () => {
        setEngineDefault(ENUM_KEY, '2');
        const first = getPerformanceConfigStatus(gameRoot).convarStates;
        const second = getPerformanceConfigStatus(gameRoot).convarStates;
        expect(second).toEqual(first);
    });
});

// #17. These are fork-owned personal preferences, not a deviation from whichever
// preset happens to be applied, and they used to exist only as text inside the
// marked block: re-parsed on every apply, so anything that made the applied body
// untrustworthy took them with it. Two paths lost them outright.
//
// The fixture for the first is drift: a Grimoire update that moves a preset
// definition under an applied file. harvestOverrides deliberately stops reading
// user intent out of a body it can no longer attribute, and these values were
// riding in that same channel.
describe('HUD and advanced values are the user\'s own state', () => {
    const HUD_KEY = 'citadel_unit_status_use_v2';
    const value = (key: string) => getPerformanceConfigStatus(gameRoot).convarValues?.[key] ?? null;

    /** A Grimoire update that regenerated this preset: same id, same version
     *  string, different pinned commit. */
    const moveDefinition = () => write(read().replace(/@[0-9a-f]{12}\)/, '@0123456789ab)'));

    it('survives a preset definition moving under the applied file', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 });

        moveDefinition();
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });

        expect(value(HUD_KEY)).toBe('true');
        expect(value('citadel_minimap_player_width')).toBe('10');
    });

    it('survives a preset switch, unlike a preset override', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(value(HUD_KEY)).toBe('true');
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');
    });

    it('survives a reapply and a game-update wipe', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');

        write(STOCK);
        expect(getPerformanceConfigStatus(gameRoot).state).toBe('wiped');
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');
    });

    // The other loss path, and the one with no drift in it: the key already had
    // a line in the user's ConVars section, so it was edited in place with a
    // `was` marker instead of injected. Only preset keys were read back out of
    // those, so the value reverted on the very next reapply.
    it('survives when the key already had a line in the file', () => {
        write(STOCK.replace(/(\n(\s*)ConVars\s*\n\s*\{)/, `$1\n$2\t${HUD_KEY} "false"`));
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        expect(value(HUD_KEY)).toBe('true');

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');
    });

    // Unchanged contract: a hand edit to a managed convar is harvested on the
    // next apply and wins. It just lands in the control store now.
    it('still lets a hand edit win', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        write(read().replace(new RegExp(`(${HUD_KEY}\\s+)"true"`), '$1"false"'));

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('false');
        expect(sidecar().userConvars[HUD_KEY]).toEqual({ value: 'false' });
    });

    it('does not resurrect a value the row reset cleared', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        clearPerformanceConvars(gameRoot, [HUD_KEY]);
        expect(value(HUD_KEY)).toBeNull();

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBeNull();
    });

    // A row reset rewrites gameinfo.gi, so it has to re-stamp the content hash.
    // Otherwise the very next status read calls the user's own reset a hand edit.
    it('does not report its own row reset as a hand edit', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 });
        clearPerformanceConvars(gameRoot, ['citadel_minimap_player_width']);
        expect(getPerformanceConfigStatus(gameRoot).handEdited).toBe(false);
    });

    // Existing installs kept these in the per-preset override map, the only home
    // they had. They must move across, not reset to defaults.
    it('migrates values stored as per-preset overrides', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        writeFileSync(
            sidecarPath,
            JSON.stringify({
                presetId: 'sqooky-default',
                version: '2.4.6',
                overridesByPreset: {
                    'sqooky-default': {
                        [`ConVars/${HUD_KEY}`]: { value: 'true' },
                        'ConVars/r_ssao': { value: '1' },
                    },
                },
            }),
            'utf-8'
        );
        write(STOCK);

        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');
        expect(sidecar().userConvars[HUD_KEY]).toEqual({ value: 'true' });
        // And it stops being counted and applied as a preset override.
        expect(sidecar().overridesByPreset['sqooky-default'][`ConVars/${HUD_KEY}`]).toBeUndefined();
        expect(sidecar().overridesByPreset['sqooky-default']['ConVars/r_ssao']).toEqual({ value: '1' });
    });

    // #18 moved these under Game Configuration, where there is no preset in
    // sight. Requiring one was a dead end: the controls rendered, accepted an
    // edit, and failed on apply with "apply a performance preset first".
    it('writes without a performance preset applied', () => {
        expect(getPerformanceConfigStatus(gameRoot).state).toBe('not-applied');
        expect(setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true }).state).toBe('not-applied');
        expect(value(HUD_KEY)).toBe('true');
        expect(setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 }).state).toBe(
            'not-applied'
        );
        expect(value('citadel_minimap_player_width')).toBe('10');

        // Re-writing the same key replaces the value rather than stacking lines.
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: false });
        expect(value(HUD_KEY)).toBe('false');
        expect([...topLevelConvarCounts(read())].filter(([, n]) => n > 1)).toEqual([]);
    });

    // A sidecar holding only control values is not evidence that a preset was
    // wiped, and it must not make the app claim a game update removed one.
    it('does not report a preset as wiped when none was ever applied', () => {
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        const state = getPerformanceConfigStatus(gameRoot);
        expect(state.state).toBe('not-applied');
        expect(state.handEdited).toBeFalsy();
    });

    it('resets a standalone value back to the game default', () => {
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        expect(clearPerformanceConvars(gameRoot, [HUD_KEY]).state).toBe('not-applied');
        expect(value(HUD_KEY)).toBeNull();
    });

    // Applying a preset over standalone values keeps them, and removing the
    // preset afterwards must not take them with it: they were never the
    // preset's to remove.
    it('keeps standalone values across a preset apply and remove', () => {
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        expect(value(HUD_KEY)).toBe('true');
        removePerformanceConfig(gameRoot);
        expect(value(HUD_KEY)).toBe('true');
    });

    it('still removes cleanly, restoring the file byte for byte', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });
        setPerformanceHudConvars(gameRoot, { [HUD_KEY]: true });
        setPerformanceAdvancedConvars(gameRoot, { citadel_minimap_player_width: 10 });
        moveDefinition();
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-default' });

        expect(removePerformanceConfig(gameRoot).state).toBe('not-applied');
        expect(read()).toBe(STOCK);
    });
});


describe('toggled-off opt-ins with a banked override', () => {
    const preset = PRESETS.find((p) => p.optIn.length)!;
    const control = preset.optIn[0];
    const edited = control.value === '3.3' ? '4.4' : '3.3';

    it('does not write a hand-edited opt-in once it is toggled off (sidecar predates optIns)', () => {
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [control.key] });
        write(
            read().replace(
                new RegExp(`^(\\s*"?${control.key}"?\\s+)("[^"]*"|\\S+)(\\s*// grimoire-perf added)$`, 'm'),
                `$1"${edited}"$3`
            )
        );
        const older = sidecar();
        delete older.optIns;
        writeFileSync(sidecarPath, JSON.stringify(older), 'utf-8');

        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [] });
        expect(activeHas(read(), control.key)).toBe(false);
    });

    it('does not write a banked opt-in override while the opt-in is off, but keeps user convars', () => {
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [] });
        writeFileSync(
            sidecarPath,
            JSON.stringify({
                ...sidecar(),
                overridesByPreset: {
                    [preset.id]: {
                        [`ConVars/${control.key}`]: { value: edited },
                        'ConVars/my_own_convar': { value: '3' },
                    },
                },
            }),
            'utf-8'
        );
        // A game update wiped the file, so the banked overrides are re-layered as is.
        write(STOCK);

        const result = applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [] });
        expect(activeHas(read(), control.key)).toBe(false);
        expect(activeHas(read(), 'my_own_convar')).toBe(true);
        expect(result.message).toContain('Kept 2 of your overrides.');
    });
});

describe('managed convar values reported from the file', () => {
    const preset = PRESETS.find((p) => p.optIn.length)!;
    const control = preset.optIn[0];
    const edited = control.value === '3.3' ? '4.4' : '3.3';
    const editValue = (content: string) =>
        content.replace(
            new RegExp(`^(\\s*"?${control.key}"?\\s+)("[^"]*"|\\S+)(\\s*// grimoire-perf added)`, 'm'),
            `$1"${edited}"$3`
        );

    it('reports what gameinfo.gi actually holds, including hand edits', () => {
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [control.key] });
        expect(getPerformanceConfigStatus(gameRoot).managedConvarValues?.[control.key]).toBe(control.value);

        write(editValue(read()));
        expect(getPerformanceConfigStatus(gameRoot).managedConvarValues?.[control.key]).toBe(edited);
    });

    it('reads CRLF files (Windows)', () => {
        write(STOCK_CRLF);
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [control.key] });
        write(editValue(read()));
        expect(getPerformanceConfigStatus(gameRoot).managedConvarValues?.[control.key]).toBe(edited);
    });

    it('leaves out keys that are absent or outside the Grimoire block', () => {
        applyPerformanceConfig(gameRoot, { presetId: preset.id, optIns: [] });
        write(read().replace(/ConVars\s*\{/, (m) => `${m}\n\t\t${control.key} "${edited}"`));
        expect(getPerformanceConfigStatus(gameRoot).managedConvarValues).not.toHaveProperty(control.key);
    });
});

describe('hand-edited opt-ins survive the toggle', () => {
    const preset = PRESETS.find((p) => p.optIn.length)!;
    const control = preset.optIn[0];
    const edited = control.value === '3.3' ? '4.4' : '3.3';
    const editValue = () =>
        write(
            read().replace(
                new RegExp(`^(\\s*"?${control.key}"?\\s+)("[^"]*"|\\S+)(\\s*// grimoire-perf added)`, 'm'),
                `$1"${edited}"$3`
            )
        );
    const valueOf = () => getPerformanceConfigStatus(gameRoot).managedConvarValues?.[control.key];
    const on = { presetId: preset.id, optIns: [control.key] };
    const off = { presetId: preset.id, optIns: [] };

    it('keeps a hand edit on an enabled opt-in across reapplies', () => {
        applyPerformanceConfig(gameRoot, on);
        editValue();
        applyPerformanceConfig(gameRoot, on);
        applyPerformanceConfig(gameRoot, on);
        expect(valueOf()).toBe(edited);
    });

    it('holds the edit while toggled off and restores it when toggled back on', () => {
        applyPerformanceConfig(gameRoot, on);
        editValue();
        applyPerformanceConfig(gameRoot, off);
        expect(activeHas(read(), control.key)).toBe(false);
        expect(getPerformanceConfigStatus(gameRoot).savedConvarValues?.[control.key]).toBe(edited);
        applyPerformanceConfig(gameRoot, off);
        applyPerformanceConfig(gameRoot, on);
        expect(valueOf()).toBe(edited);
    });

    it('keeps the held edit across a switch to another preset and back', () => {
        const other = PRESETS.find((p) => p.id !== preset.id)!;
        applyPerformanceConfig(gameRoot, on);
        editValue();
        applyPerformanceConfig(gameRoot, off);
        applyPerformanceConfig(gameRoot, { presetId: other.id, optIns: [] });
        applyPerformanceConfig(gameRoot, on);
        expect(valueOf()).toBe(edited);
    });

    it('keeps a commented-out opt-in omitted after toggling off and on', () => {
        applyPerformanceConfig(gameRoot, on);
        write(
            read().replace(
                new RegExp(`^(\\s*)("?${control.key}"?\\s+("[^"]*"|\\S+)\\s*// grimoire-perf added)`, 'm'),
                '$1// $2'
            )
        );
        applyPerformanceConfig(gameRoot, on);
        applyPerformanceConfig(gameRoot, off);
        applyPerformanceConfig(gameRoot, off);
        applyPerformanceConfig(gameRoot, on);
        expect(activeHas(read(), control.key)).toBe(false);
    });
});

describe('outdated', () => {
    const sidecarPath = () => join(gameRoot, 'game', 'citadel', 'grimoire-performance.json');

    it('is unset right after an apply', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(getPerformanceConfigStatus(gameRoot).outdated).toBeUndefined();
    });

    it('flags a file written from another upstream commit of the same release', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        write(read().replace(/(BEGIN \(preset=optilock-fps v[^ ]+ @)[0-9a-f]+/, '$1e3c48af610e9'));
        expect(getPerformanceConfigStatus(gameRoot).outdated).toBe(true);

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(getPerformanceConfigStatus(gameRoot).outdated).toBeUndefined();
    });

    it('flags a file written under older rules (a sidecar without the rules fingerprint)', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const sidecar = JSON.parse(readFileSync(sidecarPath(), 'utf-8'));
        delete sidecar.classification;
        writeFileSync(sidecarPath(), JSON.stringify(sidecar), 'utf-8');
        expect(getPerformanceConfigStatus(gameRoot).outdated).toBe(true);
    });
});

describe('video.txt settings', () => {
    // Shaped like the file Deadlock writes, display settings included.
    const VIDEO = `"video.cfg"
{
\t"Version"\t\t"20"
\t"VendorID"\t\t"4318"
\t"DeviceID"\t\t"11269"
\t"setting.cpu_level"\t\t"2"
\t"setting.gpu_level"\t\t"3"
\t"setting.defaultres"\t\t"2560"
\t"setting.defaultresheight"\t\t"1440"
\t"setting.fullscreen"\t\t"0"
\t"setting.nowindowborder"\t\t"1"
\t"setting.mat_vsync"\t\t"1"
\t"setting.monitor_index"\t\t"1"
\t"setting.r_fullscreen_gamma"\t\t"2.200000"
\t"setting.r_citadel_shadow_quality"\t\t"2"
\t"setting.r_texture_stream_mip_bias"\t\t"0"
}
`;
    const VIDEO_PRESETS = PRESETS.filter((p) => p.versions[0].videoSettingCount > 0);
    const WITHOUT_VIDEO = PRESETS.find((p) => p.versions[0].videoSettingCount === 0)!;
    let videoPath: string;
    const readVideo = () => readFileSync(videoPath, 'utf-8');

    beforeEach(() => {
        const cfg = join(gameRoot, 'game', 'citadel', 'cfg');
        mkdirSync(cfg, { recursive: true });
        videoPath = join(cfg, 'video.txt');
        writeFileSync(videoPath, VIDEO, 'utf-8');
    });

    it('ships video settings for the presets whose upstream has a video.txt', () => {
        expect(VIDEO_PRESETS.map((p) => p.id)).toEqual(
            expect.arrayContaining(['optilock-fps', 'optilock-max', 'sqooky-testing'])
        );
    });

    it('round-trips video.txt and gameinfo.gi for every preset that ships one', () => {
        for (const preset of VIDEO_PRESETS) {
            applyPerformanceConfig(gameRoot, { presetId: preset.id });
            expect(readVideo()).not.toBe(VIDEO);
            removePerformanceConfig(gameRoot);
            expect(readVideo()).toBe(VIDEO);
            expect(read()).toBe(STOCK);
        }
    });

    it('writes render settings but never the display ones', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'sqooky-testing' });
        const text = readVideo();
        expect(text).not.toBe(VIDEO);
        for (const line of [
            '"DeviceID"\t\t"11269"',
            '"setting.defaultres"\t\t"2560"',
            '"setting.defaultresheight"\t\t"1440"',
            '"setting.fullscreen"\t\t"0"',
            '"setting.mat_vsync"\t\t"1"',
            '"setting.monitor_index"\t\t"1"',
            '"setting.r_fullscreen_gamma"\t\t"2.200000"',
        ]) {
            expect(text).toContain(line);
        }
        expect(text).not.toMatch(/setting\.(fps_max|aspectratiomode|knowndevice|r_citadel_outlines)"/);
    });

    it("writes OptiLock's video.txt as shipped, display settings included", () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const text = readVideo();
        expect(text).toContain('"DeviceID"\t\t"11269"');
        expect(text).toContain('"setting.r_citadel_shadow_quality"\t\t"0"');
        expect(text).toContain('"setting.defaultres"\t\t"-1"');
        expect(text).toContain('"setting.fps_max"\t\t"0"');
        // The gameinfo.gi toggle owns outlines.
        expect(text).not.toMatch(/setting\.r_citadel_outlines"/);

        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO);
    });

    it('leaves video.txt alone for a preset without one, and takes back what another wrote', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        applyPerformanceConfig(gameRoot, { presetId: WITHOUT_VIDEO.id });
        expect(readVideo()).toBe(VIDEO);
        expect(getPerformanceConfigStatus(gameRoot).video).toBeUndefined();
    });

    it('reports how many written values the game has changed since', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const { video } = getPerformanceConfigStatus(gameRoot);
        expect(video!.total).toBeGreaterThan(0);
        expect(video!.applied).toBe(video!.total);

        writeFileSync(
            videoPath,
            readVideo().replace(/("setting\.r_citadel_shadow_quality"\t\t)"0"/, '$1"2"'),
            'utf-8'
        );
        expect(getPerformanceConfigStatus(gameRoot).video!.applied).toBe(video!.total - 1);
    });

    it('a reapply keeps a value changed in game, and Remove leaves it too', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const edited = readVideo().replace(/("setting\.cpu_level"\t\t)"1"/, '$1"3"');
        writeFileSync(videoPath, edited, 'utf-8');

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps', optIns: [] });
        expect(readVideo()).toBe(edited);
        const { video } = getPerformanceConfigStatus(gameRoot);
        expect(video!.applied).toBe(video!.total - 1);

        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO.replace(/("setting\.cpu_level"\t\t)"2"/, '$1"3"'));
    });

    it('switching to another config writes all of its video values, over ones changed in game', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        writeFileSync(videoPath, readVideo().replace(/("setting\.cpu_level"\t\t)"1"/, '$1"3"'), 'utf-8');

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-max' });
        const { video } = getPerformanceConfigStatus(gameRoot);
        expect(video!.applied).toBe(video!.total);
        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO);
    });

    it('a number the game reformats does not survive a switch or Remove', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato', videoVariant: 'noShadows' });
        const gamma = () => /"setting\.r_fullscreen_gamma"\t\t"([^"]*)"/.exec(readVideo())?.[1];
        const shipped = gamma()!;
        writeFileSync(videoPath, readVideo().replace(`"${shipped}"`, `"${Number(shipped).toFixed(6)}"`), 'utf-8');

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-ultra-potato', videoVariant: 'shadows' });
        expect(gamma()).not.toBe(Number(shipped).toFixed(6));
        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO);
    });

    it('putting changed values back still lets Remove restore the originals', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const applied = readVideo();
        writeFileSync(videoPath, applied.replace(/("setting\.cpu_level"\t\t)"1"/, '$1"3"'), 'utf-8');

        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps', restoreVideo: true });
        expect(readVideo()).toBe(applied);
        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO);
    });

    it('an unreadable video.txt fails the apply without touching gameinfo.gi', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const gameinfo = read();
        rmSync(videoPath);
        mkdirSync(videoPath);

        expect(applyPerformanceConfig(gameRoot, { presetId: 'optilock-max' }).state).toBe('error');
        expect(read()).toBe(gameinfo);
        expect(getPerformanceConfigStatus(gameRoot).appliedPresetId).toBe('optilock-fps');
    });

    it('a failed video.txt revert keeps the record so Remove can try again', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const applied = readVideo();
        rmSync(videoPath);
        mkdirSync(videoPath);

        expect(removePerformanceConfig(gameRoot).state).toBe('error');
        rmSync(videoPath, { recursive: true });
        writeFileSync(videoPath, applied, 'utf-8');
        expect(removePerformanceConfig(gameRoot).state).toBe('not-applied');
        expect(readVideo()).toBe(VIDEO);
        expect(read()).toBe(STOCK);
    });

    it('reports the video settings of the release actually applied', () => {
        rmSync(videoPath);
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(getPerformanceConfigStatus(gameRoot).videoAvailable).toBeGreaterThan(0);
        applyPerformanceConfig(gameRoot, { presetId: WITHOUT_VIDEO.id });
        expect(getPerformanceConfigStatus(gameRoot).videoAvailable).toBe(0);
    });

    it('a game update that wipes gameinfo.gi does not strand the video settings', () => {
        applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        const applied = readVideo();
        write(STOCK);
        expect(reapplyWipedPerformanceConfig(gameRoot).state).toBe('applied');
        expect(readVideo()).toBe(applied);

        write(STOCK);
        removePerformanceConfig(gameRoot);
        expect(readVideo()).toBe(VIDEO);
    });

    it('applies gameinfo.gi even when video.txt does not exist yet', () => {
        rmSync(videoPath);
        const result = applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
        expect(result.state).toBe('applied');
        expect(result.message).toContain('Video settings skipped');
        const status = getPerformanceConfigStatus(gameRoot);
        expect(status.video).toBeUndefined();
        expect(status.videoFileMissing).toBe(true);
    });

    // OptiLock Ultra Potato ships its video.txt with and without shadows.
    describe('variants', () => {
        const ULTRA = 'optilock-ultra-potato';
        const ultra = PRESETS.find((p) => p.id === ULTRA)!;
        const shadowQuality = () =>
            /"setting\.r_citadel_shadow_quality"\t\t"([^"]*)"/.exec(readVideo())?.[1];

        it('are listed only for a release that ships more than one video.txt', () => {
            expect(ultra.versions[0].videoVariants).toEqual(['noShadows', 'shadows']);
            const single = PRESETS.flatMap((p) => p.versions).filter((v) => v !== ultra.versions[0]);
            expect(single.every((v) => v.videoVariants === undefined)).toBe(true);
        });

        it('writes the default variant unless another is picked', () => {
            applyPerformanceConfig(gameRoot, { presetId: ULTRA });
            expect(shadowQuality()).toBe('-1');
            expect(getPerformanceConfigStatus(gameRoot).appliedVideoVariant).toBe('noShadows');
        });

        it('switching variant rewrites only video.txt, and Remove restores both files', () => {
            applyPerformanceConfig(gameRoot, { presetId: ULTRA });
            const gameinfoText = read();
            applyPerformanceConfig(gameRoot, { presetId: ULTRA, videoVariant: 'shadows' });
            expect(shadowQuality()).toBe('0');
            expect(read()).toBe(gameinfoText);
            expect(getPerformanceConfigStatus(gameRoot).appliedVideoVariant).toBe('shadows');

            removePerformanceConfig(gameRoot);
            expect(readVideo()).toBe(VIDEO);
            expect(read()).toBe(STOCK);
        });

        it('falls back to the default for a variant the release does not ship', () => {
            applyPerformanceConfig(gameRoot, { presetId: ULTRA, videoVariant: 'nope' });
            expect(shadowQuality()).toBe('-1');

            applyPerformanceConfig(gameRoot, {
                presetId: ULTRA,
                version: ultra.versions[1].version,
                videoVariant: 'shadows',
            });
            expect(shadowQuality()).toBe('-1');
            expect(getPerformanceConfigStatus(gameRoot).appliedVideoVariant).toBeUndefined();
        });

        it('a game update that wipes gameinfo.gi brings back the variant that was applied', () => {
            applyPerformanceConfig(gameRoot, { presetId: ULTRA, videoVariant: 'shadows' });
            const applied = readVideo();
            write(STOCK);
            expect(reapplyWipedPerformanceConfig(gameRoot).state).toBe('applied');
            expect(readVideo()).toBe(applied);
        });

        it('writes the mip bias the No Shadows file ships, uncapped', () => {
            applyPerformanceConfig(gameRoot, { presetId: ULTRA });
            expect(readVideo()).toContain('"setting.r_texture_stream_mip_bias"\t\t"8"');
        });

        // The generator needs the network, so its variant handling is checked
        // here against what it emitted: the manifest's declarations and pins.
        describe('generated from the pin manifest', () => {
            type Variant = { id: string; file: string; fileByRef?: Record<string, string>; sha256: Record<string, string | null> };
            const manifest = JSON.parse(
                readFileSync(join(__dirname, '../../../scripts/performance-presets.json'), 'utf-8')
            ) as { presets: Array<{ id: string; videoVariants?: Variant[] }> };
            const declared = manifest.presets.filter((p) => p.videoVariants);

            it('declares each variant file, default first, with every name it has had', () => {
                expect(declared.map((p) => p.id)).toContain(ULTRA);
                for (const entry of declared) {
                    expect(getFamily(entry.id).upstream.videoFiles).toEqual(
                        entry.videoVariants!.map((v) => ({
                            variant: v.id,
                            files: [...new Set([v.file, ...Object.values(v.fileByRef ?? {})])],
                        }))
                    );
                }
            });

            it('pins every bundled release to the manifest hash of each variant it ships', () => {
                for (const entry of declared) {
                    const [first, ...rest] = entry.videoVariants!;
                    for (const release of getFamily(entry.id).releases) {
                        expect(release.videoSha256).toBe(first.sha256[release.ref]);
                        expect((release.videoVariants ?? []).map((v) => [v.id, v.sha256])).toEqual(
                            rest.filter((v) => v.sha256[release.ref]).map((v) => [v.id, v.sha256[release.ref]])
                        );
                    }
                }
            });
        });
    });

    describe('Steam userdata video.txt', () => {
        /** A Steam account's Deadlock cfg folder holding video.txt, as the
         *  game creates it; `launched` stamps its machine_convars.vcfg. */
        function userdataVideo(account: string, launched: number): string {
            const cfg = join(h.steamRoot, 'userdata', account, '1422450', 'local', 'cfg');
            mkdirSync(cfg, { recursive: true });
            const convars = join(cfg, 'machine_convars.vcfg');
            writeFileSync(convars, '"config" {}', 'utf-8');
            utimesSync(convars, launched, launched);
            const path = join(cfg, 'video.txt');
            writeFileSync(path, VIDEO, 'utf-8');
            return path;
        }

        it('writes the userdata copy the game reads and leaves the game folder one alone', () => {
            const userdata = userdataVideo('111', 1000);
            applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
            expect(readFileSync(userdata, 'utf-8')).not.toBe(VIDEO);
            expect(readVideo()).toBe(VIDEO);
            const { video } = getPerformanceConfigStatus(gameRoot);
            expect(video!.applied).toBe(video!.total);

            removePerformanceConfig(gameRoot);
            expect(readFileSync(userdata, 'utf-8')).toBe(VIDEO);
        });

        it('picks the account that launched Deadlock last', () => {
            const older = userdataVideo('111', 1000);
            const newer = userdataVideo('222', 2000);
            applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
            expect(readFileSync(older, 'utf-8')).toBe(VIDEO);
            expect(readFileSync(newer, 'utf-8')).not.toBe(VIDEO);
        });

        it('writes the game folder copy while the account that launched last has none', () => {
            const other = userdataVideo('111', 1000);
            const cfg = join(h.steamRoot, 'userdata', '222', '1422450', 'local', 'cfg');
            mkdirSync(cfg, { recursive: true });
            const convars = join(cfg, 'machine_convars.vcfg');
            writeFileSync(convars, '"config" {}', 'utf-8');
            utimesSync(convars, 2000, 2000);

            applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
            expect(readVideo()).not.toBe(VIDEO);
            expect(readFileSync(other, 'utf-8')).toBe(VIDEO);
            expect(existsSync(join(cfg, 'video.txt'))).toBe(false);
        });

        it('moves the settings when the game starts reading the userdata copy', () => {
            applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
            const applied = readVideo();
            const userdata = userdataVideo('111', 1000);
            expect(getPerformanceConfigStatus(gameRoot).video!.applied).toBe(0);

            applyPerformanceConfig(gameRoot, { presetId: 'optilock-fps' });
            expect(readVideo()).toBe(VIDEO);
            expect(readFileSync(userdata, 'utf-8')).toBe(applied);
        });
    });
});
