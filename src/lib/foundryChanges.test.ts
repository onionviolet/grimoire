import { describe, expect, it } from 'vitest';
import {
  foundryChangeEntries,
  foundryShuffleKey,
  groupFoundryShufflePools,
  planFoundryShuffle,
} from './foundryChanges';
import type { Mod } from '../types/mod';

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'Change',
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: false,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Mod;
}

/** A build change owning exactly the given entries. */
function build(id: string, entries: string[], extra: Partial<Mod> = {}): Mod {
  return mod({
    id,
    name: id,
    sha256: `hash-${id}`,
    foundryBuild: {
      writeSet: entries,
      parts: [{ kind: 'texture', title: id, entries }],
    },
    ...extra,
  });
}

/** An rng that walks a fixed sequence, so every pick below is deliberate. */
function seeded(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('foundryChangeEntries', () => {
    it('maps a sound swap to its compiled clip entries', () => {
        expect(foundryChangeEntries(mod({
            soundSwap: {
                heroCodename: 'bull', event: 'E', audioFileName: 'a.mp3', loop: 'auto', pool: 'all',
                reforge: { heroName: 'Abrams', audioPath: 'a.mp3', assignments: [{ clipPath: 'Sounds\\Charge_01.vsnd', audioPath: 'a.mp3' }] },
            },
        }))).toEqual(['sounds/charge_01.vsnd_c']);
    });

    it('unions a build write set with its parts', () => {
        expect(foundryChangeEntries(mod({
            foundryBuild: {
                writeSet: ['a/one.png'],
                parts: [{ kind: 'sound', title: 's', entries: ['b/two.vsnd_c'] }],
            },
        })).sort()).toEqual(['a/one.png', 'b/two.vsnd_c']);
    });
});

describe('foundryShuffleKey', () => {
    /**
     * mod.id and metaKey are derived from the pakNN filename and change every
     * time a mod is enabled or disabled. A pool membership keyed on either
     * would silently detach the first time the shuffle it belongs to ran.
     */
    it('survives the rename that enabling a mod causes', () => {
        const disabled = build('x', ['a/one.png'], { id: 'before', metaKey: 'before.vpk', enabled: false });
        const enabled = { ...disabled, id: 'after', metaKey: 'pak07_dir.vpk', enabled: true };
        expect(foundryShuffleKey(enabled)).toBe(foundryShuffleKey(disabled));
    });

    it('falls back to the write set when there is no content hash', () => {
        const noHash = mod({ id: 'a', sha256: undefined, foundryBuild: { writeSet: ['z/two.png', 'a/one.png'], parts: [] } });
        // Order-independent: the same change described in either order is one key.
        const reordered = mod({ id: 'b', sha256: undefined, foundryBuild: { writeSet: ['a/one.png', 'z/two.png'], parts: [] } });
        expect(foundryShuffleKey(noHash)).toBe(foundryShuffleKey(reordered));
    });
});

describe('groupFoundryShufflePools', () => {
    it('groups changes that contend for the same path', () => {
        const pools = groupFoundryShufflePools([
            build('a', ['panorama/portrait.png']),
            build('b', ['panorama/portrait.png']),
            build('c', ['sounds/unrelated.vsnd_c']),
        ]);
        expect(pools).toHaveLength(2);
        expect(pools.find((p) => p.mods.length === 2)!.mods.map((m) => m.id).sort()).toEqual(['a', 'b']);
    });

    /**
     * Overlap, not exact-set equality. {portrait} and {portrait, minimap}
     * genuinely contend; grouping only on equality would leave both enabled and
     * let load order decide, which is the invisible-shuffle bug.
     */
    it('groups transitively through a shared path', () => {
        const pools = groupFoundryShufflePools([
            build('a', ['p/one.png']),
            build('b', ['p/one.png', 'p/two.png']),
            build('c', ['p/two.png']),
        ]);
        expect(pools).toHaveLength(1);
        expect(pools[0].mods.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('omits a change with no recorded paths rather than guessing its pool', () => {
        const legacy = mod({ id: 'legacy', soundSwap: { heroCodename: 'h', event: 'E', audioFileName: 'a.mp3', loop: 'auto', pool: 'all' } });
        expect(groupFoundryShufflePools([legacy, build('a', ['p/one.png'])])).toHaveLength(1);
    });

    it('ignores mods that are not Foundry changes', () => {
        expect(groupFoundryShufflePools([mod({ id: 'downloaded', gameBananaId: 7 })])).toEqual([]);
    });
});

describe('planFoundryShuffle', () => {
    const a = build('a', ['p/one.png'], { enabled: true });
    const b = build('b', ['p/one.png']);
    const c = build('c', ['p/one.png']);

    it('does nothing when the pool is empty', () => {
        expect(planFoundryShuffle({ mods: [a, b], included: new Set() }))
            .toEqual({ enableIds: [], disableIds: [], changedPools: 0 });
    });

    it('leaves a pool with no opted-in member completely untouched', () => {
        const other = build('other', ['q/two.png'], { enabled: true });
        const plan = planFoundryShuffle({ mods: [a, b, other], included: new Set([foundryShuffleKey(a), foundryShuffleKey(b)]), rng: seeded([0]) });
        expect(plan.enableIds).not.toContain('other');
        expect(plan.disableIds).not.toContain('other');
    });

    it('picks one member and disables the rest of its pool', () => {
        // avoidCurrent drops the enabled `a`, leaving [b, c]; rng 0 picks b.
        const plan = planFoundryShuffle({
            mods: [a, b, c],
            included: new Set([a, b, c].map(foundryShuffleKey)),
            rng: seeded([0]),
        });
        expect(plan.enableIds).toEqual(['b']);
        expect(plan.disableIds).toEqual(['a']);
        expect(plan.changedPools).toBe(1);
    });

    /**
     * Opting one change in makes the whole pool exclusive, matching the
     * Locker's per-hero behaviour. A non-member left enabled would win the same
     * path by load order and the shuffle would appear to do nothing.
     */
    it('disables a non-member of the pool that is still enabled', () => {
        const enabledOutsider = build('outsider', ['p/one.png'], { enabled: true });
        const plan = planFoundryShuffle({
            mods: [enabledOutsider, b, c],
            included: new Set([foundryShuffleKey(b), foundryShuffleKey(c)]),
            rng: seeded([0]),
        });
        expect(plan.disableIds).toContain('outsider');
    });

    it('avoids re-picking the currently enabled change so a re-roll is visible', () => {
        // Every rng draw is 0: without avoidCurrent this would keep choosing `a`.
        const plan = planFoundryShuffle({ mods: [a, b], included: new Set([a, b].map(foundryShuffleKey)), rng: seeded([0]) });
        expect(plan.enableIds).toEqual(['b']);
    });

    it('keeps the only candidate when there is nothing else to switch to', () => {
        const solo = build('solo', ['p/solo.png'], { enabled: true });
        const plan = planFoundryShuffle({ mods: [solo], included: new Set([foundryShuffleKey(solo)]), rng: seeded([0]) });
        expect(plan).toEqual({ enableIds: [], disableIds: [], changedPools: 0 });
    });

    it('can roll "none of them" when vanilla is included', () => {
        // candidates [b, c] plus null; rng 0.99 lands on the vanilla slot.
        const plan = planFoundryShuffle({
            mods: [a, b, c],
            included: new Set([a, b, c].map(foundryShuffleKey)),
            includeVanilla: true,
            rng: seeded([0.99]),
        });
        expect(plan.enableIds).toEqual([]);
        expect(plan.disableIds).toEqual(['a']);
    });

    it('shuffles each contended group independently', () => {
        const x = build('x', ['q/two.png'], { enabled: true });
        const y = build('y', ['q/two.png']);
        const plan = planFoundryShuffle({
            mods: [a, b, x, y],
            included: new Set([a, b, x, y].map(foundryShuffleKey)),
            rng: seeded([0]),
        });
        expect(plan.enableIds.sort()).toEqual(['b', 'y']);
        expect(plan.disableIds.sort()).toEqual(['a', 'x']);
        expect(plan.changedPools).toBe(2);
    });
});
