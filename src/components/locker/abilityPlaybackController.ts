import * as THREE from 'three';

export type AbilityPlaybackStatus = 'loading' | 'paused' | 'playing' | 'finished' | 'disposed';
export interface AbilityPlaybackSnapshot {
  status: AbilityPlaybackStatus;
  position: number;
  duration: number;
  speed: number;
}

interface AbilityPlaybackOptions {
  scene: THREE.Object3D;
  clip: THREE.AnimationClip;
  soundUrl?: string | null;
  pitch?: number;
  volumeDb?: number;
  onChange?: (snapshot: AbilityPlaybackSnapshot) => void;
  createAudioContext?: () => AudioContext;
  fetchAudio?: (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;
  now?: () => number;
}

const positive = (value: number | undefined, fallback = 1) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

/** Animation and decoded audio use the same absolute clock. Sound pitch is
 * applied in source-buffer time, independently of the cast playback speed. */
export class AbilityPlaybackController {
  private readonly mixer: THREE.AnimationMixer;
  private readonly action: THREE.AnimationAction;
  private readonly abort = new AbortController();
  private readonly pitch: number;
  private readonly fallbackClock: () => number;
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private preparation: Promise<void> | null = null;
  private revision = 0;
  private originTime = 0;
  private originPosition = 0;
  private lastNotification = -Infinity;
  private snapshot: AbilityPlaybackSnapshot;
  private readonly options: AbilityPlaybackOptions;

  constructor(options: AbilityPlaybackOptions) {
    this.options = options;
    this.pitch = positive(options.pitch);
    this.fallbackClock = options.now ?? (() => performance.now() / 1000);
    this.mixer = new THREE.AnimationMixer(options.scene);
    this.action = this.mixer.clipAction(options.clip);
    this.action.setLoop(THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
    this.snapshot = { status: 'loading', position: 0, duration: Math.max(0, options.clip.duration), speed: 1 };
    this.sample(0);
  }

  getSnapshot(): AbilityPlaybackSnapshot { return this.snapshot; }

  prepare(): Promise<void> {
    this.preparation ??= this.prepareAssets();
    return this.preparation;
  }

  private async prepareAssets(): Promise<void> {
    if (this.options.soundUrl) {
      this.context = (this.options.createAudioContext ?? (() => new AudioContext()))();
      this.gain = this.context.createGain();
      this.gain.gain.value = Math.pow(10, (this.options.volumeDb ?? 0) / 20);
      this.gain.connect(this.context.destination);
      const bytes = await (this.options.fetchAudio ?? (async (url, signal) => {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response.arrayBuffer();
      }))(this.options.soundUrl, this.abort.signal);
      if (this.disposed) return;
      this.buffer = await this.context.decodeAudioData(bytes);
      if (this.disposed) return;
      this.snapshot = { ...this.snapshot, duration: Math.max(this.snapshot.duration, this.buffer.duration / this.pitch) };
    }
    if (!this.disposed) {
      this.snapshot = { ...this.snapshot, status: 'paused' };
      this.publish();
    }
  }

  async play(): Promise<void> {
    const revision = ++this.revision;
    await this.prepare();
    if (this.disposed || revision !== this.revision || this.snapshot.status === 'playing') return;
    if (this.context && this.context.state !== 'running') {
      await this.context.resume();
      if (!this.audioRunning()) throw new Error('Audio context is suspended');
    }
    if (this.disposed || revision !== this.revision) return;
    const position = this.snapshot.status === 'finished' ? 0 : this.snapshot.position;
    this.originTime = this.clock();
    this.originPosition = position;
    this.snapshot = { ...this.snapshot, status: 'playing', position };
    this.sample(position);
    this.startSound(position);
    this.publish();
  }

  pause(): void {
    ++this.revision;
    if (this.disposed || this.snapshot.status === 'loading') return;
    const position = this.positionNow();
    this.stopSound();
    this.snapshot = { ...this.snapshot, position, status: position >= this.snapshot.duration ? 'finished' : 'paused' };
    this.sample(position);
    this.publish();
  }

  seek(position: number): void {
    if (this.disposed || this.snapshot.status === 'loading') return;
    const target = Math.min(this.snapshot.duration, Math.max(0, Number.isFinite(position) ? position : 0));
    const wasPlaying = this.snapshot.status === 'playing';
    this.stopSound();
    this.originTime = this.clock();
    this.originPosition = target;
    this.snapshot = { ...this.snapshot, position: target, status: target >= this.snapshot.duration ? 'finished' : wasPlaying ? 'playing' : 'paused' };
    this.sample(target);
    if (this.snapshot.status === 'playing') this.startSound(target);
    this.publish();
  }

  async replay(): Promise<void> {
    this.pause();
    this.seek(0);
    await this.play();
  }

  stop(): void {
    this.pause();
    this.seek(0);
  }

  setSpeed(speed: number): void {
    if (this.disposed || !Number.isFinite(speed) || speed <= 0) return;
    const position = this.positionNow();
    this.stopSound();
    this.originTime = this.clock();
    this.originPosition = position;
    this.snapshot = { ...this.snapshot, position, speed };
    this.sample(position);
    if (this.snapshot.status === 'playing') this.startSound(position);
    this.publish();
  }

  /** Called each rendered frame; a stall advances both tracks by elapsed
   * clock time instead of slowing only the animation with a capped delta. */
  update(): void {
    if (this.snapshot.status !== 'playing') return;
    const position = this.positionNow();
    this.snapshot = { ...this.snapshot, position };
    this.sample(position);
    if (position >= this.snapshot.duration) {
      this.stopSound();
      this.snapshot = { ...this.snapshot, status: 'finished' };
      this.publish();
    } else if (this.clock() - this.lastNotification >= 0.05) this.publish();
  }

  dispose(): void {
    if (this.disposed) return;
    ++this.revision;
    this.abort.abort();
    this.stopSound();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => { /* Already closed. */ });
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.options.scene);
    this.snapshot = { ...this.snapshot, status: 'disposed' };
  }

  private get disposed(): boolean { return this.snapshot.status === 'disposed'; }
  private audioRunning(): boolean { return this.context?.state === 'running'; }
  private clock(): number { return this.context?.currentTime ?? this.fallbackClock(); }
  private positionNow(): number {
    return this.snapshot.status === 'playing'
      ? Math.min(this.snapshot.duration, this.originPosition + Math.max(0, this.clock() - this.originTime) * this.snapshot.speed)
      : this.snapshot.position;
  }

  private sample(position: number): void {
    // LoopOnce pauses the action at its endpoint. Enable it before explicit
    // sampling so seeking backwards and replay also work after completion.
    this.action.enabled = true;
    this.action.paused = false;
    this.mixer.setTime(Math.min(position, this.options.clip.duration));
  }

  private startSound(position: number): void {
    if (!this.context || !this.buffer || !this.gain) return;
    const offset = position * this.pitch;
    if (offset >= this.buffer.duration) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.snapshot.speed * this.pitch;
    source.connect(this.gain);
    this.source = source;
    source.onended = () => {
      source.disconnect();
      if (this.source === source) this.source = null;
    };
    source.start(this.originTime, offset);
    source.stop(this.originTime + (this.snapshot.duration - position) / this.snapshot.speed);
  }

  private stopSound(): void {
    const source = this.source;
    if (!source) return;
    this.source = null;
    source.onended = null;
    source.stop();
    source.disconnect();
  }

  private publish(): void {
    this.lastNotification = this.clock();
    this.options.onChange?.(this.snapshot);
  }
}
