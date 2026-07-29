import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    clearPerformanceConvars,
    getPerformanceConfigStatus,
    removePerformanceConfig,
} from './performanceConfig';

// These tests drive the real file-patching code against throwaway gameinfo.gi
// fixtures: the value of this module is entirely in what it does to bytes on
// disk, so mocking fs would test nothing worth testing.

const PRESET_BEGIN =
    '\t\t// ==== Grimoire Performance Config BEGIN (preset=sqooky-default v2.4.6) ====';
const PRESET_END = '\t\t// ==== Grimoire Performance Config END ====';

/** A managed (preset applied) gameinfo.gi covering every origin at once:
 *  - citadel_unit_status_use_new: injected at the preset's own value
 *  - citadel_unit_status_allies_see_thru_walls: preset line edited away from
 *    the preset value, with the stock value recorded in the marker
 *  - citadel_minimap_unit_click_radius: untouched line still on the engine's
 *    stock value
 *  - minimap_update_rate_hz: a value no slider can represent
 *  - citadel_minimap_zip_line_thickness: numeric but far outside the range
 *  - citadel_minimap_max_icon_shrink: absent entirely */
const MANAGED_LINES = [
    '"GameInfo"',
    '{',
    '\tgame\t"Deadlock"',
    '\tConVars',
    '\t{',
    PRESET_BEGIN,
    '\t\t// Values from OptimizationLock by Sqooky and contributors (GPL-3.0) [grimoire-perf]',
    '\t\tcitadel_unit_status_use_new "true" // grimoire-perf added',
    '\t\tcitadel_minimap_player_width "10" // grimoire-perf added',
    PRESET_END,
    '\t\tcitadel_unit_status_allies_see_thru_walls "false" // grimoire-perf was "true"',
    '\t\tcitadel_minimap_unit_click_radius "800"',
    '\t\tminimap_update_rate_hz "sometimes"',
    '\t\tcitadel_minimap_zip_line_thickness "99"',
    '\t}',
    '}',
    '',
];

/** A hand-managed file: no preset block, only the single-ConVar markers the
 *  unmanaged write path leaves behind. */
const UNMANAGED_LINES = [
    '"GameInfo"',
    '{',
    '\tConVars',
    '\t{',
    '\t\tcitadel_minimap_player_width "9" // grimoire-perf hud-added',
    '\t\tcitadel_unit_status_use_v2 "true" // grimoire-perf hud-was "false"',
    '\t\tcitadel_minimap_local_player_width "12"',
    '\t}',
    '}',
    '',
];

let root: string;

function writeGameinfo(lines: string[], eol: '\n' | '\r\n'): string {
    const gameinfoPath = join(root, 'game', 'citadel', 'gameinfo.gi');
    mkdirSync(join(root, 'game', 'citadel'), { recursive: true });
    writeFileSync(gameinfoPath, lines.join(eol), 'utf-8');
    return gameinfoPath;
}

function read(gameinfoPath: string): string {
    return readFileSync(gameinfoPath, 'utf-8');
}

function braceCount(text: string): number {
    return (text.match(/[{}]/g) ?? []).length;
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'grimoire-perf-'));
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe('convar provenance', () => {
    it('classifies every origin from one managed file', () => {
        writeGameinfo(MANAGED_LINES, '\n');
        const states = getPerformanceConfigStatus(root).convarStates;
        expect(states).toBeDefined();

        // Injected at exactly the preset's value: the preset owns it.
        expect(states!['citadel_unit_status_use_new']).toMatchObject({
            origin: 'managed-preset',
            value: 'true',
            presetValue: 'true',
        });

        // Preset line moved off the preset value, stock value recorded inline.
        expect(states!['citadel_unit_status_allies_see_thru_walls']).toMatchObject({
            origin: 'user-override',
            value: 'false',
            presetValue: 'true',
            gameDefault: 'true',
        });

        // Untouched line still sitting on the engine's stock value.
        expect(states!['citadel_minimap_unit_click_radius']).toMatchObject({
            origin: 'game-default',
            value: '800',
        });

        // No line at all: the engine's own value is what runs.
        expect(states!['citadel_minimap_max_icon_shrink']).toMatchObject({
            origin: 'game-default',
            value: null,
        });

        // A slider cannot represent this, so we refuse to guess.
        expect(states!['minimap_update_rate_hz']).toMatchObject({
            origin: 'unsupported',
            value: 'sometimes',
        });
    });

    it('flags an out-of-range value without clamping it away', () => {
        writeGameinfo(MANAGED_LINES, '\n');
        const state = getPerformanceConfigStatus(root).convarStates!['citadel_minimap_zip_line_thickness'];
        expect(state.outOfRange).toBe(true);
        // The real file value survives intact: the UI needs it to say what it
        // is about to replace.
        expect(state.value).toBe('99');
        expect(state.origin).toBe('user-override');
    });

    it('reports advanced values, not just HUD ones', () => {
        writeGameinfo(MANAGED_LINES, '\n');
        const values = getPerformanceConfigStatus(root).convarValues;
        expect(values?.['citadel_minimap_player_width']).toBe('10');
        expect(values?.['citadel_minimap_unit_click_radius']).toBe('800');
    });

    it('omits provenance when there is no ConVars section to read', () => {
        writeGameinfo(['"GameInfo"', '{', '}', ''], '\n');
        const status = getPerformanceConfigStatus(root);
        expect(status.convarStates).toEqual({});
    });
});

describe('clearPerformanceConvars', () => {
    it('deletes an injected preset line and records the omit override', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\n');
        const result = clearPerformanceConvars(root, ['citadel_unit_status_use_new']);
        expect(result.state).not.toBe('error');

        const text = read(gameinfoPath);
        expect(text).not.toContain('citadel_unit_status_use_new');
        expect(getPerformanceConfigStatus(root).convarStates!['citadel_unit_status_use_new']).toMatchObject({
            origin: 'game-default',
            value: null,
        });

        // The next apply must not quietly put the preset value back.
        const sidecar = JSON.parse(
            readFileSync(join(root, 'game', 'citadel', 'grimoire-performance.json'), 'utf-8')
        );
        expect(sidecar.overrides['ConVars/citadel_unit_status_use_new']).toEqual({ omit: true });
    });

    it('parks an edited stock line as a removed marker so Remove can restore it', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\n');
        clearPerformanceConvars(root, ['citadel_unit_status_allies_see_thru_walls']);

        const text = read(gameinfoPath);
        expect(text).toContain(
            '// grimoire-perf removed: citadel_unit_status_allies_see_thru_walls "true"'
        );
        // No active line left, so the engine falls back to its own value.
        expect(
            getPerformanceConfigStatus(root).convarStates!['citadel_unit_status_allies_see_thru_walls']
        ).toMatchObject({ origin: 'game-default', value: null, gameDefault: 'true' });

        // And the user's original line comes back on a full removal.
        removePerformanceConfig(root);
        expect(read(gameinfoPath)).toContain(
            '\t\tcitadel_unit_status_allies_see_thru_walls "true"'
        );
    });

    it('deletes a hand-managed hud-added line', () => {
        const gameinfoPath = writeGameinfo(UNMANAGED_LINES, '\n');
        const result = clearPerformanceConvars(root, ['citadel_minimap_player_width']);
        expect(result.state).not.toBe('error');
        expect(read(gameinfoPath)).not.toContain('citadel_minimap_player_width');
        // A hand-managed file has no sidecar and must not grow one.
        expect(existsSync(join(root, 'game', 'citadel', 'grimoire-performance.json'))).toBe(false);
    });

    it('restores the recorded original on a hand-managed hud-was line', () => {
        const gameinfoPath = writeGameinfo(UNMANAGED_LINES, '\n');
        clearPerformanceConvars(root, ['citadel_unit_status_use_v2']);
        const text = read(gameinfoPath);
        expect(text).toContain('citadel_unit_status_use_v2 "false"');
        expect(text).not.toContain('hud-was');
    });

    it('is a reported no-op when Grimoire wrote no line for the key', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\n');
        const before = read(gameinfoPath);
        const result = clearPerformanceConvars(root, ['citadel_minimap_unit_click_radius']);
        expect(result.state).not.toBe('error');
        expect(result.message).toContain('Nothing to reset');
        // Untagged lines are never touched, so the file is byte-identical.
        expect(read(gameinfoPath)).toBe(before);
    });

    it('refuses keys it does not manage', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\n');
        const before = read(gameinfoPath);
        const result = clearPerformanceConvars(root, ['r_shadows']);
        expect(result.state).toBe('error');
        expect(read(gameinfoPath)).toBe(before);
    });

    it('preserves brace balance and LF line endings', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\n');
        const before = read(gameinfoPath);
        clearPerformanceConvars(root, [
            'citadel_unit_status_use_new',
            'citadel_unit_status_allies_see_thru_walls',
        ]);
        const after = read(gameinfoPath);
        expect(braceCount(after)).toBe(braceCount(before));
        expect(after).not.toContain('\r');
    });

    it('preserves brace balance and CRLF line endings', () => {
        const gameinfoPath = writeGameinfo(MANAGED_LINES, '\r\n');
        const before = read(gameinfoPath);
        clearPerformanceConvars(root, [
            'citadel_unit_status_use_new',
            'citadel_unit_status_allies_see_thru_walls',
        ]);
        const after = read(gameinfoPath);
        expect(braceCount(after)).toBe(braceCount(before));
        // Every newline is still part of a CRLF pair.
        expect(after.split('\n').length).toBe(after.split('\r\n').length);
        expect(after).toContain('\r\n');
    });

    it('errors instead of guessing when gameinfo.gi is missing', () => {
        const result = clearPerformanceConvars(root, ['citadel_unit_status_use_new']);
        expect(result.state).toBe('error');
        expect(result.message).toContain('gameinfo.gi not found');
    });
});
