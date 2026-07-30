import { describe, expect, it } from 'vitest';
import { portraitImageLabel } from './portraitImageLabel';

describe('portraitImageLabel', () => {
  it('prefers the recorded original filename over the content-addressed path', () => {
    expect(portraitImageLabel('C:/cache/a1b2.png', 'grey-talon-card.jpg')).toBe('grey-talon-card.jpg');
  });

  it('falls back to the stored content hash when no name was recorded', () => {
    expect(portraitImageLabel('C:\\cache\\a1b2.png', null)).toBe('a1b2');
  });
});
