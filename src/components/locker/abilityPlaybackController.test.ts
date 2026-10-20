import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AbilityPlaybackController } from './abilityPlaybackController';

class FakeSource {
  buffer: AudioBuffer | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'suspended';
  destination = {};
  sources: FakeSource[] = [];
  gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  decodeAudioData = vi.fn(async () => ({ duration: 8 }) as AudioBuffer);
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createGain = vi.fn(() => this.gain);
  createBufferSource = vi.fn(() => {
    const source = new FakeSource(); this.sources.push(source); return source;
  });
}

function fixture(overrides: { sound?: boolean; pitch?: number; fetchAudio?: (url: string, signal: AbortSignal) => Promise<ArrayBuffer> } = {}) {
  const scene = new THREE.Object3D();
  const clip = new THREE.AnimationClip('cast', 4, [new THREE.NumberKeyframeTrack('.position[x]', [0, 4], [0, 40])]);
  const context = new FakeAudioContext();
  let elapsed = 0;
  const change = vi.fn();
  const controller = new AbilityPlaybackController({
    scene, clip, soundUrl: overrides.sound === false ? null : 'grimoire-hero://audio/cast.wav',
    pitch: overrides.pitch, volumeDb: -6, onChange: change,
    createAudioContext: () => context as unknown as AudioContext,
    fetchAudio: overrides.fetchAudio ?? (async () => new ArrayBuffer(2)), now: () => elapsed,
  });
  return { controller, scene, context, change, advance: (seconds: number) => { elapsed += seconds; context.currentTime += seconds; } };
}

describe('ability playback with a real Three.AnimationMixer', () => {
  it('waits for decoded sound before starting either track', async () => {
    let decode!: (buffer: AudioBuffer) => void;
    const f = fixture();
    f.context.decodeAudioData.mockImplementation(() => new Promise(resolve => { decode = resolve; }));
    const play = f.controller.play();
    await Promise.resolve(); await Promise.resolve();
    f.advance(2); f.controller.update();
    expect(f.controller.getSnapshot().status).toBe('loading');
    expect(f.scene.position.x).toBe(0);
    expect(f.context.sources).toHaveLength(0);
    decode({ duration: 4 } as AudioBuffer);
    await play;
    expect(f.context.sources[0].start).toHaveBeenCalledWith(2, 0);
    expect(f.controller.getSnapshot().status).toBe('playing');
    f.advance(0.5); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(5);
    f.controller.dispose();
  });

  it('keeps pitch tuning separate from cast speed across pause, seek and resume', async () => {
    const f = fixture({ pitch: 2 });
    await f.controller.play();
    expect(f.context.gain.gain.value).toBeCloseTo(Math.pow(10, -6 / 20));
    expect(f.context.sources[0].playbackRate.value).toBe(2);
    f.advance(0.75); f.controller.update();
    f.controller.pause();
    expect(f.scene.position.x).toBeCloseTo(7.5);
    expect(f.context.sources[0].stop).toHaveBeenLastCalledWith();
    f.advance(2); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(7.5);
    f.controller.seek(1.25);
    expect(f.scene.position.x).toBeCloseTo(12.5);
    expect(f.context.sources).toHaveLength(1);
    f.controller.setSpeed(0.5);
    await f.controller.play();
    expect(f.context.sources[1].start).toHaveBeenCalledWith(2.75, 2.5);
    expect(f.context.sources[1].playbackRate.value).toBe(1);
    expect(f.context.sources[1].stop).toHaveBeenCalledWith(8.25);
    f.advance(1.5); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(20);
    expect(f.controller.getSnapshot().position).toBeCloseTo(2);
    f.controller.dispose();
  });

  it('reschedules playing seeks and speed changes without overlapping sources', async () => {
    const f = fixture(); await f.controller.play();
    f.advance(1); f.controller.setSpeed(2);
    expect(f.context.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(f.context.sources[1].start).toHaveBeenCalledWith(1, 1);
    expect(f.context.sources[1].playbackRate.value).toBe(2);
    f.advance(0.5); f.controller.seek(0.25);
    expect(f.context.sources[1].disconnect).toHaveBeenCalledTimes(1);
    expect(f.context.sources[2].start).toHaveBeenCalledWith(1.5, 0.25);
    expect(f.scene.position.x).toBeCloseTo(2.5);
    f.advance(0.5); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(12.5);
    f.controller.dispose();
  });

  it('uses elapsed clock time after a stalled frame and seeks backwards from a finished action', async () => {
    const f = fixture({ pitch: 2 }); await f.controller.play();
    f.advance(3); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(30);
    f.advance(2); f.controller.update();
    expect(f.controller.getSnapshot()).toMatchObject({ status: 'finished', position: 4, duration: 4 });
    expect(f.scene.position.x).toBeCloseTo(40);
    f.controller.seek(1);
    expect(f.scene.position.x).toBeCloseTo(10);
    expect(f.controller.getSnapshot().status).toBe('paused');
    await f.controller.replay();
    expect(f.scene.position.x).toBe(0);
    expect(f.context.sources).toHaveLength(2);
    expect(f.context.sources[1].start).toHaveBeenCalledWith(5, 0);
    f.controller.dispose();
    expect(f.context.sources[1].disconnect).toHaveBeenCalledTimes(1);
    expect(f.context.close).toHaveBeenCalledTimes(1);
  });

  it('lets an audio tail finish while clamping the model at its final cast pose', async () => {
    const f = fixture(); await f.controller.play();
    expect(f.controller.getSnapshot().duration).toBe(8);
    f.advance(5); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(40);
    expect(f.controller.getSnapshot()).toMatchObject({ status: 'playing', position: 5 });
    f.advance(3); f.controller.update();
    expect(f.controller.getSnapshot().status).toBe('finished');
    f.controller.dispose();
  });

  it('plays animation-only casts and resets stop without recreating the model', async () => {
    const f = fixture({ sound: false }); await f.controller.play();
    expect(f.context.createBufferSource).not.toHaveBeenCalled();
    f.advance(1.25); f.controller.update();
    expect(f.scene.position.x).toBeCloseTo(12.5);
    f.controller.stop();
    expect(f.controller.getSnapshot()).toMatchObject({ status: 'paused', position: 0 });
    expect(f.scene.position.x).toBe(0);
    f.controller.dispose();
  });

  it('does not play or publish after closing during asset decoding', async () => {
    let finish!: (bytes: ArrayBuffer) => void;
    const f = fixture({ fetchAudio: (_url, signal) => {
      expect(signal.aborted).toBe(false);
      return new Promise(resolve => { finish = resolve; });
    } });
    const pending = f.controller.play();
    f.controller.dispose();
    finish(new ArrayBuffer(1)); await pending;
    expect(f.context.decodeAudioData).not.toHaveBeenCalled();
    expect(f.context.sources).toHaveLength(0);
    expect(f.change).not.toHaveBeenCalled();
    expect(f.context.close).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().status).toBe('disposed');
  });

  it('cancels a pending resume when pause is requested', async () => {
    const f = fixture(); await f.controller.prepare();
    let resume!: () => void;
    f.context.resume.mockImplementation(() => new Promise(resolve => { resume = () => { f.context.state = 'running'; resolve(); }; }));
    const pending = f.controller.play(); await Promise.resolve();
    f.controller.pause(); resume(); await pending;
    expect(f.controller.getSnapshot().status).toBe('paused');
    expect(f.context.sources).toHaveLength(0);
    f.controller.dispose();
  });

  it('keeps a blocked audio start paused and permits an explicit resume retry', async () => {
    const f = fixture();
    f.context.resume.mockRejectedValueOnce(new Error('User activation required'));
    await expect(f.controller.play()).rejects.toThrow('User activation required');
    expect(f.controller.getSnapshot().status).toBe('paused');
    expect(f.context.sources).toHaveLength(0);
    await f.controller.play();
    expect(f.controller.getSnapshot().status).toBe('playing');
    expect(f.context.sources).toHaveLength(1);
    f.controller.dispose();
  });
});
