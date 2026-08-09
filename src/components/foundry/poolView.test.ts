import { describe, expect, it } from 'vitest';
import { buildFoundryPoolView, poolShuffleToggle, resolvePoolWinners } from './poolView';
import { collectFoundryChanges } from './changeList';
import { foundryShuffleKey, groupFoundryShufflePools } from '../../lib/foundryChanges';
import type { Mod } from '../../types/mod';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A change',
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Mod;
}

/** Two builds writing the same portrait, plus one writing something else. */
const portraitA = mod({
  id: 'portrait-a',
  name: 'Neon Abrams',
  sha256: 'aaa',
  foundryBuild: {
    writeSet: ['panorama/images/heroes/bull.png'],
    parts: [{ kind: 'texture', title: 'Neon portrait', entries: ['panorama/images/heroes/bull.png'], category: 'hero-image', heroName: 'Abrams', sourceFileName: 'neon.png' }],
  },
});
const portraitB = mod({
  id: 'portrait-b',
  name: 'Chrome Abrams',
  enabled: false,
  sha256: 'bbb',
  foundryBuild: {
    writeSet: ['panorama/images/heroes/bull.png', 'panorama/images/heroes/bull_minimap.png'],
    parts: [{ kind: 'texture', title: 'Chrome portrait', entries: ['panorama/images/heroes/bull.png', 'panorama/images/heroes/bull_minimap.png'], category: 'hero-image', heroName: 'Abrams', sourceFileName: 'chrome.png' }],
  },
});
const lonely = mod({
  id: 'lonely',
  name: 'Dash icon',
  sha256: 'ccc',
  textureReplacement: { entryPath: 'materials/icons/dash.vtex_c', imageFileName: 'dash.png', category: 'ability-icon' },
});
/** A change that predates recorded write sets: it cannot be pooled at all. */
const unrecorded = mod({
  id: 'unrecorded',
  name: 'Old swap',
  sha256: 'ddd',
  soundSwap: { heroCodename: 'bull', event: 'Abrams.Charge', audioFileName: 'horn.mp3', loop: 'auto', pool: 'all' },
} as Partial<Mod>);

function view(mods: Mod[], included: Iterable<string> = []) {
  return buildFoundryPoolView({
    mods,
    changes: collectFoundryChanges(mods),
    included: new Set(included),
  });
}

describe('buildFoundryPoolView', () => {
  it('produces exactly the pools groupFoundryShufflePools produces', () => {
    const mods = [portraitA, portraitB, lonely];
    const planner = groupFoundryShufflePools(mods);
    const { pools } = view(mods);

    expect(pools).toHaveLength(planner.length);
    // Same membership, same order, same paths: the card and the launch planner
    // must not be able to disagree about what a pool is.
    expect(pools.map((pool) => pool.members.map((member) => member.mod.id)))
      .toEqual(planner.map((pool) => pool.mods.map((entry) => entry.id)));
    expect(pools.map((pool) => pool.entries)).toEqual(planner.map((pool) => pool.entries));
  });

  it('groups transitively contending changes into one card and names the shared path', () => {
    const { pools } = view([portraitA, portraitB, lonely]);
    const contended = pools.find((pool) => !pool.single)!;
    expect(contended.members.map((member) => member.mod.id)).toEqual(['portrait-a', 'portrait-b']);
    // Only the path both write is contended. The minimap belongs to one member.
    expect(contended.contendedEntries).toEqual(['panorama/images/heroes/bull.png']);
    expect(contended.entries).toContain('panorama/images/heroes/bull_minimap.png');
  });

  it('marks a pool of one as reduced, with nothing to decide between', () => {
    const { pools } = view([lonely]);
    expect(pools).toHaveLength(1);
    expect(pools[0].single).toBe(true);
    expect(pools[0].members).toHaveLength(1);
    // Nothing is contended, so there is no alternatives decision to render.
    expect(pools[0].contendedEntries).toEqual([]);
  });

  it('reports a change with no recorded paths as unpooled rather than as a pool of one', () => {
    const { pools, unpooled } = view([unrecorded]);
    expect(pools).toEqual([]);
    expect(unpooled).toHaveLength(1);
    expect(unpooled[0].reason).toBe('no-recorded-paths');
    expect(unpooled[0].entry.mod.id).toBe('unrecorded');
  });

  it('keeps every member visible when only one of them matches the filter', () => {
    const mods = [portraitA, portraitB];
    const all = collectFoundryChanges(mods);
    const { pools } = buildFoundryPoolView({
      mods,
      changes: all.filter((entry) => entry.mod.id === 'portrait-a'),
      included: new Set(),
    });
    expect(pools).toHaveLength(1);
    expect(pools[0].members.map((member) => member.matched)).toEqual([true, false]);
  });

  it('drops a pool with no visible member instead of showing an orphan card', () => {
    const mods = [portraitA, portraitB, lonely];
    const all = collectFoundryChanges(mods);
    const { pools } = buildFoundryPoolView({
      mods,
      changes: all.filter((entry) => entry.mod.id === 'lonely'),
      included: new Set(),
    });
    expect(pools.map((pool) => pool.members.map((member) => member.mod.id))).toEqual([['lonely']]);
  });

  it('reads opt-in state off the same key the launch shuffle persists', () => {
    const { pools } = view([portraitA, portraitB], [foundryShuffleKey(portraitA)]);
    const pool = pools[0];
    expect(pool.members.map((member) => member.inShuffle)).toEqual([true, false]);
    expect(pool.anyIncluded).toBe(true);
    expect(pool.allIncluded).toBe(false);
  });

  it('carries the recorded source file so a preview can be derived from it', () => {
    const { pools } = view([portraitA, portraitB]);
    expect(pools[0].members.map((member) => member.sourceFileName)).toEqual(['neon.png', 'chrome.png']);
  });
});

describe('poolShuffleToggle', () => {
  it('adds every member that is not yet in the pool', () => {
    const { pools } = view([portraitA, portraitB], [foundryShuffleKey(portraitA)]);
    const toggle = poolShuffleToggle(pools[0]);
    expect(toggle.include).toBe(true);
    // Only the missing member is toggled: toggling the included one would
    // remove it, which is the opposite of the requested action.
    expect(toggle.keys).toEqual([foundryShuffleKey(portraitB)]);
  });

  it('adds all members when none are in the pool', () => {
    const { pools } = view([portraitA, portraitB]);
    const toggle = poolShuffleToggle(pools[0]);
    expect(toggle.include).toBe(true);
    expect(toggle.keys).toEqual([foundryShuffleKey(portraitA), foundryShuffleKey(portraitB)]);
  });

  it('removes every member once the whole pool is in', () => {
    const { pools } = view([portraitA, portraitB], [foundryShuffleKey(portraitA), foundryShuffleKey(portraitB)]);
    const toggle = poolShuffleToggle(pools[0]);
    expect(toggle.include).toBe(false);
    expect(toggle.keys).toEqual([foundryShuffleKey(portraitA), foundryShuffleKey(portraitB)]);
  });
});

describe('resolvePoolWinners', () => {
  const inspection: FoundryAssetSourcesInspection = {
    paths: ['panorama/images/heroes/bull.png', 'panorama/images/heroes/bull_minimap.png'],
    sources: [
      { modId: 'portrait-a', modName: 'Neon Abrams', enabled: true, priority: 1, provenance: 'Forged', entries: ['panorama/images/heroes/bull.png'], wins: ['panorama/images/heroes/bull.png'], managed: true, lockerManaged: false, auditionable: [] },
      { modId: 'stranger', modName: 'Some downloaded pack', enabled: true, priority: 0, provenance: 'Downloaded', entries: ['panorama/images/heroes/bull_minimap.png'], wins: ['panorama/images/heroes/bull_minimap.png'], managed: false, lockerManaged: false, auditionable: [] },
    ],
    winners: {
      'panorama/images/heroes/bull.png': 'portrait-a',
      'panorama/images/heroes/bull_minimap.png': 'stranger',
    },
    unreadableMods: [],
  };

  it('marks the member that wins each exact path, using the supplied inspection', () => {
    const { pools } = view([portraitA, portraitB]);
    const winners = resolvePoolWinners(pools[0], inspection);
    expect(winners.winsByMemberKey.get(foundryShuffleKey(portraitA))).toEqual(['panorama/images/heroes/bull.png']);
    expect(winners.winsByMemberKey.has(foundryShuffleKey(portraitB))).toBe(false);
  });

  it('names a winner from outside the pool rather than pretending a member won', () => {
    const { pools } = view([portraitA, portraitB]);
    const winners = resolvePoolWinners(pools[0], inspection);
    expect(winners.foreign.map((entry) => entry.ownerName)).toEqual(['Some downloaded pack']);
    expect(winners.foreign[0].memberKey).toBeNull();
  });

  it('reports the base game as the winner when no installed VPK owns a path', () => {
    const { pools } = view([portraitA, portraitB]);
    const winners = resolvePoolWinners(pools[0], {
      ...inspection,
      winners: { 'panorama/images/heroes/bull.png': null, 'panorama/images/heroes/bull_minimap.png': null },
    });
    expect(winners.winsByMemberKey.size).toBe(0);
    expect(winners.foreign).toEqual([]);
    expect(winners.byPath.every((entry) => entry.modId === null)).toBe(true);
  });

  it('resolves nothing rather than guessing when the inspection has not arrived', () => {
    const { pools } = view([portraitA, portraitB]);
    expect(resolvePoolWinners(pools[0], null).byPath).toEqual([]);
  });
});
