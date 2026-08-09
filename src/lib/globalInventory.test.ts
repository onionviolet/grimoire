import { describe, expect, it } from 'vitest';
import {
  countGlobalInventoryCategories,
  countGlobalInventoryMods,
  firstGlobalRailRowKey,
  globalInventoryRailRows,
  type GlobalRailRowInput,
} from './globalInventory';
import type { GlobalModGroups } from './lockerUtils';
import type { SoundInventoryEntry } from './soundInventory';

const groups = (): GlobalModGroups => ({
  'soul-container': [],
  'spirit-urn': [],
  hideout: [],
  icons: [],
  hud: [],
  announcer: [],
  'killstreak-music': [],
});

const sound = (
  modId: string,
  categories: SoundInventoryEntry['categories'] = ['music']
): SoundInventoryEntry => ({
  key: `${modId}:global`,
  modId,
  metaKey: modId,
  name: modId,
  enabled: true,
  priority: 0,
  hero: null,
  scope: 'global',
  categories,
  slots: [],
  events: [],
  paths: [],
  fileCount: 0,
  provenance: 'third-party',
  managed: false,
  basis: 'vpk',
});

describe('countGlobalInventoryMods', () => {
  it('uses one denominator when a legacy global sound bucket and the taxonomy name the same mod', () => {
    const inventory = groups();
    inventory.hideout.push({ id: 'hideout' } as GlobalModGroups['hideout'][number]);
    inventory.announcer.push({ id: 'music-pack' } as GlobalModGroups['announcer'][number]);

    expect(countGlobalInventoryMods(inventory, [sound('music-pack')])).toBe(2);
  });
});

describe('countGlobalInventoryCategories', () => {
  it('counts populated visual types plus populated sound categories', () => {
    const inventory = groups();
    inventory.hideout.push({ id: 'hideout' } as GlobalModGroups['hideout'][number]);
    inventory.icons.push({ id: 'icons' } as GlobalModGroups['icons'][number]);

    expect(
      countGlobalInventoryCategories(inventory, [sound('a', ['music']), sound('b', ['melee'])])
    ).toBe(4);
  });

  it('ignores a sound-shaped legacy bucket, which the visual rail no longer renders', () => {
    const inventory = groups();
    inventory.announcer.push({ id: 'announcer' } as GlobalModGroups['announcer'][number]);
    inventory['killstreak-music'].push({
      id: 'killstreak',
    } as GlobalModGroups['killstreak-music'][number]);

    expect(countGlobalInventoryCategories(inventory, [])).toBe(0);
  });

  it('counts a mod in two sound categories once per category, not once per mod', () => {
    // A pack that writes both music and melee paths populates two rail rows, so
    // both rows are real destinations even though there is one mod behind them.
    expect(countGlobalInventoryCategories(groups(), [sound('both', ['music', 'melee'])])).toBe(2);
  });
});

describe('globalInventoryRailRows', () => {
  const visual = (key: string, count: number): GlobalRailRowInput => ({ key, label: key, count });
  const sound = (key: string, count: number): GlobalRailRowInput => ({ key, label: key, count });

  it('returns the visual vocabulary tagged visual for looks', () => {
    expect(
      globalInventoryRailRows(
        'looks',
        [visual('hideout', 2), visual('hud', 1)],
        [sound('sound:music', 3)]
      )
    ).toEqual([
      { key: 'hideout', label: 'hideout', count: 2, kind: 'visual' },
      { key: 'hud', label: 'hud', count: 1, kind: 'visual' },
    ]);
  });

  it('returns the sound vocabulary tagged sound for sounds', () => {
    expect(
      globalInventoryRailRows(
        'sounds',
        [visual('hideout', 2)],
        [sound('sound:music', 3), sound('sound:ui', 1)]
      )
    ).toEqual([
      { key: 'sound:music', label: 'sound:music', count: 3, kind: 'sound' },
      { key: 'sound:ui', label: 'sound:ui', count: 1, kind: 'sound' },
    ]);
  });

  it('merges visual rows first, then sound rows, for all', () => {
    expect(
      globalInventoryRailRows(
        'all',
        [visual('hideout', 2), visual('hud', 4)],
        [sound('sound:music', 3), sound('sound:ui', 1)]
      )
    ).toEqual([
      { key: 'hideout', label: 'hideout', count: 2, kind: 'visual' },
      { key: 'hud', label: 'hud', count: 4, kind: 'visual' },
      { key: 'sound:music', label: 'sound:music', count: 3, kind: 'sound' },
      { key: 'sound:ui', label: 'sound:ui', count: 1, kind: 'sound' },
    ]);
  });

  it('drops zero-count rows in every section', () => {
    expect(
      globalInventoryRailRows(
        'all',
        [visual('hideout', 2), visual('hud', 0)],
        [sound('sound:music', 0), sound('sound:ui', 1)]
      )
    ).toEqual([
      { key: 'hideout', label: 'hideout', count: 2, kind: 'visual' },
      { key: 'sound:ui', label: 'sound:ui', count: 1, kind: 'sound' },
    ]);
    expect(globalInventoryRailRows('looks', [visual('hud', 0)], [])).toEqual([]);
    expect(globalInventoryRailRows('sounds', [], [sound('sound:ui', 0)])).toEqual([]);
  });

  it('returns an empty array for a section whose rows are all zero', () => {
    expect(globalInventoryRailRows('looks', [visual('hud', 0)], [])).toEqual([]);
    expect(globalInventoryRailRows('sounds', [], [sound('sound:ui', 0)])).toEqual([]);
    expect(globalInventoryRailRows('all', [visual('hud', 0)], [sound('sound:ui', 0)])).toEqual([]);
  });
});

describe('firstGlobalRailRowKey', () => {
  it('returns the first row key', () => {
    expect(
      firstGlobalRailRowKey([
        { key: 'hideout', label: 'Hideout', count: 2, kind: 'visual' },
        { key: 'sound:music', label: 'Music', count: 3, kind: 'sound' },
      ])
    ).toBe('hideout');
  });

  it('returns null for an empty array', () => {
    expect(firstGlobalRailRowKey([])).toBeNull();
  });
});
