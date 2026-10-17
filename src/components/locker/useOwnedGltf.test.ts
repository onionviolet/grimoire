// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
const h = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../lib/loadGltfPreview', () => ({ loadGltfPreview: h.load }));
import { disposePreviewModel, useOwnedGltf } from './useOwnedGltf';

describe('owned preview resources', () => {
  it('disposes a pending load that finishes after its preview closed', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let resolve: ((gltf: GLTF) => void) | undefined;
    const load = vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation((_url, onLoad) => { resolve = onLoad; });
    function Preview() { useOwnedGltf('fixture.glb'); return null; }
    const host = document.createElement('div'), root = createRoot(host);
    const geometry = new THREE.BoxGeometry(), scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    const dispose = vi.spyOn(geometry, 'dispose');
    try {
      act(() => root.render(createElement(Preview)));
      act(() => root.unmount());
      resolve!({ scenes: [scene], scene } as unknown as GLTF);
      expect(dispose).toHaveBeenCalledOnce();
    } finally { load.mockRestore(); }
  });
  it('releases shared geometry, materials and textures exactly once across scenes', () => {
    const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const a = new THREE.Group(), b = new THREE.Group();
    a.add(new THREE.Mesh(geometry, material)); b.add(new THREE.Mesh(geometry, material));
    const geometryDispose = vi.spyOn(geometry, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose'), materialDispose = vi.spyOn(material, 'dispose');
    disposePreviewModel({ scenes: [a, b] } as unknown as GLTF);
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(textureDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce();
  });
});


describe('owned Source 2 preview resources', () => {
  it('disposes original material ownership once even after a child swaps preview wrappers', async () => {
    h.load.mockReset();
    const texture = new THREE.Texture(), morphicTexture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    material.userData = { morphic: { resolvedTextures: { g_tDetail: texture, g_tTintMask: morphicTexture } } };
    const wrapper = new THREE.MeshStandardMaterial({ map: texture });
    const scene = new THREE.Group(), mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const gltf = { scenes: [scene], scene } as unknown as GLTF;
    h.load.mockResolvedValue(gltf);
    const baseDispose = vi.spyOn(material, 'dispose'), wrapperDispose = vi.spyOn(wrapper, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose'), morphicDispose = vi.spyOn(morphicTexture, 'dispose');
    function PreviewMaterial() {
      useEffect(() => {
        mesh.material = wrapper;
        return () => { mesh.material = material; wrapper.dispose(); };
      }, []);
      return null;
    }
    function Preview() {
      const loaded = useOwnedGltf('source2.glb', { source2: true });
      return loaded ? createElement(PreviewMaterial) : null;
    }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Preview)));
    expect(h.load).toHaveBeenCalledWith('source2.glb');
    expect(mesh.material).toBe(wrapper);
    await act(async () => root.unmount());
    expect(baseDispose).toHaveBeenCalledOnce();
    expect(wrapperDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(morphicDispose).toHaveBeenCalledOnce();
  });

  it('disposes morphic-only textures when an enriched pending load finishes after closing', async () => {
    h.load.mockReset();
    let finish!: (gltf: GLTF) => void;
    h.load.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const scene = new THREE.Group(), texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial();
    material.userData = { morphic: { resolvedTextures: { g_tSelfIllumMask: texture, g_tDetail: texture } } };
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const dispose = vi.spyOn(texture, 'dispose');
    function Preview() { useOwnedGltf('late-source2.glb', { source2: true }); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Preview)));
    await act(async () => root.unmount());
    await act(async () => finish({ scenes: [scene], scene } as unknown as GLTF));
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('does not reuse a disposed model when returning to the same source during another pending load', async () => {
    h.load.mockReset();
    const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    const gltf = { scenes: [scene], scene } as unknown as GLTF;
    h.load.mockResolvedValueOnce(gltf).mockImplementation(() => new Promise(() => {}));
    const dispose = vi.spyOn(geometry, 'dispose');
    const seen: Array<GLTF | null> = [];
    function Preview({ url }: { url: string }) {
      seen.push(useOwnedGltf(url, { source2: true }));
      return null;
    }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Preview, { url: 'a.glb' })));
    expect(seen.at(-1)).toBe(gltf);
    await act(async () => root.render(createElement(Preview, { url: 'b.glb' })));
    expect(dispose).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(Preview, { url: 'a.glb' })));
    expect(seen.at(-1)).toBeNull();
    await act(async () => root.unmount());
  });
});
