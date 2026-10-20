import * as THREE from 'three';
import { getMorphic } from '../../lib/source2NprMaterial';
import { prepareSource2VertexColors } from '../../lib/source2VertexColors';

// Shared stage settings keep idle and ability previews under the same camera,
// light probe, tone mapping, and authored Source 2 material passes.
export const HERO_PREVIEW_CAMERA = { position: [0, 0, 3.2] as [number, number, number], fov: 40 };
export const HERO_PREVIEW_GL = {
  alpha: true,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 0.8,
};

export interface HeroPreviewNormalization {
  scale: number;
  center: THREE.Vector3;
  /** Rest-pose bounds in the scene's own frame, for camera fitting. */
  bounds: THREE.Box3;
}

const normalizedScenes = new WeakMap<THREE.Object3D, HeroPreviewNormalization>();

/** The normalization recorded for a scene by `normalizeHeroPreview`, if any. */
export function getHeroPreviewNormalization(scene: THREE.Object3D): HeroPreviewNormalization | undefined {
  return normalizedScenes.get(scene);
}

/** Compute once per loaded scene. Wrapper groups consume the returned scale and
 *  center, leaving the skeleton and animation root relationships intact. The
 *  result is cached per scene so the figure does not breathe or drift as a clip
 *  plays and the camera fit sees the same rest bounds. */
export function normalizeHeroPreview(
  scene: THREE.Object3D,
  { bindPose = false }: { bindPose?: boolean } = {}
): HeroPreviewNormalization {
  const cached = normalizedScenes.get(scene);
  if (cached) return cached;
  if (bindPose) {
    scene.traverse((obj) => {
      const skinned = obj as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh && skinned.skeleton) skinned.skeleton.pose();
    });
    scene.updateWorldMatrix(true, true);
  }
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 2.0 / maxDim : 1;
  const result = { scale, center, bounds: box.clone().applyMatrix4(scene.matrixWorld.clone().invert()) };
  normalizedScenes.set(scene, result);
  return result;
}

/** Enable per-vertex COLOR multiply wherever the attribute exists. Pure
 *  read/write of an existing material flag, so material identity is untouched
 *  (the NPR CustomShaderMaterial wrap still finds the same instances). */
export function enableHeroPreviewVertexColors(scene: THREE.Object3D): void {
  prepareSource2VertexColors(scene);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.color) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      if (sm && !getMorphic(sm) && !sm.vertexColors) {
        sm.vertexColors = true;
        sm.needsUpdate = true;
      }
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

