import { useEffect, useMemo, useState } from 'react';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { loadGltfPreview } from '../../lib/loadGltfPreview';
import { getMorphic } from '../../lib/source2NprMaterial';

type Disposable = { dispose: () => void };

/** Capture original resources before shared preview passes replace materials.
 * Their owned shader wrappers dispose separately when those passes unmount. */
function previewModelDisposer(gltf: GLTF): () => void {
  const resources = new Set<Disposable>();
  const collect = (resource: Disposable | undefined) => {
    if (resource) resources.add(resource);
  };
  for (const scene of gltf.scenes) scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    collect(mesh.geometry);
    collect((object as THREE.SkinnedMesh).skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) collect(value);
      for (const texture of Object.values(getMorphic(material)?.resolvedTextures ?? {})) collect(texture);
      collect(material);
    }
  });
  return () => {
    resources.forEach(resource => resource.dispose());
    resources.clear();
  };
}

/** Each preview owns its load. No global Suspense cache retains closed models. */
export function disposePreviewModel(gltf: GLTF): void {
  previewModelDisposer(gltf)();
}

export function useOwnedGltf(
  url: string,
  { source2 = false }: { source2?: boolean } = {}
): GLTF | null {
  const request = useMemo(() => ({ url, source2 }), [url, source2]);
  const [result, setResult] = useState<{ request: typeof request; gltf?: GLTF; error?: Error } | null>(null);
  useEffect(() => {
    let active = true;
    let disposeLoaded: (() => void) | undefined;
    const onLoad = (gltf: GLTF) => {
      if (!active) { disposePreviewModel(gltf); return; }
      disposeLoaded = previewModelDisposer(gltf);
      setResult({ request, gltf });
    };
    const onError = (error: unknown) => {
      if (active) setResult({ request, error: error instanceof Error ? error : new Error(String(error)) });
    };
    if (request.source2) void loadGltfPreview(request.url).then(onLoad, onError);
    else new GLTFLoader().load(request.url, onLoad, undefined, onError);
    return () => { active = false; disposeLoaded?.(); };
  }, [request]);
  if (result?.request === request && result.error) throw result.error;
  return result?.request === request ? result.gltf ?? null : null;
}
