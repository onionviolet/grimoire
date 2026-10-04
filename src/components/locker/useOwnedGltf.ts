import { useEffect, useState } from 'react';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

/** Each preview owns its load. No global Suspense cache retains closed models. */
export function disposePreviewModel(gltf: GLTF): void {
  const disposed = new Set<unknown>();
  const dispose = (resource: { dispose: () => void } | undefined) => {
    if (!resource || disposed.has(resource)) return;
    disposed.add(resource); resource.dispose();
  };
  for (const scene of gltf.scenes) scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    dispose(mesh.geometry);
    dispose((object as THREE.SkinnedMesh).skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) dispose(value);
      dispose(material);
    }
  });
}

export function useOwnedGltf(url: string): GLTF | null {
  const [result, setResult] = useState<{ url: string; gltf?: GLTF; error?: Error } | null>(null);
  useEffect(() => {
    let active = true;
    let loaded: GLTF | undefined;
    new GLTFLoader().load(url, gltf => {
      if (!active) { disposePreviewModel(gltf); return; }
      loaded = gltf; setResult({ url, gltf });
    }, undefined, error => {
      if (active) setResult({ url, error: error instanceof Error ? error : new Error(String(error)) });
    });
    return () => { active = false; if (loaded) disposePreviewModel(loaded); };
  }, [url]);
  if (result?.url === url && result.error) throw result.error;
  return result?.url === url ? result.gltf ?? null : null;
}
