import { describe, expect, it } from 'vitest';
import { inspectFoundrySoundWriteSet } from './foundrySoundConflicts';

const mod = (id: string, enabled = true) => ({ id, name: id, metaKey: id, enabled, priority: 12 });

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
        expect(result.conflicts.map((conflict) => [conflict.modId, conflict.enabled, conflict.managed, conflict.entries]))
            .toEqual([['managed', true, true, ['SOUNDS/FOO.VSND_C']], ['third-party', false, false, ['soundevents/hero/foo.vsndevts_c']]]);
    });

    it('reports unreadable VPKs instead of assuming they cannot conflict', () => {
        const result = inspectFoundrySoundWriteSet(['sounds/foo.vsnd_c'], [{ mod: mod('opaque'), entries: null }]);
        expect(result.conflicts).toEqual([]);
        expect(result.unreadableMods).toEqual([{ modId: 'opaque', modName: 'opaque', enabled: true }]);
    });
});
