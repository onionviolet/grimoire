import { describe, expect, it } from 'vitest';
import { inspectFoundrySoundWriteSet } from './foundrySoundConflicts';

const mod = (id: string, enabled = true, priority = 12) => ({ id, name: id, metaKey: id, enabled, priority, isUnknown: true });

describe('inspectFoundrySoundWriteSet', () => {
    it('compares exact VPK entry paths for managed and untracked mods in both states', () => {
        const result = inspectFoundrySoundWriteSet(
            ['sounds/foo.vsnd_c', 'soundevents/hero/foo.vsndevts_c'],
            [
                { mod: mod('managed'), entries: ['SOUNDS/FOO.VSND_C'], soundSwap: { heroCodename: 'foo', event: 'Foo.Bar', audioFileName: 'x.mp3', loop: 'auto', pool: 'all' } },
                { mod: mod('third-party', false), entries: ['soundevents/hero/foo.vsndevts_c'] },
                { mod: mod('same-event-name'), entries: ['sounds/not-foo.vsnd_c'] },
            ]
        );
        expect(result.conflicts.map((conflict) => [conflict.modId, conflict.enabled, conflict.managed, conflict.provenance, conflict.entries]))
            .toEqual([['managed', true, true, 'Forged', ['SOUNDS/FOO.VSND_C']], ['third-party', false, false, 'Third-party', ['soundevents/hero/foo.vsndevts_c']]]);
        expect(result.expectedWinners).toEqual([
            { entry: 'soundevents/hero/foo.vsndevts_c' },
            { entry: 'sounds/foo.vsnd_c', modId: 'managed', modName: 'managed', priority: 12 },
        ]);
    });

    it('reports unreadable VPKs instead of assuming they cannot conflict', () => {
        const result = inspectFoundrySoundWriteSet(['sounds/foo.vsnd_c'], [{ mod: mod('opaque'), entries: null }]);
        expect(result.conflicts).toEqual([]);
        expect(result.unreadableMods).toEqual([{ modId: 'opaque', modName: 'opaque', enabled: true }]);
    });

    it('calculates winners per path from enabled VPKs, never from disabled contenders', () => {
        const result = inspectFoundrySoundWriteSet(['sounds/a.vsnd_c'], [
            { mod: mod('low', true, 3), entries: ['sounds/a.vsnd_c'] },
            { mod: mod('high-disabled', false, 99), entries: ['sounds/a.vsnd_c'] },
            { mod: mod('high', true, 10), entries: ['sounds/a.vsnd_c'], soundSwap: { heroCodename: 'x', event: 'event', audioFileName: 'a.mp3', loop: 'auto', pool: 'all' } },
        ]);
        expect(result.expectedWinners).toEqual([
            { entry: 'sounds/a.vsnd_c', modId: 'low', modName: 'low', priority: 3 },
        ]);
    });
});
