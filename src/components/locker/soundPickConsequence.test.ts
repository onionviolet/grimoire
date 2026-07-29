/**
 * The Locker applies on click, so the disclosure has to be right before the
 * write, not after it. These pin the two halves users cannot see: what a pick
 * takes over, and what it quietly stops overriding.
 */
import { describe, it, expect } from 'vitest';
import { pickConsequence } from './soundPickConsequence';

const applied = {
  metaKey: 'pak01_dir.vpk',
  files: [
    'sounds/abilities/atlas/atlas_charge.vsnd_c',
    'sounds/abilities/atlas/atlas_impact.vsnd_c',
  ],
};

describe('pickConsequence', () => {
  it('is null when nothing is applied, because nothing can be overwritten', () => {
    expect(pickConsequence(null, { metaKey: 'pak02_dir.vpk', files: applied.files })).toBeNull();
  });

  it('is null for the source already applied', () => {
    expect(pickConsequence(applied, applied)).toBeNull();
  });

  it('counts the entries the candidate takes over', () => {
    expect(
      pickConsequence(applied, { metaKey: 'pak02_dir.vpk', files: applied.files })
    ).toEqual({ takenOver: 2, reverted: 0 });
  });

  it('counts the entries that revert to the game default because the candidate does not write them', () => {
    // The pick rebuilds the whole (hero, slot) selection, so the applied
    // source's unmatched entry stops being overridden at all. This is the half
    // a "will be overwritten" message on its own would hide.
    expect(
      pickConsequence(applied, {
        metaKey: 'pak02_dir.vpk',
        files: ['sounds/abilities/atlas/atlas_charge.vsnd_c'],
      })
    ).toEqual({ takenOver: 1, reverted: 1 });
  });

  it('reports a clean handover when the candidate writes entries the applied source never did', () => {
    expect(
      pickConsequence(applied, {
        metaKey: 'pak02_dir.vpk',
        files: ['sounds/abilities/atlas/atlas_ult.vsnd_c'],
      })
    ).toEqual({ takenOver: 0, reverted: 2 });
  });

  it('matches on the normalized path, so slash and case variants are one entry', () => {
    expect(
      pickConsequence(
        { metaKey: 'pak01_dir.vpk', files: ['Sounds\\Abilities\\Atlas\\Atlas_Charge.vsnd_c'] },
        { metaKey: 'pak02_dir.vpk', files: ['sounds/abilities/atlas/atlas_charge.vsnd_c'] }
      )
    ).toEqual({ takenOver: 1, reverted: 0 });
  });

  it('does not let a duplicate listing inflate the reverted count', () => {
    expect(
      pickConsequence(
        {
          metaKey: 'pak01_dir.vpk',
          files: [
            'sounds/abilities/atlas/atlas_charge.vsnd_c',
            'sounds/abilities/atlas/atlas_charge.vsnd_c',
          ],
        },
        { metaKey: 'pak02_dir.vpk', files: ['sounds/abilities/atlas/atlas_ult.vsnd_c'] }
      )
    ).toEqual({ takenOver: 0, reverted: 1 });
  });
});
