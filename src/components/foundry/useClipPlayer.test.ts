// Randomizer-pool cursor arithmetic for the Foundry audition player.
//
// Many soundevents play a random clip from a pool rather than one fixed sound
// (35% of the indexed global events, up to 58 clips deep), so the audition
// button walks the pool one press at a time instead of replaying `vsnd[0]`
// forever. Only the arithmetic is tested here: this repo's vitest environment
// is plain node with no DOM, so the hook itself cannot be rendered.

import { describe, expect, it } from 'vitest';
import { advancePoolCursor, poolCursor } from './useClipPlayer';

describe('poolCursor', () => {
    it('passes through an in-range cursor', () => {
        expect(poolCursor(0, 6)).toBe(0);
        expect(poolCursor(3, 6)).toBe(3);
        expect(poolCursor(5, 6)).toBe(5);
    });

    it('treats a missing cursor as the start of the pool', () => {
        expect(poolCursor(undefined, 6)).toBe(0);
    });

    it('wraps a cursor left over from a deeper pool', () => {
        // The same event key can be rendered with different pool depths (a
        // voice-line row and a gameplay row), so a stale cursor must not index
        // past the end and hand `undefined` to the extractor.
        expect(poolCursor(9, 4)).toBe(1);
        expect(poolCursor(57, 1)).toBe(0);
    });

    it('is safe on an empty pool', () => {
        // Inherited-only events carry no clips; the caller bails before this,
        // but returning 0 rather than NaN keeps the guard total.
        expect(poolCursor(3, 0)).toBe(0);
    });

    it('normalizes negatives, which bare % would not', () => {
        // JS `%` keeps the sign of the dividend, so -1 % 6 is -1, not 5.
        expect(poolCursor(-1, 6)).toBe(5);
    });
});

describe('advancePoolCursor', () => {
    it('walks the pool and wraps at the end', () => {
        const pool = 4;
        let c = 0;
        const visited = [c];
        for (let i = 0; i < pool - 1; i++) {
            c = advancePoolCursor(c, pool);
            visited.push(c);
        }
        // One full lap visits every clip exactly once...
        expect(visited).toEqual([0, 1, 2, 3]);
        // ...and the next press returns to the start.
        expect(advancePoolCursor(c, pool)).toBe(0);
    });

    it('stays at 0 for a single-clip event', () => {
        expect(advancePoolCursor(0, 1)).toBe(0);
        expect(advancePoolCursor(0, 0)).toBe(0);
    });

    it('advances correctly from a stale out-of-range cursor', () => {
        expect(advancePoolCursor(9, 4)).toBe(2); // normalizes to 1, then +1
    });
});
