import { describe, expect, it } from 'vitest';
import { countGlobalInventoryMods } from './globalInventory';
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

const sound = (modId: string): SoundInventoryEntry => ({
  key: `${modId}:global`,
  modId,
  metaKey: modId,
  name: modId,
  enabled: true,
  priority: 0,
  hero: null,
  scope: 'global',
  categories: ['music'],
  slots: [],
  events: [],
  paths: [],
  fileCount: 0,
  provenance: 'third-party',
  managed: false,
});

describe('countGlobalInventoryMods', () => {
  it('uses one denominator when a legacy global sound bucket and the taxonomy name the same mod', () => {
    const inventory = groups();
    inventory.hideout.push({ id: 'hideout' } as GlobalModGroups['hideout'][number]);
    inventory.announcer.push({ id: 'music-pack' } as GlobalModGroups['announcer'][number]);

    expect(countGlobalInventoryMods(inventory, [sound('music-pack')])).toBe(2);
  });
});
