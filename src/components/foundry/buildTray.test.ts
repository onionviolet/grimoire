import { describe, expect, it } from 'vitest';
import {
  affectedFileCount,
  analyzeStagedEdits,
  normalizeOutputName,
  missingSourceFiles,
  reviewStagedEdits,
  stagedEditSourceFiles,
  toForgeRequest,
  unsupportedStagedEditKind,
} from './buildTray';
import { serializeSoundStagedEdit } from './soundStagedEdit';
import { serializeVisualReplacement } from './visualEdits';

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

  it('does not report a staged edit as colliding with itself when its path is duplicated', () => {
    const edit = {
      id: 'icon', kind: 'texture' as const, title: 'Icon',
      affectedFiles: ['panorama\\icon.vtex_c', 'panorama/icon.vtex_c'], precedence: 1,
    };
    expect(analyzeStagedEdits([edit])).toEqual([]);
  });
});

describe('one reviewed write set across both live authoring flows', () => {
  // Exactly what SoundBrowse/GlobalSoundBrowse and LibraryBrowse/TextureBrowse
  // hand the tray, so the review under test is the one users actually get.
  const sound = serializeSoundStagedEdit({
    id: 'sound:dash',
    title: 'Dash audio',
    precedence: 1,
    request: {
      heroCodename: 'abrams', heroName: 'Abrams', event: 'Hero_Dash', name: 'Dash audio',
      audioPath: 'C:/audio/dash.mp3',
      assignments: [{ clipPath: '\\sounds\\dash.vsnd', audioPath: 'C:/audio/dash.mp3' }],
    },
  });
  const visual = serializeVisualReplacement({
    entryPath: '/Sounds/Dash.VSND_C',
    imagePath: 'C:/art/dash.png',
    name: 'Dash icon',
    category: 'ability-icon',
  });

  it('merges sound and visual edits into one normalized write set', () => {
    const review = reviewStagedEdits([visual, sound], new Set([visual.id, sound.id]));
    expect(review.writeSet).toEqual(['sounds/dash.vsnd_c']);
    expect(review.selected).toHaveLength(2);
  });

  it('resolves a cross-kind collision by precedence, not by the kind that staged first', () => {
    const soundWins = reviewStagedEdits([visual, sound], new Set([visual.id, sound.id]));
    expect(soundWins.collisions).toHaveLength(1);
    expect(soundWins.collisions[0].winner.id).toBe(sound.id);

    // Restaging the visual edit last must flip the winner: the tray's precedence
    // is the only authority, and it is symmetric across kinds.
    const visualLast = { ...visual, precedence: 2 };
    const visualWins = reviewStagedEdits([sound, visualLast], new Set([sound.id, visualLast.id]));
    expect(visualWins.collisions[0].winner.id).toBe(visualLast.id);
  });

  it('serializes both kinds into one build request whose confirmation matches the review', () => {
    const review = reviewStagedEdits([visual, sound], new Set([visual.id, sound.id]));
    const request = toForgeRequest('  My: Forge  ', review);

    expect(request.name).toBe('My- Forge');
    expect(request.edits.map((edit) => edit.kind)).toEqual(['texture', 'sound']);
    expect(request.confirmation).toEqual({
      writeSet: ['sounds/dash.vsnd_c'],
      collisionWinners: [{ file: 'sounds/dash.vsnd_c', editId: sound.id }],
    });
    // The texture edit carries its authoring input, never a generated VPK path.
    expect(request.edits[0]).toMatchObject({ kind: 'texture', request: { imagePath: 'C:/art/dash.png' } });
  });

  it('collects every source file both kinds still need on disk, deduped', () => {
    expect(stagedEditSourceFiles([visual, sound])).toEqual(['C:/art/dash.png', 'C:/audio/dash.mp3']);
  });

  it('treats an unmentioned source file as missing so the forge is blocked', () => {
    const sources = stagedEditSourceFiles([visual, sound]);
    expect(missingSourceFiles(sources, sources)).toEqual([]);
    expect(missingSourceFiles(sources, ['C:/art/dash.png'])).toEqual(['C:/audio/dash.mp3']);
    // An answer that lists nothing must block everything, never pass silently.
    expect(missingSourceFiles(sources, [])).toEqual(sources);
  });

  it('names an unbuildable kind rather than guessing a build for it', () => {
    const recolor = { id: 'recolor', kind: 'recolor' as const, title: 'Recolor', affectedFiles: ['materials/a.vmat_c'], precedence: 3 };
    expect(unsupportedStagedEditKind([visual, sound])).toBeNull();
    expect(unsupportedStagedEditKind([visual, recolor])).toBe('recolor');
    expect(() => toForgeRequest('x', reviewStagedEdits([recolor], new Set([recolor.id])))).toThrow('Unsupported staged edit kind');
  });
});
