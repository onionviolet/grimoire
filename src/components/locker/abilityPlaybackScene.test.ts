import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AbilityPlaybackScene } from './AbilityPreview';
import type { AbilityPlaybackController } from './abilityPlaybackController';
import type { HeroAbilityPlayback } from '../../types/abilityPreview';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function preview() {
  const scene = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
  scene.add(body);
  const clip = new THREE.AnimationClip('cast', 4, [new THREE.NumberKeyframeTrack('.position[x]', [0, 4], [0, 4])]);
  const gltf: GLTF = { scene, scenes: [scene], animations: [clip], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} };
  const playback: HeroAbilityPlayback = {
    ability: { slot: 1, label: 'Cast', token: 'cast', clip: 'cast', soundPath: null, particlePath: null },
    modelUrl: 'grimoire-hero://model/cast.glb', soundUrl: null, soundSource: 'unavailable',
    skinApplied: false, skinFallback: false, effect: null, recolor: null,
  };
  return { scene, body, gltf, playback };
}

describe('loaded ability scene integration', () => {
  it('drives the loaded model through pause, replay and completion while retaining its normalized stage', async () => {
    const f = preview();
    let controller!: AbilityPlaybackController;
    let elapsed = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed * 1000);
    const failure = vi.fn();
    const snapshots = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(React.createElement(AbilityPlaybackScene, {
      ...f, onController: value => { controller = value; }, onSnapshot: snapshots, onFailure: failure,
    }));
    const modelParent = f.scene.parent;
    expect(controller.getSnapshot().status).toBe('playing');
    elapsed = 1.5; await renderer.advanceFrames(1, 1.5);
    expect(f.scene.position.x).toBeCloseTo(1.5);
    controller.pause();
    elapsed = 3; await renderer.advanceFrames(1, 1.5);
    expect(f.scene.position.x).toBeCloseTo(1.5);
    controller.seek(0.25);
    expect(f.scene.position.x).toBeCloseTo(0.25);
    await controller.replay();
    expect(f.scene.position.x).toBe(0);
    elapsed = 8; await renderer.advanceFrames(1, 5);
    expect(controller.getSnapshot().status).toBe('finished');
    expect(f.scene.position.x).toBe(4);
    expect(f.scene.parent).toBe(modelParent);
    expect(snapshots).toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    await renderer.unmount();
    expect(controller.getSnapshot().status).toBe('disposed');
    vi.restoreAllMocks();
  });

  it('waits for a real model plus audio decode and stops its sound when the scene unmounts', async () => {
    const f = preview();
    f.playback.soundUrl = 'grimoire-hero://sound/cast.wav';
    let decode!: (value: AudioBuffer) => void;
    const source = { playbackRate: { value: 1 }, buffer: null, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    const context = {
      currentTime: 0, state: 'running', destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      createBufferSource: () => source,
      decodeAudioData: () => new Promise<AudioBuffer>(resolve => { decode = resolve; }),
      close: vi.fn(async () => {}),
    };
    vi.stubGlobal('AudioContext', class { constructor() { return context; } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
    let controller!: AbilityPlaybackController;
    const failure = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(React.createElement(AbilityPlaybackScene, {
      ...f, onController: value => { controller = value; }, onSnapshot: vi.fn(), onFailure: failure,
    }));
    expect(controller.getSnapshot().status).toBe('loading');
    context.currentTime = 2; await renderer.advanceFrames(1, 2);
    expect(f.scene.position.x).toBe(0);
    expect(source.start).not.toHaveBeenCalled();
    await ReactThreeTestRenderer.act(async () => { decode({ duration: 4 } as AudioBuffer); });
    expect(source.start).toHaveBeenCalledWith(2, 0);
    context.currentTime = 3; await renderer.advanceFrames(1, 1);
    expect(f.scene.position.x).toBe(1);
    await renderer.unmount();
    expect(source.stop).toHaveBeenLastCalledWith();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(failure).not.toHaveBeenCalled();
  });

  it('reports a missing selected clip before creating a playback controller', async () => {
    const f = preview(); f.playback.ability.clip = 'missing';
    const ready = vi.fn(); const failure = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(React.createElement(AbilityPlaybackScene, {
      ...f, onController: ready, onSnapshot: vi.fn(), onFailure: failure,
    }));
    expect(failure).toHaveBeenCalledWith('missingClip');
    expect(ready).not.toHaveBeenCalled();
    await renderer.unmount();
  });

  it('reports sound decode failure and releases its context without starting the model', async () => {
    const f = preview(); f.playback.soundUrl = 'data:audio/mpeg;base64,AA==';
    const context = {
      currentTime: 0, state: 'suspended', destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      createBufferSource: vi.fn(),
      decodeAudioData: vi.fn(async () => { throw new Error('Unsupported audio'); }),
      close: vi.fn(async () => {}),
    };
    vi.stubGlobal('AudioContext', class { constructor() { return context; } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
    const failure = vi.fn();
    let controller!: AbilityPlaybackController;
    const renderer = await ReactThreeTestRenderer.create(React.createElement(AbilityPlaybackScene, {
      ...f, onController: value => { controller = value; }, onSnapshot: vi.fn(), onFailure: failure,
    }));
    expect(failure).toHaveBeenCalledWith('audioFailed');
    expect(controller.getSnapshot().status).toBe('disposed');
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(f.scene.position.x).toBe(0);
    await renderer.unmount();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
