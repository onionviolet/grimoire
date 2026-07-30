// autoexec.cfg runs after gameinfo.gi, so a ConVar set in both is decided by
// the cfg. The HUD controls in Settings write gameinfo.gi, which means two
// Grimoire surfaces can write the same ConVar with the loser saying nothing.
// findAutoexecConvars is what lets the losing surface say so. Issue #18.
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { COMMANDS_END, COMMANDS_START, findAutoexecConvars } from './autoexec';

let gameRoot: string;
let cfgPath: string;

beforeEach(() => {
    gameRoot = mkdtempSync(join(tmpdir(), 'grimoire-autoexec-'));
    const dir = join(gameRoot, 'game', 'citadel', 'cfg');
    mkdirSync(dir, { recursive: true });
    cfgPath = join(dir, 'autoexec.cfg');
});

afterEach(() => rmSync(gameRoot, { recursive: true, force: true }));

const write = (lines: string[]) => writeFileSync(cfgPath, lines.join('\n'), 'utf-8');
const KEYS = ['citadel_unit_status_use_new', 'citadel_minimap_player_width'];

describe('findAutoexecConvars', () => {
    it('reports nothing when there is no autoexec.cfg', () => {
        expect(findAutoexecConvars(gameRoot, KEYS)).toEqual({});
    });

    it('finds a manual line, with its line number', () => {
        write(['// my config', 'citadel_unit_status_use_new 1', 'fps_max 240']);
        expect(findAutoexecConvars(gameRoot, KEYS)).toEqual({
            citadel_unit_status_use_new: { value: '1', line: 2, managed: false },
        });
    });

    it('marks a line inside a Grimoire-managed section', () => {
        write(['// my config', COMMANDS_START, 'citadel_unit_status_use_new "0"', COMMANDS_END]);
        expect(findAutoexecConvars(gameRoot, KEYS).citadel_unit_status_use_new).toEqual({
            value: '0',
            line: 3,
            managed: true,
        });
    });

    it('ignores commented-out lines and bare queries', () => {
        write([
            '// citadel_unit_status_use_new 1',
            'citadel_unit_status_use_new   // was set here once',
            'citadel_minimap_player_width 9',
        ]);
        const found = findAutoexecConvars(gameRoot, KEYS);
        expect(found.citadel_unit_status_use_new).toBeUndefined();
        expect(found.citadel_minimap_player_width).toEqual({ value: '9', line: 3, managed: false });
    });

    it('reports the last assignment, since that is the one the game keeps', () => {
        write(['citadel_minimap_player_width 6', 'citadel_minimap_player_width 11']);
        expect(findAutoexecConvars(gameRoot, KEYS).citadel_minimap_player_width).toEqual({
            value: '11',
            line: 2,
            managed: false,
        });
    });

    it('ignores keys it was not asked about', () => {
        write(['fps_max 240', 'citadel_crosshair_dot 1']);
        expect(findAutoexecConvars(gameRoot, KEYS)).toEqual({});
    });
});
