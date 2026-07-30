import { describe, expect, it } from 'vitest';
import { countGlobalInventoryCategories, countGlobalInventoryMods } from './globalInventory';
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
