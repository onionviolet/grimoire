// @vitest-environment jsdom
// The suite runs in node by default; this module is about `localStorage`, so
// it needs a real Storage to read, write, throw from, and spy on.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changedPrefCount,
  readPref,
  resetAllPrefs,
  resetPref,
  UI_PREFS,
  writePref,
} from './uiPrefs';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('defaults', () => {
  it('answers with the registered default when nothing is stored', () => {
    expect(readPref('lockerViewMode')).toBe('gallery');
    expect(readPref('lockerHideEmpty')).toBe(false);
    expect(readPref('cardSize')).toBe(1);
    expect(readPref('installedSource')).toEqual(['gamebanana', 'local']);
    expect(readPref('soundVolume')).toBe(0.7);
  });

  it('answers with the default rather than the stored text when it is unusable', () => {
    localStorage.setItem(UI_PREFS.lockerViewMode.key, 'sideways');
    localStorage.setItem(UI_PREFS.cardSize.key, 'not-a-number');
    localStorage.setItem(UI_PREFS.installedSource.key, '{oh no');
    expect(readPref('lockerViewMode')).toBe('gallery');
    expect(readPref('cardSize')).toBe(1);
    expect(readPref('installedSource')).toEqual(['gamebanana', 'local']);
  });
});

describe('boolean encodings', () => {
  it('reads both encodings that shipped, so no saved toggle resets on upgrade', () => {
    for (const [stored, expected] of [
      ['true', true],
      ['false', false],
      ['1', true],
      ['0', false],
    ] as const) {
      localStorage.setItem(UI_PREFS.installedFixUnknownHidden.key, stored);
      expect(readPref('installedFixUnknownHidden')).toBe(expected);
    }
  });

  it('writes one encoding', () => {
    writePref('lockerHideEmpty', true);
    expect(localStorage.getItem(UI_PREFS.lockerHideEmpty.key)).toBe('true');
    writePref('lockerHideEmpty', false);
    expect(localStorage.getItem(UI_PREFS.lockerHideEmpty.key)).toBe('false');
  });
});

describe('clamping', () => {
  it('clamps a stored number into range instead of discarding it', () => {
    localStorage.setItem(UI_PREFS.cardSize.key, '99');
    expect(readPref('cardSize')).toBe(2);
    localStorage.setItem(UI_PREFS.cardSize.key, '0.1');
    expect(readPref('cardSize')).toBe(0.8);
    localStorage.setItem(UI_PREFS.soundVolume.key, '-3');
    expect(readPref('soundVolume')).toBe(0);
  });

  it('clamps on write too, so an out-of-range value never reaches storage', () => {
    writePref('cardSize', 500);
    expect(localStorage.getItem(UI_PREFS.cardSize.key)).toBe('2');
  });

  it('keeps an in-range value exactly', () => {
    writePref('cardSize', 1.3);
    expect(readPref('cardSize')).toBe(1.3);
  });
});

describe('set-valued preferences', () => {
  it('drops unknown members and de-duplicates', () => {
    localStorage.setItem(
      UI_PREFS.installedSource.key,
      JSON.stringify(['local', 'local', 'nonsense'])
    );
    expect(readPref('installedSource')).toEqual(['local']);
  });

  it('treats an empty selection as unset, because no filter is the default', () => {
    localStorage.setItem(UI_PREFS.installedSource.key, '[]');
    expect(readPref('installedSource')).toEqual(['gamebanana', 'local']);
  });
});

describe('legacy keys', () => {
  it('carries a card size set on either page over to the shared key', () => {
    localStorage.setItem('browseCardSizeMultiplier', '1.5');
    expect(readPref('cardSize')).toBe(1.5);

    localStorage.clear();
    localStorage.setItem('installedCardSizeMultiplier', '1.2');
    expect(readPref('cardSize')).toBe(1.2);
  });

  it('prefers the current key over a legacy one', () => {
    localStorage.setItem(UI_PREFS.cardSize.key, '1.1');
    localStorage.setItem('browseCardSizeMultiplier', '1.9');
    expect(readPref('cardSize')).toBe(1.1);
  });

  it('migrates only the layout value the old key actually carried', () => {
    localStorage.setItem('browseViewMode', 'list');
    expect(readPref('browseLayout')).toBe('list');

    // 'compact' and 'dense' were card sizes, not structure, so they are grid.
    localStorage.setItem('browseViewMode', 'dense');
    expect(readPref('browseLayout')).toBe('grid');
  });
});

describe('reset', () => {
  it('forgets the legacy keys too, or the old value would come straight back', () => {
    localStorage.setItem('browseCardSizeMultiplier', '1.9');
    writePref('cardSize', 1.4);
    expect(readPref('cardSize')).toBe(1.4);

    resetPref('cardSize');
    expect(readPref('cardSize')).toBe(1);
    expect(localStorage.getItem('browseCardSizeMultiplier')).toBeNull();
  });

  it('resets every registered preference', () => {
    writePref('lockerViewMode', 'list');
    writePref('conflictsViewMode', 'list');
    writePref('soundVolume', 0.2);
    expect(changedPrefCount()).toBe(3);

    resetAllPrefs();

    expect(changedPrefCount()).toBe(0);
    expect(readPref('lockerViewMode')).toBe('gallery');
    expect(readPref('conflictsViewMode')).toBe('grid');
    expect(readPref('soundVolume')).toBe(0.7);
  });

  it('leaves storage this module does not own alone', () => {
    // "Reset view preferences" must never throw away favorites or mod lists.
    localStorage.setItem('grimoireFavoriteHeroNames', '["Abrams"]');
    localStorage.setItem('grimoireModLists', '[{"id":"1"}]');
    resetAllPrefs();
    expect(localStorage.getItem('grimoireFavoriteHeroNames')).toBe('["Abrams"]');
    expect(localStorage.getItem('grimoireModLists')).toBe('[{"id":"1"}]');
  });
});

describe('storage being unavailable', () => {
  it('reads the default rather than throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readPref('lockerViewMode')).toBe('gallery');
    expect(readPref('cardSize')).toBe(1);
  });

  it('swallows a failed write, because a preference is not worth a crash', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writePref('cardSize', 1.5)).not.toThrow();
  });

  it('swallows a failed reset', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => resetAllPrefs()).not.toThrow();
  });
});

describe('the registry itself', () => {
  it('names every storage key exactly once', () => {
    const keys = Object.values(UI_PREFS).flatMap((pref) => [
      pref.key,
      ...((pref as { legacy?: readonly { key: string }[] }).legacy ?? []).map((l) => l.key),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
