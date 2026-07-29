import { describe, expect, it } from 'vitest';

import {
  describeSoundTuning,
  formatGain,
  formatTrimWindow,
  soundTuningBadges,
} from './soundTuning';
import type { Mod } from '../../types/mod';

/** Minimal mod shaped like the ones `My changes` lists. Only the sound-swap
 *  provenance matters here; the row chrome fields are irrelevant to the
 *  derivation and are filled with placeholders. */
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

function withReforge(reforge: Partial<NonNullable<NonNullable<Mod['soundSwap']>['reforge']>>) {
  return soundMod({
    ...baseSwap,
    reforge: {
      heroName: 'Gigawatt',
      audioPath: 'C:/audio/zap.mp3',
      assignments: [{ clipPath: 'sounds/x.vsnd', audioPath: 'C:/audio/zap.mp3' }],
      ...reforge,
    },
  });
}

describe('describeSoundTuning', () => {
  it('reads a mod with no sound swap as not recorded and not retunable', () => {
    const state = describeSoundTuning(soundMod(undefined));
    expect(state).toMatchObject({
      recorded: false,
      trimmed: false,
      gained: false,
      loop: null,
      untouched: false,
      retunable: false,
    });
  });

  it('separates a legacy swap (no reforge block) from a recorded but untuned one', () => {
    const legacy = describeSoundTuning(soundMod({ ...baseSwap }));
    expect(legacy.recorded).toBe(false);
    expect(legacy.untouched).toBe(false);
    expect(legacy.retunable).toBe(false);

    const untuned = describeSoundTuning(withReforge({}));
    expect(untuned.recorded).toBe(true);
    expect(untuned.untouched).toBe(true);
    expect(untuned.retunable).toBe(true);
  });

  it('surfaces a recorded trim window and gain', () => {
    const state = describeSoundTuning(withReforge({ trimStartMs: 250, trimEndMs: 1800, gainDb: 3 }));
    expect(state.trimmed).toBe(true);
    expect(state.gained).toBe(true);
    expect(state.untouched).toBe(false);
    expect(state.trimStartMs).toBe(250);
    expect(state.trimEndMs).toBe(1800);
    expect(state.gainDb).toBe(3);
  });

  it('does not report the minter defaults (start 0, no end, unity gain) as edits', () => {
    const state = describeSoundTuning(withReforge({ trimStartMs: 0, gainDb: 0 }));
    expect(state.trimmed).toBe(false);
    expect(state.gained).toBe(false);
    expect(state.untouched).toBe(true);
    expect(state.trimStartMs).toBeUndefined();
    expect(state.gainDb).toBeUndefined();
  });

  it('ignores an end that cannot narrow the clip', () => {
    const state = describeSoundTuning(withReforge({ trimStartMs: 900, trimEndMs: 900 }));
    expect(state.trimEndMs).toBeUndefined();
    expect(state.trimStartMs).toBe(900);
    expect(state.trimmed).toBe(true);
  });

  it('ignores non-finite persisted numbers rather than rendering NaN', () => {
    const state = describeSoundTuning(withReforge({
      trimStartMs: Number.NaN,
      trimEndMs: Number.POSITIVE_INFINITY,
      gainDb: Number.NaN,
    }));
    expect(state.trimmed).toBe(false);
    expect(state.gained).toBe(false);
    expect(state.untouched).toBe(true);
  });

  it('carries the recorded loop mode through', () => {
    expect(describeSoundTuning(soundMod({ ...baseSwap, loop: 'on' })).loop).toBe('on');
    expect(describeSoundTuning(soundMod({ ...baseSwap, loop: 'off' })).loop).toBe('off');
  });

  it('is not retunable without a recorded audio path or any target', () => {
    const noAudio = describeSoundTuning(soundMod({
      ...baseSwap,
      reforge: { heroName: 'Gigawatt', audioPath: '', assignments: [{ clipPath: 'a.vsnd', audioPath: 'x' }] },
    }));
    expect(noAudio.retunable).toBe(false);

    const noTargets = describeSoundTuning(soundMod({
      ...baseSwap,
      reforge: { heroName: 'Gigawatt', audioPath: 'C:/audio/zap.mp3', assignments: [] },
    }));
    expect(noTargets.retunable).toBe(false);
  });

  it('accepts legacy clipPaths as retune targets when assignments are empty', () => {
    const state = describeSoundTuning(soundMod({
      ...baseSwap,
      reforge: {
        heroName: 'Gigawatt',
        audioPath: 'C:/audio/zap.mp3',
        assignments: [],
        clipPaths: ['sounds/x.vsnd'],
      },
    }));
    expect(state.retunable).toBe(true);
  });
});

describe('formatTrimWindow / formatGain', () => {
  it('formats both ends, one end, or neither', () => {
    expect(formatTrimWindow(describeSoundTuning(withReforge({ trimStartMs: 250, trimEndMs: 1800 }))))
      .toBe('0.25s to 1.80s');
    expect(formatTrimWindow(describeSoundTuning(withReforge({ trimStartMs: 250 }))))
      .toBe('from 0.25s');
    expect(formatTrimWindow(describeSoundTuning(withReforge({ trimEndMs: 1800 }))))
      .toBe('to 1.80s');
    expect(formatTrimWindow(describeSoundTuning(withReforge({})))).toBeNull();
  });

  it('signs the gain and keeps one decimal', () => {
    expect(formatGain(describeSoundTuning(withReforge({ gainDb: 3 })))).toBe('+3.0 dB');
    expect(formatGain(describeSoundTuning(withReforge({ gainDb: -2.45 })))).toBe('-2.5 dB');
    expect(formatGain(describeSoundTuning(withReforge({ gainDb: 0 })))).toBeNull();
  });
});

describe('soundTuningBadges', () => {
  it('badges trim, gain, and a non-default loop in reading order', () => {
    const mod = soundMod({
      ...baseSwap,
      loop: 'on',
      reforge: {
        heroName: 'Gigawatt',
        audioPath: 'C:/audio/zap.mp3',
        assignments: [{ clipPath: 'sounds/x.vsnd', audioPath: 'C:/audio/zap.mp3' }],
        trimStartMs: 250,
        trimEndMs: 1800,
        gainDb: -2,
      },
    });
    expect(soundTuningBadges(describeSoundTuning(mod))).toEqual([
      { kind: 'trim', value: '0.25s to 1.80s' },
      { kind: 'gain', value: '-2.0 dB' },
      { kind: 'loop', value: 'on' },
    ]);
  });

  it('says nothing about loop: auto, which is the default', () => {
    const badges = soundTuningBadges(describeSoundTuning(withReforge({ gainDb: 6 })));
    expect(badges).toEqual([{ kind: 'gain', value: '+6.0 dB' }]);
  });

  it('states explicitly that a recorded change was not tuned', () => {
    expect(soundTuningBadges(describeSoundTuning(withReforge({})))).toEqual([{ kind: 'untouched' }]);
  });

  it('marks a legacy swap as legacy rather than as untouched', () => {
    expect(soundTuningBadges(describeSoundTuning(soundMod({ ...baseSwap })))).toEqual([
      { kind: 'legacy' },
    ]);
  });
});
