import { describe, expect, it } from 'vitest';
import { searchConflict } from './conflictSearch';

const fileConflict = {
  conflictType: 'file' as const,
  details: 'Both mods replace the same file',
  files: ['game/citadel/panorama/images/heroes/abrams_card.png'],
  modA: { name: 'Abrams portrait pack', fileName: 'abrams.vpk', variantLabel: 'Portraits' },
  modB: { name: 'Classic cards', sourceFileName: 'classic-cards.zip' },
};

describe('searchConflict', () => {
  it('matches a pasted path fragment and returns the matching path', () => {
    expect(searchConflict(fileConflict, 'GAME/CITADEL/PANORAMA').matchingPaths).toEqual(fileConflict.files);
  });

  it('matches mod metadata and plain-language conflict labels', () => {
    expect(searchConflict(fileConflict, 'classic-cards')).toMatchObject({ matches: true, matchingPaths: [] });
    expect(searchConflict({ ...fileConflict, conflictType: 'priority', files: undefined }, 'same slot')).toMatchObject({ matches: true });
  });
});
