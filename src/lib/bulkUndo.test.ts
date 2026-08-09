import { describe, expect, it } from 'vitest';
import { bulkChangedCount, bulkUndoPlan, captureBulkSnapshot } from './bulkUndo';
import type { GlobalModType, Mod } from '../types/mod';

/**
 * Local Mod factory, matching the fixture style of ChangePools.test.tsx: only
 * the fields the snapshot/diff reads are ever set explicitly, everything else
 * falls back to a minimal valid shape.
 */
function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A mod',
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

const HIDEOUT: GlobalModType = 'hideout';

describe('captureBulkSnapshot', () => {
  it('records exactly the selected ids with enabled, lockerHero and globalType, normalizing absent optionals to null', () => {
    const mods = [
      mod({ id: 'a', enabled: false, lockerHero: 'Abrams', globalType: HIDEOUT }),
      mod({ id: 'b', enabled: true }),
      mod({ id: 'c', enabled: false }),
    ];

    expect(captureBulkSnapshot(mods, ['a', 'c'])).toEqual([
      { modId: 'a', enabled: false, lockerHero: 'Abrams', globalType: HIDEOUT },
      { modId: 'c', enabled: false, lockerHero: null, globalType: null },
    ]);
  });

  it('records nothing for an id that is not in the mod list', () => {
    const mods = [mod({ id: 'a', enabled: true })];

    expect(captureBulkSnapshot(mods, ['a', 'missing'])).toEqual([
      { modId: 'a', enabled: true, lockerHero: null, globalType: null },
    ]);
  });
});

describe('bulkUndoPlan', () => {
  it('builds an empty plan from a snapshot against unchanged mods', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', enabled: false }), mod({ id: 'b', enabled: true })],
      ['a', 'b'],
    );
    const current = [mod({ id: 'a', enabled: false }), mod({ id: 'b', enabled: true })];

    expect(bulkUndoPlan(snapshot, current)).toEqual([]);
  });

  it('emits one toggle per mod whose enabled differs and none for a mod already enabled before the batch', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', enabled: false }), mod({ id: 'b', enabled: false }), mod({ id: 'c', enabled: true })],
      ['a', 'b', 'c'],
    );
    const current = [
      mod({ id: 'a', enabled: true }),
      mod({ id: 'b', enabled: true }),
      mod({ id: 'c', enabled: true }),
    ];

    expect(bulkUndoPlan(snapshot, current)).toEqual([
      { kind: 'toggle', modId: 'a' },
      { kind: 'toggle', modId: 'b' },
    ]);
  });

  it('emits one lockerHero operation per mod carrying the snapshot prior value, including null for a mod that had no tag', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', lockerHero: 'Abrams' }), mod({ id: 'b' })],
      ['a', 'b'],
    );
    const current = [
      mod({ id: 'a', lockerHero: 'Seven' }),
      mod({ id: 'b', lockerHero: 'Seven' }),
    ];

    expect(bulkUndoPlan(snapshot, current)).toEqual([
      { kind: 'lockerHero', modId: 'a', value: 'Abrams' },
      { kind: 'lockerHero', modId: 'b', value: null },
    ]);
  });

  it('emits both the globalType operation and, where the main-process handler cleared it, the lockerHero operation', () => {
    const snapshot = captureBulkSnapshot([mod({ id: 'a', lockerHero: 'Abrams' })], ['a']);
    // handleBulkTagGlobal writes the global type; the main-process handler
    // clears any hero tag as a side effect.
    const current = [mod({ id: 'a', globalType: HIDEOUT })];

    expect(bulkUndoPlan(snapshot, current)).toEqual([
      { kind: 'lockerHero', modId: 'a', value: 'Abrams' },
      { kind: 'globalType', modId: 'a', value: null },
    ]);
  });

  it('skips a mod that is no longer present in the live list and keeps every operation for the mods that are', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', enabled: false }), mod({ id: 'b', enabled: false })],
      ['a', 'b'],
    );
    const current = [mod({ id: 'b', enabled: true })];

    expect(bulkUndoPlan(snapshot, current)).toEqual([{ kind: 'toggle', modId: 'b' }]);
  });

  it('restores a field changed by hand to a third value, and emits nothing for a mod already back at its snapshot value', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', lockerHero: 'Abrams' }), mod({ id: 'b', lockerHero: 'Abrams' })],
      ['a', 'b'],
    );
    const current = [
      // User changed by hand to something that is neither the snapshot value
      // nor the batch value.
      mod({ id: 'a', lockerHero: 'Haze' }),
      // User already restored it by hand.
      mod({ id: 'b', lockerHero: 'Abrams' }),
    ];

    expect(bulkUndoPlan(snapshot, current)).toEqual([
      { kind: 'lockerHero', modId: 'a', value: 'Abrams' },
    ]);
  });
});

describe('bulkChangedCount', () => {
  it('reports how many distinct mods differ from the snapshot, not how many operations the plan holds', () => {
    const snapshot = captureBulkSnapshot(
      [mod({ id: 'a', enabled: false }), mod({ id: 'b', enabled: true, lockerHero: 'Abrams' })],
      ['a', 'b'],
    );
    const current = [
      mod({ id: 'a', enabled: true, lockerHero: 'Seven', globalType: HIDEOUT }),
      mod({ id: 'b', enabled: true, lockerHero: 'Abrams', globalType: HIDEOUT }),
    ];

    const plan = bulkUndoPlan(snapshot, current);
    expect(plan.length).toBeGreaterThan(1);
    expect(bulkChangedCount(snapshot, current)).toBe(2);
  });
});
