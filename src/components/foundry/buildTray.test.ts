import { describe, expect, it } from 'vitest';
import { affectedFileCount, analyzeStagedEdits, normalizeOutputName, reviewStagedEdits } from './buildTray';

describe('Foundry build tray model', () => {
  it('keeps source-free staged edits and resolves a collision by precedence', () => {
    const edits = [
      { id: 'texture', kind: 'texture' as const, title: 'Texture', affectedFiles: ['panorama\\icon.vtex_c'], precedence: 1 },
      { id: 'recolor', kind: 'recolor' as const, title: 'Recolor', affectedFiles: ['panorama/icon.vtex_c', 'materials/a.vmat_c'], precedence: 2 },
    ];
    const collisions = analyzeStagedEdits(edits);
    expect(collisions).toEqual([{ file: 'panorama/icon.vtex_c', winner: edits[1], overwritten: [edits[0]] }]);
    expect(affectedFileCount(edits)).toBe(2);
    expect(edits[0].affectedFiles[0]).toBe('panorama\\icon.vtex_c');
  });

  it('only bulk-builds items explicitly selected in the tray and previews the exact write-set', () => {
    const first = { id: 'first', kind: 'sound' as const, title: 'First', affectedFiles: ['sound/a.vsnd_c', 'sound/b.vsnd_c'], precedence: 1 };
    const second = { id: 'second', kind: 'sound' as const, title: 'Second', affectedFiles: ['sound/b.vsnd_c'], precedence: 2 };
    expect(reviewStagedEdits([first, second], new Set(['first']))).toEqual({ selected: [first], writeSet: ['sound/a.vsnd_c', 'sound/b.vsnd_c'], collisions: [] });
    expect(reviewStagedEdits([first, second], new Set(['first', 'second'])).collisions[0].winner).toBe(second);
  });

  it('uses last staged edit as a stable tie-breaker and creates safe output names', () => {
    const first = { id: 'a', kind: 'sound' as const, title: 'A', affectedFiles: ['sound/a.vsnd_c'], precedence: 3 };
    const last = { ...first, id: 'b', title: 'B' };
    expect(analyzeStagedEdits([first, last])[0].winner).toBe(last);
    expect(normalizeOutputName('  My: Foundry / Mod  ')).toBe('My- Foundry - Mod');
    expect(normalizeOutputName('')).toBe('Foundry mod');
  });
});
