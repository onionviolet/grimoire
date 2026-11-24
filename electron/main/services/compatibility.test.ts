import { describe, it, expect, vi } from 'vitest';
vi.mock('./mods', () => ({ scanModsReadOnly: vi.fn(), runExclusiveModMutation: (fn: () => Promise<unknown>) => fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: vi.fn() }));
vi.mock('./vpk', () => ({ parseVpkDirectory: vi.fn() }));
vi.mock('./foundryCatalog', () => ({ foundryBuildDiff: vi.fn() }));
import { indexPatchChanges, isPatchSensitivePath, reviewPatchChanges, reviewReplacementPaths } from './compatibility';

describe('replacement path evidence', () => {
  it('finds changed overrides and changed stock siblings without attributing unrelated files', () => {
    const changes = indexPatchChanges([
      { path: 'panorama/layout/post_game/result.vxml_c', kind: 'changed' },
      { path: 'panorama/scripts/post_game/result.vts_c', kind: 'changed' },
      { path: 'panorama/scripts/other.vts_c', kind: 'changed' },
    ]);
    expect(reviewPatchChanges(['Panorama/layout/post_game/result.vxml_c'], changes)).toEqual({
      changedPaths: ['panorama/layout/post_game/result.vxml_c'],
      relatedPaths: ['panorama/scripts/post_game/result.vts_c'],
    });
  });
  it('compares paths case-insensitively and bounds evidence without dropping the count', () => {
    const paths = ['Models/Hero.vmdl_c', ...Array.from({ length: 40 }, (_, n) => `materials/added${n}.vmat_c`), 'sounds/audio.vsnd_c'];
    const evidence = reviewReplacementPaths(paths, new Set(['models/hero.vmdl_c']));
    expect(evidence.status).toBe('review');
    expect(evidence.sensitiveCount).toBe(41);
    expect(evidence.missingCount).toBe(40);
    expect(evidence.missingPaths).toHaveLength(30);
  });
  it('reports a missing Panorama HUD replacement', () => {
    expect(reviewReplacementPaths(['panorama/layout/hud.vxml_c', 'panorama/scripts/hud.vjs_c', 'panorama/styles/hud.vcss_c'], new Set()).missingCount).toBe(3);
  });
  it('distinguishes unreadable indexes from no missing paths', () => {
    expect(reviewReplacementPaths(null, new Set()).status).toBe('unreadable');
    expect(reviewReplacementPaths([], new Set()).status).toBe('no-missing-paths');
    expect(isPatchSensitivePath('scripts/config.vdata_c')).toBe(true);
    expect(isPatchSensitivePath('unrelated/readme.txt')).toBe(false);
  });
});
