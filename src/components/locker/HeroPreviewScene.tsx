import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HDRCubeTextureLoader } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js';
import { getAssetPath } from '../../lib/assetPath';
import {
  isNprMaterial,
  isSelfIllumMaterial,
  wrapMaterialWithNpr,
  unwrapNprBase,
  applySource2MaterialHints,
  type NprWrapResult,
} from '../../lib/source2NprMaterial';
import { buildDeadlockMaterial, type DeadlockMaterialResult } from '../../lib/deadlockMaterial';
import { compileSource2DrawState, summarizeSource2Scene } from '../../lib/source2Preview';
import { BloomEffect, type BloomParams } from './BloomEffect';
import type { HeroPoseRenderFeatures } from './heroPoseRenderFeatures';
import { enableHeroPreviewVertexColors } from './heroPreviewSceneSetup';

// The existing warm key and cool fill, expressed as sRGB components so the
// THREE.Color conversion preserves the original lighting colors.
const KEY_LIGHT_COLOR = new THREE.Color(1, 243 / 255, 224 / 255).convertSRGBToLinear();
const FILL_LIGHT_COLOR = new THREE.Color(207 / 255, 224 / 255, 1).convertSRGBToLinear();
const DEFAULT_BLOOM_PARAMS: BloomParams = { intensity: 1, radius: 0.5, threshold: 0.85 };

// Six faces of a real Deadlock skybox IBL probe (the overcast probe: bright and
// neutral, not the moody dusk one), baked from the game's HDR cubemap to Radiance
// .hdr by `vpkmerge cubemap`. Order is the loader's expected [+X, -X, +Y, -Y, +Z,
// -Z]. Image-based lighting from this makes metallic and glossy surfaces read like
// in-game instead of dead-flat under bare directionals.
const IBL_FACES = [
  getAssetPath('/ibl/px.hdr'),
  getAssetPath('/ibl/nx.hdr'),
  getAssetPath('/ibl/py.hdr'),
  getAssetPath('/ibl/ny.hdr'),
  getAssetPath('/ibl/pz.hdr'),
  getAssetPath('/ibl/nz.hdr'),
];

export type HeroPreviewAppearanceFeatures = Pick<
  HeroPoseRenderFeatures,
  | 'source2ShaderHintsEnabled'
  | 'nprDebugEnabled'
  | 'source2SkipNpr'
  | 'nprMaterialsEnabled'
  | 'unifiedEnabled'
  | 'celV2Enabled'
>;

const DEFAULT_APPEARANCE_FEATURES: HeroPreviewAppearanceFeatures = {
  source2ShaderHintsEnabled: true,
  nprDebugEnabled: false,
  source2SkipNpr: true,
  nprMaterialsEnabled: true,
  unifiedEnabled: true,
  celV2Enabled: true,
};

/** Use inside a Canvas. Bloom remains optional so the main hero viewer keeps
 *  its existing postprocessing placement and live development controls. */
export function HeroPreviewLighting({
  bloom = false,
  bloomParams = DEFAULT_BLOOM_PARAMS,
}: { bloom?: boolean; bloomParams?: BloomParams }) {
  return (
    <>
      <Environment />
      <ambientLight intensity={0.12} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color={KEY_LIGHT_COLOR} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color={FILL_LIGHT_COLOR} />
      {bloom && <BloomEffect {...bloomParams} />}
    </>
  );
}

/** The same reversible draw state, shader hints, and unified NPR styling for
 *  static and animated scenes. Model playback and turntable remain caller-owned. */
export function HeroPreviewAppearance({
  scene,
  tint = null,
  features = DEFAULT_APPEARANCE_FEATURES,
}: {
  scene: THREE.Object3D;
  tint?: THREE.Color | null;
  features?: HeroPreviewAppearanceFeatures;
}) {
  useEffect(() => {
    enableHeroPreviewVertexColors(scene);
  }, [scene]);

  return (
    <>
      <Source2Appearance
        scene={scene}
        enabled={features.source2ShaderHintsEnabled}
        debug={features.nprDebugEnabled}
        skipNpr={features.source2SkipNpr}
      />
      {features.nprMaterialsEnabled && (
        <NprMaterials
          scene={scene}
          enabled={features.nprMaterialsEnabled}
          tint={tint}
          unified={features.unifiedEnabled}
          source2Active={features.source2ShaderHintsEnabled}
          celV2={features.celV2Enabled}
        />
      )}
    </>
  );
}

/** Image-based lighting from the baked Deadlock overcast probe. Loads the six .hdr
 *  faces once, runs them through PMREM, and assigns the result as
 *  `scene.environment` so every MeshStandardMaterial gets real reflections and
 *  ambient instead of dead-flat directional-only shading. The PMREM target is
 *  bound to this Canvas's GL context, so it is generated per-mount (the per-hero
 *  view shows a single viewer); SoulContainerViewer would want a shared probe.
 *  Drei Environment is not used here: the viewer needs HDRCubeTextureLoader's
 *  six-face Radiance cubemap path and HalfFloat PMREM for the Deadlock IBL. */
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    let disposed = false;
    const pmrem = new THREE.PMREMGenerator(gl);
    let envRT: THREE.WebGLRenderTarget | null = null;
    new HDRCubeTextureLoader()
      .setDataType(THREE.HalfFloatType)
      .load(IBL_FACES, (cube) => {
        if (disposed) {
          cube.dispose();
          pmrem.dispose();
          return;
        }
        envRT = pmrem.fromCubemap(cube);
        scene.environment = envRT.texture;
        cube.dispose();
        pmrem.dispose();
      });
    return () => {
      disposed = true;
      scene.environment = null;
      envRT?.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Wraps every NPR-eligible material in `scene` with a CSM that layers the
 *  Deadlock cel ramp + rim + tint mask on the lit PBR output. Side-effects the
 *  shared scene graph in place (like the model effects / TrippyPaint), so one
 *  instance serves both PosedModel and RiggedModel (both render the same scene).
 *  Restores originals and disposes its CSM wrappers + mask clones on cleanup.
 *  No-op when disabled or when no material carries morphic data. */
function NprMaterials({
  scene,
  enabled,
  tint,
  unified,
  source2Active,
  celV2,
}: {
  scene: THREE.Object3D;
  enabled: boolean;
  tint: THREE.Color | null;
  /** When true, build each material via the unified single pass
   *  (buildDeadlockMaterial) instead of the old applySource2MaterialHints +
   *  wrapMaterialWithNpr two-pass. */
  unified: boolean;
  /** Forces legacy wraps to rebuild after the mutating Source2 hint pass changes. */
  source2Active: boolean;
  celV2: boolean;
}) {
  // Live handle to the builds so the tint effect + uTime ticker can poke uniforms
  // without a rebuild. Both paths expose { material, uniforms } so the per-frame /
  // tint effects below are path-agnostic.
  const buildsRef = useRef<
    Map<
      THREE.Material,
      {
        material: THREE.Material;
        uniforms: Record<string, THREE.IUniform>;
        selfIllumPulseFn?: ((t: number) => number) | null;
      }
    >
  >(new Map());

  useEffect(() => {
    if (!enabled) return;
    const builds = new Map<
      THREE.Material,
      {
        material: THREE.Material;
        uniforms: Record<string, THREE.IUniform>;
        selfIllumPulseFn?: ((t: number) => number) | null;
      }
    >();
    // Per-build teardown (dispose the owned CSM/clone/masks). On the unified path
    // this is the build's own dispose(); on the legacy path it mirrors the old
    // CSM + ownedTextures dispose.
    const disposers: Array<() => void> = [];
    const restore: Array<() => void> = [];

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const skinned = obj as THREE.SkinnedMesh;
      if (!mesh.isMesh && !skinned.isSkinnedMesh) return;

      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((mat, i) => {
        if (!mat) return;
        // NPR materials always; on the unified path also non-NPR self-illum
        // materials (familiar eyes) - they get the glow with cel/rim disabled.
        if (!isNprMaterial(mat) && !(unified && isSelfIllumMaterial(mat))) return;
        // Idempotency: legacy CSM stamps `__csm` on the base it wraps. Unified
        // wraps an owned clone, so per-pass dedup is handled by the builds map.
        if (!unified && (mat as { __csm?: unknown }).__csm) return;

        let b = builds.get(mat);
        if (!b) {
          if (unified) {
            // ONE pass: state + CSM on an owned clone; base is never mutated.
            const built: DeadlockMaterialResult = buildDeadlockMaterial(mat, undefined, tint);
            built.uniforms.uCelV2.value = celV2 ? 1.0 : 0.0;
            b = {
              material: built.material,
              uniforms: built.uniforms,
              selfIllumPulseFn: built.selfIllumPulseFn,
            };
            builds.set(mat, b);
            disposers.push(built.dispose);
          } else {
            const built: NprWrapResult | null = wrapMaterialWithNpr(mat, undefined, tint);
            if (!built) return;
            built.uniforms.uCelV2.value = celV2 ? 1.0 : 0.0;
            b = { material: built.material, uniforms: built.uniforms };
            builds.set(mat, b);
            disposers.push(() => {
              built.material.dispose();
              built.ownedTextures.forEach((t) => t.dispose());
            });
          }
        }
        const next = b.material;
        if (Array.isArray(mesh.material)) {
          const arr = mesh.material;
          arr[i] = next;
          restore.push(() => {
            arr[i] = mat;
            // Legacy path mutates the base in place (onBeforeCompile / emissive),
            // so it must be reversed. The unified path never touched the base.
            if (!unified) unwrapNprBase(mat);
          });
        } else {
          mesh.material = next;
          restore.push(() => {
            mesh.material = mat;
            if (!unified) unwrapNprBase(mat);
          });
        }
      });
    });

    buildsRef.current = builds;

    return () => {
      // Restore the original mesh.material references first, then dispose only what
      // this effect created. The parent loader effect's disposeScene then disposes
      // the restored originals, so there is no double-free.
      restore.forEach((fn) => fn());
      disposers.forEach((fn) => fn());
      builds.clear();
      buildsRef.current = new Map();
    };
    // `tint` is intentionally excluded: the separate effect below applies it by
    // mutating uniforms, so a recolor never tears down and rebuilds the builds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, enabled, unified, source2Active]);

  // Drive uTime for the self-illum UV scroll (viscous_head's liquid glow).
  useFrame((state) => {
    if (!enabled) return;
    const t = state.clock.elapsedTime;
    buildsRef.current.forEach((b) => {
      if (b.uniforms.uTime) b.uniforms.uTime.value = t;
      // Drive a dynamic self-illum envelope (inferno body's 0.5*sin(3*time())+0.5).
      // Static scales have no fn and keep uSelfIllumPulse at 1.
      if (b.selfIllumPulseFn && b.uniforms.uSelfIllumPulse) {
        const s = b.selfIllumPulseFn(t);
        // Guard: a future divergent expr could go NaN/Inf mid-stream; one bad
        // uniform write blows out the whole material.
        if (Number.isFinite(s)) b.uniforms.uSelfIllumPulse.value = s;
      }
    });
  });

  // Live tint (ability-recolor preview): mutate uniforms only, no rebuild.
  useEffect(() => {
    if (!enabled) return;
    buildsRef.current.forEach((b) => {
      const u = b.uniforms.uTintColor.value as THREE.Color;
      if (tint) u.copy(tint);
      else u.setRGB(1, 1, 1);
    });
  }, [tint, enabled]);

  useEffect(() => {
    if (!enabled) return;
    buildsRef.current.forEach((b) => {
      if (b.uniforms.uCelV2) b.uniforms.uCelV2.value = celV2 ? 1.0 : 0.0;
    });
  }, [celV2, enabled]);

  return null;
}

/**
 * Always-on Source 2 draw state. Applies additive / translucent blend, backface
 * culling, and overlay render-order to EVERY material carrying morphic extras,
 * independent of the NPR / unified / source2 / bloom dev flags. This is the one
 * pass that runs on the default preview path, so additive self-illum glow
 * overlays (kept by the vpkmerge exporter) composite as `AdditiveBlending` rather
 * than rendering an opaque white hull. Mesh-level `renderOrder` is the piece the
 * material builders cannot set and persists across the flag-gated material swaps.
 */
function Source2Appearance({
  scene,
  enabled,
  debug,
  skipNpr,
}: {
  scene: THREE.Object3D;
  enabled: boolean;
  debug: boolean;
  skipNpr: boolean;
}) {
  useEffect(() => {
    const compiled = compileSource2DrawState(scene);
    if (debug) {
      console.info('[source2drawstate]', compiled.stats, summarizeSource2Scene(scene));
    }
    const hints = enabled
      ? applySource2MaterialHints(scene, debug, skipNpr ? (mat) => !isNprMaterial(mat) : undefined)
      : null;
    if (debug && hints) console.info('[source2hints] summary', hints.stats);
    return () => {
      // Hints capture the already-applied draw state. Undo the layers in reverse
      // order so closing a preview restores the original material, not that state.
      hints?.restore();
      compiled.restore();
    };
  }, [scene, enabled, debug, skipNpr]);

  return null;
}
