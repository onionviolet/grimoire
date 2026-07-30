import { describe, expect, it } from 'vitest';
import { variantPreviewClass } from './cardSlotStyles';

/** Guards the "upload your own" portrait slots. These slots once rested at a
 *  flat opacity-30 with no recovery path, under a hover overlay that added
 *  bg-black/55: hovering a dimmed portrait made it darker, the exact inverse of
 *  the reported request. That regression is invisible in review, so pin the
 *  contract here. */
describe('variantPreviewClass', () => {
  const empty = variantPreviewClass(false);
  const filled = variantPreviewClass(true);

  it('subdues an empty slot at rest', () => {
    expect(empty).toMatch(/\bopacity-50\b/);
    expect(empty).toMatch(/\bgrayscale-\[0\.35\]/);
  });

  it('restores full opacity and full colour on hover', () => {
    expect(empty).toContain('group-hover:opacity-100');
    expect(empty).toContain('group-hover:grayscale-0');
  });

  it('gives keyboard focus the same reveal as hover', () => {
    expect(empty).toContain('group-focus-within:opacity-100');
    expect(empty).toContain('group-focus-within:grayscale-0');
  });

  it('does not gate the reveal behind focus-visible', () => {
    // A previous card-hover control used focus-visible: and never fired under
    // plain :focus. Focus parity has to come from focus-within.
    expect(empty).not.toContain('focus-visible');
  });

  it('never darkens the preview, at rest or revealed', () => {
    for (const cls of [empty, filled]) {
      expect(cls).not.toMatch(/\bbg-black\//);
      expect(cls).not.toMatch(/\bbrightness-/);
    }
  });

  it('honours reduced-motion while still reaching the revealed state', () => {
    expect(empty).toContain('motion-reduce:transition-none');
    // The reveal is a class swap, not an animation, so disabling the
    // transition must not remove the revealed classes themselves.
    expect(empty).toContain('group-hover:opacity-100');
  });

  it('leaves a filled slot at full strength with nothing to reveal', () => {
    expect(filled).not.toMatch(/\bopacity-\d/);
    expect(filled).not.toMatch(/\bgrayscale/);
    expect(filled).not.toContain('group-hover:');
  });

  it('differs between rest and filled so the states are distinguishable', () => {
    expect(empty).not.toEqual(filled);
  });
});
