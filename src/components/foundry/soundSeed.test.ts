import { describe, expect, it } from 'vitest';

import {
  MAX_GAIN_DB,
  MIN_WINDOW_MS,
  describeSoundTuning,
  seedTrimWindow,
  soundSeedFromTuning,
  type SoundImportSeed,
} from './soundTuning';
import type { Mod } from '../../types/mod';

/**
 * Seeding `SoundImportEditor` from a recorded change.
 *
 * The interesting half is not "does the window come back": it is what happens
 * when the recorded window was authored against one file and the user opens the
 * retune on another. Vitest runs in a node environment with no DOM, so only the
 * pure fitting is covered here; the editor's rendering of it is not.
 */

function soundMod(swap?: Mod['soundSwap']): Mod {
  return {
    id: 'pak51',
    name: 'Gigawatt Ult',
    fileName: 'pak51_dir.vpk',
    path: 'C:/addons/pak51_dir.vpk',
    metaKey: 'pak51_dir.vpk',
    enabled: true,
    priority: 51,
    size: 1024,
    installedAt: '2026-07-29T00:00:00.000Z',
    soundSwap: swap,
  } as Mod;
}

const baseSwap = {
  heroCodename: 'gigawatt',
  event: 'Gigawatt.LightningBall.Damage',
  audioFileName: 'zap.mp3',
  loop: 'auto' as const,
  pool: 'all' as const,
};

function recorded(reforge: Partial<NonNullable<NonNullable<Mod['soundSwap']>['reforge']>>, loop: 'auto' | 'on' | 'off' = 'auto') {
  return soundMod({
    ...baseSwap,
    loop,
    reforge: {
      heroName: 'Gigawatt',
      audioPath: 'C:/audio/zap.mp3',
      assignments: [{ clipPath: 'sounds/x.vsnd', audioPath: 'C:/audio/zap.mp3' }],
      ...reforge,
    },
  });
}

describe('soundSeedFromTuning', () => {
  it('has nothing to seed from a legacy swap with no recorded block', () => {
    expect(soundSeedFromTuning(describeSoundTuning(soundMod({ ...baseSwap })))).toBeUndefined();
    expect(soundSeedFromTuning(describeSoundTuning(soundMod(undefined)))).toBeUndefined();
  });

  it('carries the recorded window, gain, and loop mode', () => {
    const seed = soundSeedFromTuning(
      describeSoundTuning(recorded({ trimStartMs: 250, trimEndMs: 1800, gainDb: -2 }, 'on'))
    );
    expect(seed).toEqual({ trimStartMs: 250, trimEndMs: 1800, gainDb: -2, loop: 'on' });
  });

  it('seeds a recorded but untuned change as a seed with no numbers', () => {
    const seed = soundSeedFromTuning(describeSoundTuning(recorded({})));
    expect(seed).toEqual({ trimStartMs: undefined, trimEndMs: undefined, gainDb: undefined, loop: 'auto' });
  });
});

describe('seedTrimWindow: no seed', () => {
  it('is the whole clip at unity gain, which is the unseeded editor default', () => {
    expect(seedTrimWindow(undefined, 3200)).toEqual({
      startMs: 0,
      endMs: 3200,
      gainDb: 0,
      seededTrim: false,
      fit: 'none',
    });
  });

  it('rounds the decoded duration to whole milliseconds', () => {
    expect(seedTrimWindow(undefined, 3200.4).endMs).toBe(3200);
    expect(seedTrimWindow(undefined, 3200.6).endMs).toBe(3201);
  });
});

describe('seedTrimWindow: a window that fits', () => {
  it('opens exactly on the recorded window', () => {
    expect(seedTrimWindow({ trimStartMs: 250, trimEndMs: 1800 }, 3200)).toEqual({
      startMs: 250,
      endMs: 1800,
      gainDb: 0,
      seededTrim: true,
      fit: 'exact',
    });
  });

  it('treats a start-only window as running to the end of the clip', () => {
    expect(seedTrimWindow({ trimStartMs: 250 }, 3200)).toMatchObject({
      startMs: 250,
      endMs: 3200,
      fit: 'exact',
    });
  });

  it('treats an end-only window as running from the start of the clip', () => {
    expect(seedTrimWindow({ trimEndMs: 1800 }, 3200)).toMatchObject({
      startMs: 0,
      endMs: 1800,
      fit: 'exact',
    });
  });
});

describe('seedTrimWindow: fitting a window to a different clip', () => {
  it('pulls an end past the clip back to the clip, and says it clamped', () => {
    expect(seedTrimWindow({ trimStartMs: 250, trimEndMs: 9000 }, 3200)).toEqual({
      startMs: 250,
      endMs: 3200,
      gainDb: 0,
      seededTrim: true,
      fit: 'clamped',
    });
  });

  it('drops a window that starts at or past the end of this clip', () => {
    expect(seedTrimWindow({ trimStartMs: 5000, trimEndMs: 9000 }, 3200)).toEqual({
      startMs: 0,
      endMs: 3200,
      gainDb: 0,
      seededTrim: true,
      fit: 'dropped',
    });
  });

  it('drops a survivor narrower than a handle drag could author', () => {
    const barely = seedTrimWindow({ trimStartMs: 3200 - MIN_WINDOW_MS, trimEndMs: 9000 }, 3200);
    expect(barely.fit).toBe('clamped');
    expect(barely.endMs - barely.startMs).toBe(MIN_WINDOW_MS);

    const tooNarrow = seedTrimWindow({ trimStartMs: 3200 - (MIN_WINDOW_MS - 1), trimEndMs: 9000 }, 3200);
    expect(tooNarrow).toMatchObject({ startMs: 0, endMs: 3200, fit: 'dropped' });
  });

  it('never returns an inverted or out-of-range selection, whatever it is given', () => {
    const cases: Array<[SoundImportSeed, number]> = [
      [{ trimStartMs: 1800, trimEndMs: 250 }, 3200],
      [{ trimStartMs: -500, trimEndMs: 1800 }, 3200],
      [{ trimStartMs: 250, trimEndMs: 1800 }, 0],
      [{ trimStartMs: 250, trimEndMs: 1800 }, Number.NaN],
      [{ trimStartMs: Number.NaN, trimEndMs: Number.POSITIVE_INFINITY }, 3200],
      [{ trimStartMs: 0, trimEndMs: 0 }, 3200],
    ];
    for (const [seed, duration] of cases) {
      const fitted = seedTrimWindow(seed, duration);
      const full = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
      expect(fitted.startMs).toBeGreaterThanOrEqual(0);
      expect(fitted.endMs).toBeLessThanOrEqual(full);
      expect(fitted.endMs).toBeGreaterThanOrEqual(fitted.startMs);
    }
  });

  it('collapses an empty clip to an empty selection rather than a negative one', () => {
    expect(seedTrimWindow({ trimStartMs: 250, trimEndMs: 1800 }, 0)).toEqual({
      startMs: 0,
      endMs: 0,
      gainDb: 0,
      seededTrim: true,
      fit: 'dropped',
    });
  });

  it('ignores a non-finite recorded number instead of seeding NaN', () => {
    expect(seedTrimWindow({ trimStartMs: Number.NaN, trimEndMs: Number.POSITIVE_INFINITY }, 3200))
      .toEqual({ startMs: 0, endMs: 3200, gainDb: 0, seededTrim: false, fit: 'none' });
  });
});

describe('seedTrimWindow: gain', () => {
  it('seeds the recorded gain, independent of how the window fitted', () => {
    expect(seedTrimWindow({ gainDb: -2.5 }, 3200)).toMatchObject({ gainDb: -2.5, fit: 'none' });
    expect(seedTrimWindow({ trimStartMs: 9000, gainDb: 4 }, 3200)).toMatchObject({
      gainDb: 4,
      fit: 'dropped',
    });
  });

  it('clamps to the slider range so a seed cannot exceed what the editor can hold', () => {
    expect(seedTrimWindow({ gainDb: 40 }, 3200).gainDb).toBe(MAX_GAIN_DB);
    expect(seedTrimWindow({ gainDb: -40 }, 3200).gainDb).toBe(-MAX_GAIN_DB);
  });

  it('rounds to a tenth of a dB, matching the editor readout', () => {
    expect(seedTrimWindow({ gainDb: 2.449 }, 3200).gainDb).toBe(2.4);
    expect(seedTrimWindow({ gainDb: -2.45 }, 3200).gainDb).toBe(-2.4);
  });

  it('reads a missing or non-finite gain as unity', () => {
    expect(seedTrimWindow({}, 3200).gainDb).toBe(0);
    expect(seedTrimWindow({ gainDb: Number.NaN }, 3200).gainDb).toBe(0);
  });
});

describe('round trip: a recorded change reopens on what it recorded', () => {
  it('reproduces the recorded window and gain when the same file is decoded', () => {
    const state = describeSoundTuning(recorded({ trimStartMs: 250, trimEndMs: 1800, gainDb: 3 }));
    const fitted = seedTrimWindow(soundSeedFromTuning(state), 3200);
    expect(fitted).toMatchObject({ startMs: 250, endMs: 1800, gainDb: 3, fit: 'exact' });
  });

  it('opens an untuned recorded change exactly like an unseeded editor', () => {
    const state = describeSoundTuning(recorded({}));
    const fitted = seedTrimWindow(soundSeedFromTuning(state), 3200);
    expect(fitted).toEqual(seedTrimWindow(undefined, 3200));
  });
});
