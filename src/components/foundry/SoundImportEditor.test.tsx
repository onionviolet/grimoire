// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundImportEditor, type SoundImportEdits } from './SoundImportEditor';
import { seedTrimWindow, type SoundImportSeed } from './soundTuning';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Drives `SoundImportEditor` through a real decode against a fake Web Audio
 * stack, then asserts it opens on the exact window `seedTrimWindow` produces
 * for the same seed and decoded duration, at every `fit` outcome the fitter
 * can return. Every expected millisecond value below is computed by calling
 * `seedTrimWindow` in the test, never hand-typed, so this cannot drift from
 * the function it exercises.
 */

/** A short, non-silent `AudioBuffer` stand-in. Real sample values matter: the
 *  waveform's peak reducer and the normalizer's RMS reducer both walk
 *  `getChannelData`, so an all-zero array would silently prove nothing about
 *  either. */
function fakeAudioBuffer(durationMs: number, sampleRate = 44100): AudioBuffer {
  const duration = durationMs / 1000;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) channel[i] = Math.sin(i / 40) * 0.6;
  return {
    duration,
    length,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer;
}

/** A minimal 2D context carrying only the methods and settable property the
 *  waveform draw block calls (`SoundImportEditor.tsx`: scale, clearRect,
 *  fillRect, fillStyle). jsdom returns null from `getContext('2d')` without
 *  the native `canvas` package, which is deliberately not installed; without
 *  this stub the draw effect takes its own early `if (!g) return` and the
 *  drawing code never runs. */
function fakeCanvasContext() {
  return {
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

/** Installs a fake `window.AudioContext` whose `decodeAudioData` resolves the
 *  given buffer, and whose `createBufferSource`/`createGain` expose the
 *  connect/start/stop shape the preview path uses. jsdom ships no Web Audio
 *  stack at all, so `window.AudioContext` is undefined without this. */
function installFakeAudioContext(buffer: AudioBuffer) {
  const decodeAudioData = vi.fn().mockResolvedValue(buffer);
  const createBufferSource = vi.fn(() => ({
    buffer: null as AudioBuffer | null,
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }));
  const createGain = vi.fn(() => ({
    gain: { value: 0 },
    connect: vi.fn().mockReturnThis(),
  }));
  const close = vi.fn().mockResolvedValue(undefined);
  const resume = vi.fn().mockResolvedValue(undefined);

  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    decodeAudioData = decodeAudioData;
    createBufferSource = createBufferSource;
    createGain = createGain;
    close = close;
    resume = resume;
  }

  (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    FakeAudioContext as unknown as typeof AudioContext;

  return { decodeAudioData, createBufferSource, createGain, close };
}

function makeFile(name = 'clip.mp3'): File {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const file = new File([bytes], name, { type: 'audio/mpeg' });
  // The decode effect calls `file.arrayBuffer()`. jsdom's File may not
  // implement it; attach a real one rather than changing the component.
  if (typeof file.arrayBuffer !== 'function') {
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () =>
      Promise.resolve(bytes.buffer);
  }
  return file;
}

/** Flushes the decode effect's async chain (`file.arrayBuffer()` then
 *  `decodeAudioData()`) so React commits the resulting state before
 *  assertions run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SoundImportEditor seeded trim window', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn<(edits: SoundImportEdits) => void>>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onChange = vi.fn<(edits: SoundImportEdits) => void>();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCanvasContext());
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderEditor = async (buffer: AudioBuffer, initialEdits?: SoundImportSeed) => {
    installFakeAudioContext(buffer);
    const file = makeFile();
    await act(async () => {
      root.render(<SoundImportEditor file={file} onChange={onChange} initialEdits={initialEdits} />);
    });
    await act(async () => {
      await flush();
    });
  };

  const trimStartSlider = () =>
    document.querySelector<HTMLElement>('[role="slider"][aria-label="Trim start"]');
  const trimEndSlider = () =>
    document.querySelector<HTMLElement>('[role="slider"][aria-label="Trim end"]');

  const lastOnChangeCall = (): SoundImportEdits => {
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1]![0];
  };

  it('fit: none — opens on the whole clip at unity gain when nothing was seeded', async () => {
    const buffer = fakeAudioBuffer(2500);
    await renderEditor(buffer, undefined);

    const fitted = seedTrimWindow(undefined, buffer.duration * 1000);
    expect(fitted.fit).toBe('none');

    expect(trimStartSlider()?.getAttribute('aria-valuenow')).toBe(
      String(Math.round(fitted.startMs))
    );
    expect(trimEndSlider()?.getAttribute('aria-valuenow')).toBe(String(Math.round(fitted.endMs)));
    expect(lastOnChangeCall()).toEqual({
      trimStartMs: undefined,
      trimEndMs: undefined,
      gainDb: undefined,
    });
    // No seed was passed at all, so the "what the seed did" block never renders.
    expect(document.body.textContent).not.toContain('Opened on the recorded trim');
    expect(document.body.textContent).not.toContain('was pulled in to fit');
    expect(document.body.textContent).not.toContain('does not fit this clip');
  });

  it('fit: exact — opens exactly on a seed that fits inside the decoded clip', async () => {
    const buffer = fakeAudioBuffer(2500);
    const seed: SoundImportSeed = { trimStartMs: 300, trimEndMs: 1200, gainDb: -2.5, loop: 'on' };
    await renderEditor(buffer, seed);

    const fitted = seedTrimWindow(seed, buffer.duration * 1000);
    expect(fitted.fit).toBe('exact');

    expect(trimStartSlider()?.getAttribute('aria-valuenow')).toBe(
      String(Math.round(fitted.startMs))
    );
    expect(trimEndSlider()?.getAttribute('aria-valuenow')).toBe(String(Math.round(fitted.endMs)));
    expect(lastOnChangeCall()).toEqual({
      trimStartMs: fitted.startMs,
      trimEndMs: fitted.endMs,
      gainDb: fitted.gainDb,
    });
    expect(document.body.textContent).toContain('Opened on the recorded trim and loudness.');
    expect(document.body.textContent).toContain('The rebuild keeps looping on.');
  });

  it('fit: clamped — pulls a seed whose end runs past the decoded clip back to the clip', async () => {
    const buffer = fakeAudioBuffer(2500);
    const seed: SoundImportSeed = { trimStartMs: 300, trimEndMs: 5000, gainDb: 3, loop: 'off' };
    await renderEditor(buffer, seed);

    const fitted = seedTrimWindow(seed, buffer.duration * 1000);
    expect(fitted.fit).toBe('clamped');

    expect(trimStartSlider()?.getAttribute('aria-valuenow')).toBe(
      String(Math.round(fitted.startMs))
    );
    expect(trimEndSlider()?.getAttribute('aria-valuenow')).toBe(String(Math.round(fitted.endMs)));
    expect(lastOnChangeCall()).toEqual({
      trimStartMs: fitted.startMs,
      trimEndMs: fitted.endMs,
      gainDb: fitted.gainDb,
    });
    expect(document.body.textContent).toContain(
      'The recorded trim window ran past the end of this clip, so it was pulled in to fit.'
    );
    expect(document.body.textContent).toContain('The rebuild keeps looping off.');
  });

  it('fit: dropped — opens on the whole clip when the seed is narrower than the minimum window', async () => {
    const buffer = fakeAudioBuffer(2500);
    // 2500 - 2480 = 20ms wide, under MIN_WINDOW_MS (50ms): drops, not clamps.
    const seed: SoundImportSeed = { trimStartMs: 2480, trimEndMs: 5000, gainDb: 1 };
    await renderEditor(buffer, seed);

    const fitted = seedTrimWindow(seed, buffer.duration * 1000);
    expect(fitted.fit).toBe('dropped');

    expect(trimStartSlider()?.getAttribute('aria-valuenow')).toBe(
      String(Math.round(fitted.startMs))
    );
    expect(trimEndSlider()?.getAttribute('aria-valuenow')).toBe(String(Math.round(fitted.endMs)));
    expect(lastOnChangeCall()).toEqual({
      trimStartMs: undefined,
      trimEndMs: undefined,
      gainDb: fitted.gainDb,
    });
    expect(document.body.textContent).toContain(
      'The recorded trim window does not fit this clip, so the whole clip is selected. Set a new window with the handles.'
    );
  });
});
