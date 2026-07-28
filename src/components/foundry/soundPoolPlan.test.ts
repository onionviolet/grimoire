import { describe, expect, it } from 'vitest';
import { planSoundPool, seededShuffle } from './soundPoolPlan';

const clips = ['sounds/a.vsnd', 'sounds/b.vsnd', 'sounds/c.vsnd'];
const library = [{ path: '/one.mp3', name: 'one' }, { path: '/two.mp3', name: 'two' }];

describe('planSoundPool', () => {
    it('replaces every target while retaining each randomizer entry', () => {
        expect(planSoundPool('replace-all', clips, new Set(['sounds/a.vsnd']), library)).toEqual([
            { clipPath: 'sounds/a.vsnd', audioPath: '/one.mp3' },
            { clipPath: 'sounds/b.vsnd', audioPath: '/two.mp3' },
            { clipPath: 'sounds/c.vsnd', audioPath: '/one.mp3' },
        ]);
    });
    it('only writes deliberately selected targets', () => {
        expect(planSoundPool('selected-targets', clips, new Set(['sounds/b.vsnd']), library)).toEqual([
            { clipPath: 'sounds/b.vsnd', audioPath: '/one.mp3' },
        ]);
    });
    it('requires an exact N-to-N mapping', () => {
        expect(planSoundPool('n-to-n', clips, new Set(clips), library)).toEqual([]);
        expect(planSoundPool('n-to-n', clips.slice(0, 2), new Set(clips.slice(0, 2)), library)).toHaveLength(2);
    });
    it('uses a reproducible seed for a user-library shuffle', () => {
        expect(seededShuffle(library, 42)).toEqual(seededShuffle(library, 42));
        expect(planSoundPool('seeded-library', clips, new Set(clips), library, 42)).toEqual(
            planSoundPool('seeded-library', clips, new Set(clips), library, 42)
        );
    });
});
