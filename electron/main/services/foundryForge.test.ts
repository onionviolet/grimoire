import { describe, expect, it } from 'vitest';
import { reviewFoundryForge } from './foundryForge';

describe('reviewFoundryForge', () => {
    it('normalizes source paths and reports the deliberate highest-precedence winner', () => {
        const review = reviewFoundryForge([
            {
                id: 'visual', kind: 'texture', precedence: 1,
                request: { entryPath: 'Sounds\\Dash.VSND_C', imagePath: 'dash.png', name: 'Dash', category: 'ability-icon' },
            },
            {
                id: 'sound', kind: 'sound', precedence: 2,
                request: {
                    heroCodename: 'hero', heroName: 'Hero', name: 'Dash audio', audioPath: 'dash.mp3',
                    assignments: [{ clipPath: 'SOUNDS/dash.vsnd', audioPath: 'dash.mp3' }],
                },
            },
        ]);

        expect(review.writeSet).toEqual(['sounds/dash.vsnd_c']);
        expect(review.collisionWinners).toEqual([{ file: 'sounds/dash.vsnd_c', editId: 'sound' }]);
    });
});
