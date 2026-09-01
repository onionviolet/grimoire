import { describe, expect, it } from 'vitest';
import { chatWheelAddonsIn, isChatWheelAddon } from './chatWheelAddon';

describe('isChatWheelAddon', () => {
  it('recognises the section chat-wheel:save stamps on its VPK', () => {
    expect(isChatWheelAddon({ sourceSection: 'ChatWheel' })).toBe(true);
  });

  it('leaves every other mod alone, including one with no section at all', () => {
    expect(isChatWheelAddon({ sourceSection: 'Mod' })).toBe(false);
    expect(isChatWheelAddon({ sourceSection: 'Sound' })).toBe(false);
    expect(isChatWheelAddon({ sourceSection: undefined })).toBe(false);
    expect(isChatWheelAddon({ sourceSection: 'chatwheel' })).toBe(false);
  });

  it('filters a mixed list down to the chat wheel add-ons, keeping order', () => {
    const mods = [
      { name: 'skin', sourceSection: 'Mod' },
      { name: 'wheel a', sourceSection: 'ChatWheel' },
      { name: 'sound', sourceSection: 'Sound' },
      { name: 'wheel b', sourceSection: 'ChatWheel' },
    ];
    expect(chatWheelAddonsIn(mods).map((mod) => mod.name)).toEqual(['wheel a', 'wheel b']);
    expect(chatWheelAddonsIn([])).toEqual([]);
  });
});
