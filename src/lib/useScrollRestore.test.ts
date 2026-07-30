import { beforeEach, describe, expect, it } from 'vitest';
import { forgetScrollTop, rememberScrollTop, rememberedScrollTop } from './useScrollRestore';

// The hook itself needs a laid-out DOM to be worth testing (its interesting
// behaviour is the retry against a scrollHeight that is not final yet). What
// is testable without one is the offset store the three pages now share, and
// specifically that they cannot read each other's position.

beforeEach(() => {
  for (const key of ['locker:grid', 'installed:grid', 'conflicts:list', 'foundry:texture']) {
    forgetScrollTop(key);
  }
});

describe('remembered scroll offsets', () => {
  it('answers 0 for a key nothing has stored', () => {
    expect(rememberedScrollTop('locker:grid')).toBe(0);
  });

  it('keeps one offset per key', () => {
    rememberScrollTop('locker:grid', 900);
    rememberScrollTop('installed:grid', 120);
    expect(rememberedScrollTop('locker:grid')).toBe(900);
    expect(rememberedScrollTop('installed:grid')).toBe(120);
    expect(rememberedScrollTop('conflicts:list')).toBe(0);
  });

  it('never stores a negative offset', () => {
    // Elastic overscroll reports one on some platforms, and restoring it would
    // throw on assignment or silently clamp.
    rememberScrollTop('conflicts:list', -40);
    expect(rememberedScrollTop('conflicts:list')).toBe(0);
  });

  it('lets a key be forgotten, so "start at the top" is expressible', () => {
    rememberScrollTop('foundry:texture', 500);
    forgetScrollTop('foundry:texture');
    expect(rememberedScrollTop('foundry:texture')).toBe(0);
  });
});
