import { describe, expect, it } from 'vitest';
import { computeSourceGating } from './sourceGating';
import type { FoundryAssetSource, FoundryAssetSourcesInspection } from '../../types/foundry';

const source = (overrides: Partial<FoundryAssetSource> = {}): FoundryAssetSource => ({
  modId: 'mod-1',
  modName: 'Readable skin',
  enabled: true,
  priority: 10,
  provenance: 'Downloaded',
  entries: ['panorama/images/hud/x.vtex_c'],
  wins: ['panorama/images/hud/x.vtex_c'],
  managed: true,
  auditionable: [],
  lockerManaged: false,
  ...overrides,
});

const inspection = (
  overrides: Partial<FoundryAssetSourcesInspection> = {},
): FoundryAssetSourcesInspection => ({
  paths: ['panorama/images/hud/x.vtex_c'],
  sources: [],
  winners: {},
  unreadableMods: [],
  ...overrides,
});

describe('computeSourceGating', () => {
  it('leaves every action open when nothing is unreadable', () => {
    const gating = computeSourceGating(inspection({ sources: [source()] }));
    expect(gating.incomplete).toBe(false);
    expect(gating.toggleBlocked).toBe(false);
    expect(gating.replacementBlocked).toBe(false);
    expect(gating.unreadable).toEqual([]);
  });

  it('keeps a readable source actionable while an unrelated mod is unreadable', () => {
    // The regression this lane exists for: the unreadable mod does not contend
    // for these paths at all, and it used to disable the whole panel.
    const gating = computeSourceGating(
      inspection({
        sources: [source()],
        unreadableMods: [{ modId: 'junk', modName: 'Archive renamed to vpk', enabled: true }],
      }),
    );
    expect(gating.toggleBlocked).toBe(false);
    expect(gating.incomplete).toBe(true);
  });

  it('keeps the replacement path blocked whenever anything is unreadable', () => {
    const enabledUnreadable = computeSourceGating(
      inspection({ unreadableMods: [{ modId: 'junk', modName: 'Junk', enabled: true }] }),
    );
    const disabledUnreadable = computeSourceGating(
      inspection({ unreadableMods: [{ modId: 'junk', modName: 'Junk', enabled: false }] }),
    );
    expect(enabledUnreadable.replacementBlocked).toBe(true);
    // Disabled narrows the runtime risk but not the ambiguity about contents,
    // so the gate is not widened without a path-level argument.
    expect(disabledUnreadable.replacementBlocked).toBe(true);
  });

  it('lists every unreadable mod in the warning, not just the first', () => {
    const gating = computeSourceGating(
      inspection({
        unreadableMods: [
          { modId: 'a', modName: 'Seven voice pack', enabled: true },
          { modId: 'b', modName: 'Bebop arm', enabled: false },
          { modId: 'c', modName: 'Crosshair pack', enabled: true },
        ],
      }),
    );
    expect(gating.unreadable).toHaveLength(3);
    expect(gating.unreadableNames).toBe('Seven voice pack, Bebop arm, Crosshair pack');
  });

  it('separates enabled from disabled unreadable mods so the uncertainty can be stated exactly', () => {
    const gating = computeSourceGating(
      inspection({
        unreadableMods: [
          { modId: 'a', modName: 'On', enabled: true },
          { modId: 'b', modName: 'Off', enabled: false },
        ],
      }),
    );
    expect(gating.enabledUnreadable.map((mod) => mod.modId)).toEqual(['a']);
    expect(gating.disabledUnreadable.map((mod) => mod.modId)).toEqual(['b']);
  });

  it('carries lane A\'s detected file type through when it is present, and tolerates its absence', () => {
    const gating = computeSourceGating({
      unreadableMods: [
        { modId: 'a', modName: 'Seven voice pack', enabled: true, detectedType: '7-Zip archive' },
        { modId: 'b', modName: 'Bebop arm', enabled: true },
      ],
    });
    expect(gating.unreadable[0].detectedType).toBe('7-Zip archive');
    expect(gating.unreadable[1].detectedType).toBeUndefined();
  });

  it('treats a missing inspection as ungated rather than blocked', () => {
    const gating = computeSourceGating(null);
    expect(gating.incomplete).toBe(false);
    expect(gating.replacementBlocked).toBe(false);
    expect(gating.unreadableNames).toBe('');
  });
});
