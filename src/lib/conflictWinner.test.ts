import { describe, expect, it } from 'vitest';
import { winnerButtonState } from './conflictWinner';

describe('winnerButtonState', () => {
  it('requires both mods enabled before anything else', () => {
    expect(winnerButtonState(false, false, true)).toBe('needsBoth');
  });

  it('reports the current winner, including a Global winner over a normal mod', () => {
    expect(winnerButtonState(true, true, false)).toBe('wins');
  });

  it('locks the loser when the winner it would displace is Global', () => {
    expect(winnerButtonState(true, false, true)).toBe('globalLocked');
  });

  it('offers the reorder when neither side blocks it', () => {
    expect(winnerButtonState(true, false, false)).toBe('available');
  });
});
