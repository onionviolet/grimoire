// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOledMode } from './applyOledMode';
import { windowBackgroundColor } from './oledMode';

describe('applyOledMode', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.oled;
  });

  it('marks the document as OLED themed while the mode is enabled', () => {
    applyOledMode(true);

    expect(document.documentElement.dataset.oled).toBe('true');
  });

  it('removes the OLED theme marker when the mode is disabled', () => {
    document.documentElement.dataset.oled = 'true';

    applyOledMode(false);

    expect(document.documentElement.dataset.oled).toBeUndefined();
  });

  it('uses true black for the Electron window in OLED mode', () => {
    expect(windowBackgroundColor(true)).toBe('#000000');
    expect(windowBackgroundColor(false)).toBe('#0f0f0f');
  });
});
