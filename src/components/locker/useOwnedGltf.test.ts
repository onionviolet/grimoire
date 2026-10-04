// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
