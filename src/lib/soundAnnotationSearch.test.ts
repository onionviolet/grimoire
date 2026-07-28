import { describe, expect, it } from 'vitest';
import { isAnnotated, matchSoundWithAnnotation } from './soundAnnotationSearch';

const annotation = { name: 'Ultimate cue', note: 'Very loud finisher', tags: ['ult', 'favorite'], updatedAt: '2026-01-01T00:00:00.000Z' };

describe('sound annotation search', () => {
    it('distinguishes catalog matches from personal annotation matches', () => {
        expect(matchSoundWithAnnotation(['Weapon fire', 'Hero.Gun.Fire'], annotation, 'gun')).toBe('catalog');
        expect(matchSoundWithAnnotation(['Weapon fire'], annotation, '#ult')).toBe('annotation');
        expect(matchSoundWithAnnotation(['Weapon fire'], annotation, 'loud')).toBe('annotation');
        expect(matchSoundWithAnnotation(['Weapon fire'], annotation, 'missing')).toBeNull();
    });

    it('recognizes tag-only annotations for the annotated filter', () => {
        expect(isAnnotated({ ...annotation, name: null, note: null })).toBe(true);
        expect(isAnnotated(undefined)).toBe(false);
    });
});
