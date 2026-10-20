import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { Leva, folder, useControls } from 'leva';
import * as THREE from 'three';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { FULL_EFFECTS_PREVIEW_DEFAULTS, heroPresentationStorageKey, initialHeroPreviewFlags } from './heroViewerDefaults';
import { heroPreviewBounds } from '../../lib/heroPreviewBounds';
import {
  getHeroPoseInfo,
  exportHeroPose,
  getRiggedHeroPose,
  exportRiggedHeroPose,
  getHeroEffectInfo,
  exportHeroEffect,
  previewTrippySprite,
  getActiveHeroColor,
} from '../../lib/api';
import { disposeTexture, loadGltfPreview, materialTextures } from '../../lib/loadGltfPreview';
import { loadRiggedHeroPreview } from '../../lib/loadRiggedHeroPreview';
import { ParticleEffect } from './ParticleEffect';
import AbilityPreview from './AbilityPreview';
import { useAppStore } from '../../stores/appStore';
import type { ActiveHeroColor } from '../../types/mod';
import { fxPreviewIssues, type FxDescriptor } from './fxDescriptor';
import { particleAttachmentIssues } from './particleAttachment';
import { useClothSim } from '../../lib/useClothSim';
import type { ClothModel } from '../../lib/feModel';
import { BloomEffect } from './BloomEffect';
import { HeroViewerToolbar, type HeroViewerScene } from './HeroViewerToolbar';
import { heroAnimationRecipe, preferredHeroAnimationName } from '../../lib/heroAnimationCatalog';
import { ViewerBackdrop, ViewerBackdropControls } from './ViewerBackdrop';
import { useViewerBackdrop } from '../../lib/useViewerBackdrop';
import { useViewerGif } from '../../lib/useViewerGif';
import { clampAnimationTime, clampPlaybackSpeed, type HeroPlaybackProgress, type HeroPlaybackSeek } from '../../lib/heroViewerPlayback';
import {
  HERO_PREVIEW_CAMERA,
  enableHeroPreviewVertexColors,
  getHeroPreviewNormalization,
  normalizeHeroPreview,
} from './heroPreviewSceneSetup';
import { HeroPreviewAppearance, HeroViewerStage } from './HeroPreviewScene';
import {
  summarizeNprScene,
  getMorphic,
  flag,
  type MorphicExtras,
  type MorphicDynamicExpr,
} from '../../lib/source2NprMaterial';
import { resolveHeroPoseRenderFeatures } from './heroPoseRenderFeatures';
import type { HeroPoseSkinSource } from '../../types/portrait';
import type { TrippySpriteResult } from '../../types/mod';
import type { TrippyPreview } from '../../stores/trippyPreviewStore';
import { usePoseFailureStore } from '../../stores/poseFailureStore';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { attributeBrokenSkinSources } from './poseFailureAttribution';

/**
 * Live 3D preview of a hero's menu pose for the Locker's per-hero view.
 *
 * Starts with animation and supported effects enabled. Physics loads an animated rig and
 * its matching cloth sidecar. Both are exported on demand by vpkmerge and
 * served from the user's cache through the `grimoire-hero:` scheme.
 *
 * Interactive: drag to orbit, scroll to zoom. Loading stays on the custom
 * GLTFLoader helper because Source 2 morphic texture resolution needs the live
 * gltf.parser.
 */

const HERO_POSE_SCHEME = 'grimoire-hero';

// UnrealBloomPass starting params. Threshold is in LINEAR space, so it mainly catches
// the capped self-illum (peak ~ selfIllumCap) and the brightest speculars, not the
// whole hero. All three are calibration knobs - tune against a glowing hero.
const BLOOM_INTENSITY = 1;
const BLOOM_RADIUS = 0.5;
// Authored sprite cards can saturate before blending. A threshold above one
// excludes those effects and subdued emissive eyes from selective bloom.
const BLOOM_THRESHOLD = 0.85;

// Full preview effects start enabled; explicit saved switches take precedence.
// Rigged playback ships by default (measured within the frame-time ship band on
// the worst-case hero, see docs/rigged-preview-spike.md section 9): the
// `animated` switch is the viewer's name for it, and the render-feature
// resolver treats `rigged` and `animated` as the same gate.
const RELEASE_RENDER_FLAGS = FULL_EFFECTS_PREVIEW_DEFAULTS;

type DevPreviewFlags = typeof RELEASE_RENDER_FLAGS & {
  effects: boolean;
  animated: boolean;
};

type BloomParams = {
  intensity: number;
  radius: number;
  threshold: number;
};

const COMPACT_LEVA_THEME = {
  sizes: {
    rootWidth: '300px',
    controlWidth: '150px',
    rowHeight: '22px',
    folderTitleHeight: '22px',
    checkboxSize: '14px',
    titleBarHeight: '24px',
    numberInputMinWidth: '42px',
    scrubberHeight: '10px',
  },
  space: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    rowGap: '2px',
    colGap: '5px',
  },
  fontSizes: {
    root: '10px',
  },
  radii: {
    sm: '3px',
    lg: '5px',
  },
};


function writePreviewFlag(name: string, value: boolean): void {
  if (typeof window !== 'undefined') {
    const key = name.replace('grimoire.preview.', '');
    const presentation = ['animated', 'cloth', 'effects', 'bloom', 'autoRotate'].includes(key);
    window.localStorage.setItem(presentation ? heroPresentationStorageKey(key) : name, value ? '1' : '0');
  }
}


function effectDescriptorUrl(key: string): string {
  return `${HERO_POSE_SCHEME}://m/${encodeURIComponent(key)}/effect.json`;
}

function effectTextureBaseUrl(key: string): string {
  return `${HERO_POSE_SCHEME}://m/${encodeURIComponent(key)}/effect-tex/`;
}

// Turntable rotation rate (rad/s). The spin pauses while the user holds (orbits)
// the model with the mouse.
const SPIN_SPEED = 0.25;

// Whether the turntable was left paused. Remembered for the same reason the
// panel remembers being open: re-pausing the spin on every visit is the same
// papercut one layer down. Unset (never toggled) defers to prefers-reduced-motion.
const SPIN_PAUSED_KEY = 'grimoire.locker.pose.spinPaused';

function readSpinPaused(): boolean | null {
  try {
    const raw = localStorage.getItem(SPIN_PAUSED_KEY);
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

function writeSpinPaused(paused: boolean): void {
  try {
    localStorage.setItem(SPIN_PAUSED_KEY, paused ? '1' : '0');
  } catch {
    /* ignore quota/availability errors */
  }
}

function meshUrlFor(key: string, mtimeMs: number | null): string {
  // The key contains `::` (and a `/` for overflow skins), which a standard
  // scheme forbids in the host, so carry it as a single encoded path segment
  // under a fixed `m` host.
  return `${HERO_POSE_SCHEME}://m/${encodeURIComponent(key)}/model.glb?v=${mtimeMs ?? 0}`;
}

/** Free a loaded scene's GPU resources (geometry, materials, textures,
 *  skeletons). */
function disposeScene(root: THREE.Object3D): void {
  const disposedMaterials = new Set<THREE.Material>();
  const disposeMaterial = (m: THREE.Material | null | undefined): void => {
    if (!m || disposedMaterials.has(m)) return;
    disposedMaterials.add(m);
    materialTextures(m).forEach(disposeTexture);
    const resolved = getMorphic(m)?.resolvedTextures;
    if (resolved) {
      Object.values(resolved).forEach(disposeTexture);
    }
    const csmBase = (m as { __csm?: { baseMaterial?: THREE.Material } }).__csm?.baseMaterial;
    if (csmBase && csmBase !== m) disposeMaterial(csmBase);
    m.dispose();
  };

  root.traverse((obj) => {
    const skinned = obj as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) {
      // Releases the bone texture / internal buffers held by the skeleton.
      skinned.skeleton.dispose?.();
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      disposeMaterial(m);
    }
  });
}

/** Prefer an idle loop from the exported animation menu. */
function pickIdleClip(clips: THREE.AnimationClip[], heroName?: string): THREE.AnimationClip | null {
  const valid = clips.filter((c) => Number.isFinite(c.duration) && c.duration > 0.001);
  const name = preferredHeroAnimationName(valid.map((c) => c.name), heroName);
  return valid.find((c) => c.name === name) ?? null;
}

/** Shared pointer-interaction state between OrbitControls and the model group:
 *  the turntable pauses while `dragging`. A mutable ref so it updates without
 *  re-rendering. */
export type TurntableInteraction = { dragging: boolean; paused: boolean };

type ViewerText = (key: string, options?: Record<string, unknown>) => string;

export type HeroPoseFailureKind = 'unsupported' | 'skin' | 'export';

export function HeroPoseFailureState({
  kind,
  t,
  onRetry,
}: {
  kind: Exclude<HeroPoseFailureKind, 'skin'>;
  t: ViewerText;
  onRetry: () => void;
}) {
  const isExportFailure = kind === 'export';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
      <AlertTriangle className={isExportFailure ? 'h-5 w-5 text-state-danger' : 'h-5 w-5 text-text-secondary'} aria-hidden />
      <p className="max-w-xs text-center text-sm text-text-secondary">
        {t(isExportFailure ? 'locker.pose.exportFailed' : 'locker.pose.cannotPose')}
      </p>
      {isExportFailure && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-state-danger/40 px-2.5 py-1.5 text-xs font-medium text-state-danger transition-colors hover:bg-state-danger/10"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          {t('locker.pose.retry')}
        </button>
      )}
    </div>
  );
}

function isUnsupportedPoseError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('No known model codename');
}

export function HeroPoseLoadingState({
  generating,
  heroName,
  skinSourceCount,
  t,
}: {
  generating: boolean;
  heroName: string;
  skinSourceCount: number;
  t: ViewerText;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-white/80" />
      {generating && (
        <p className="text-xs text-text-secondary">
          {skinSourceCount > 1
            ? t('locker.pose.posingWithMods', { hero: heroName, count: skinSourceCount })
            : t('locker.pose.posing', { hero: heroName })}
        </p>
      )}
    </div>
  );
}

/** Slow turntable auto-rotation on the model group, paused while the user holds
 *  (orbits) the model with the mouse. */
function useTurntable(
  groupRef: RefObject<THREE.Group | null>,
  interaction: RefObject<TurntableInteraction>,
  reset = 0,
): void {
  useEffect(() => { groupRef.current?.rotation.set(0, 0, 0); }, [groupRef, reset]);
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g || interaction.current.dragging || interaction.current.paused) return;
    g.rotation.y += delta * SPIN_SPEED;
  });
}

/** The posed figure, normalized to a consistent height and centered, with a
 *  slow idle turntable. */
export function PosedModel({
  scene,
  interaction,
  effect,
  reset = 0,
}: {
  scene: THREE.Object3D;
  interaction: RefObject<TurntableInteraction>;
  effect?: EffectMount | null;
  reset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Normalize by the largest dimension so every hero fills the frame the same
  // regardless of native model scale, and recenter on the origin.
  const norm = useMemo(() => normalizeHeroPreview(scene), [scene]);

  // Per-vertex COLOR multiply where present (skin tone / accents render flat
  // white without it); see enableHeroPreviewVertexColors.
  useEffect(() => {
    enableHeroPreviewVertexColors(scene);
  }, [scene]);

  useTurntable(groupRef, interaction, reset);

  return (
    <group ref={groupRef} scale={norm.scale}>
      <group position={[-norm.center.x, -norm.center.y, -norm.center.z]}>
        <primitive object={scene} />
        {effect && (
          <ParticleEffect descriptor={effect.descriptor} textureBaseUrl={effect.baseUrl} model={scene} recolor={effect.recolor} />
        )}
      </group>
    </group>
  );
}

/** The descriptor + bundled-texture base URL for the ambient FX overlay mounted
 *  inside a model's normalized group (so it shares the preview scale/centering). */
interface EffectMount {
  descriptor: FxDescriptor;
  baseUrl: string;
  recolor?: ActiveHeroColor | null;
}

/** The skinned figure, idle clip driven by an AnimationMixer. gltf.scene is
 *  rendered AS-IS under wrapper groups so the SkinnedMesh's bone references stay
 *  valid (no reparenting, no clone). The normalize box is computed ONCE from the
 *  bind pose so the model does not breathe/drift as the clip plays. */
export function RiggedModel({
  heroName,
  scene,
  clips,
  interaction,
  clothModel,
  clothEnabled,
  effect,
  clipName,
  playback,
  seek,
  progressRef,
  reset,
}: {
  heroName?: string;
  clipName: string;
  playback: { paused: boolean; speed: number };
  seek?: HeroPlaybackSeek;
  progressRef?: RefObject<HeroPlaybackProgress>;
  reset: number;
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  interaction: RefObject<TurntableInteraction>;
  clothModel: ClothModel | null;
  clothEnabled: boolean;
  effect?: EffectMount | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const selectedClip = useMemo(() => clips.find((c) => c.name === clipName) ?? pickIdleClip(clips, heroName), [clips, clipName, heroName]);

  // Normalize from the BIND/rest pose, once. Force the skeleton to bind pose and
  // flush world matrices first so the AABB is the true rest extent and does not
  // change frame to frame.
  const norm = useMemo(() => normalizeHeroPreview(scene, { bindPose: true }), [scene]);

  useEffect(() => {
    enableHeroPreviewVertexColors(scene);
  }, [scene]);

  // Cleanup runs before setup on a motion change. Reset after the old cloth
  // and mixer release their channels, then calibrate physics from bind pose.
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh && mesh.skeleton) mesh.skeleton.pose();
    });
    scene.updateWorldMatrix(true, true);
  }, [scene, clipName, seek]);

  const clothResetKey = JSON.stringify([clipName, seek?.revision ?? 0]);
  const clothStep = useClothSim(scene, clothEnabled ? clothModel : null, clothResetKey);

  // Register after cloth captures bind transforms. Applying time zero makes a
  // selected motion visible immediately, including while playback is paused.
  useEffect(() => {
    const clip = selectedClip;
    if (!clip) {
      if (progressRef) progressRef.current = { time: 0, duration: 0 };
      return;
    }
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;
    const action = mixer.clipAction(clip);
    const hold = heroAnimationRecipe(clip.name, heroName)?.playback === 'hold';
    action.setLoop(hold ? THREE.LoopOnce : THREE.LoopRepeat, hold ? 1 : Infinity);
    action.clampWhenFinished = hold;
    action.reset().play();
    const time = clampAnimationTime(seek?.time ?? 0, clip.duration);
    // Repeat actions wrap at duration. Sample just inside the end so dragging
    // the timeline to its last position shows the final pose, not time zero.
    mixer.setTime(hold ? time : Math.min(time, Math.max(0, clip.duration - 1e-7)));
    if (progressRef) progressRef.current = { time, duration: clip.duration };
    return () => {
      action.stop();
      mixer.stopAllAction();
      mixer.uncacheClip(clip);
      mixer.uncacheRoot(scene);
      mixerRef.current = null;
    };
  }, [scene, selectedClip, seek, progressRef, heroName]);

  // The cloth driver restores the clean pose before advancing animation. With
  // physics disabled it advances the mixer directly at the render frame rate.
  useFrame((_, delta) => {
    if (!playback.paused) clothStep(delta * clampPlaybackSpeed(playback.speed), (dt) => { mixerRef.current?.update(dt); });
    const mixer = mixerRef.current;
    const clip = selectedClip;
    if (progressRef && mixer && clip && !playback.paused) {
      progressRef.current.time = clampAnimationTime(mixer.existingAction(clip)?.time ?? 0, clip.duration);
      progressRef.current.duration = clip.duration;
    }
  });

  useTurntable(groupRef, interaction, reset);

  return (
    <group ref={groupRef} scale={norm.scale}>
      <group position={[-norm.center.x, -norm.center.y, -norm.center.z]}>
        <primitive object={scene} />
        {effect && (
          <ParticleEffect key={`${clipName}:${seek?.revision ?? 0}`} descriptor={effect.descriptor} textureBaseUrl={effect.baseUrl} model={scene} playback={playback} recolor={effect.recolor} />
        )}
      </group>
    </group>
  );
}

/** Mouse orbit + zoom, damped. Auto-rotation lives on the model group so the
 *  controls don't fight it; dragging just reorients the camera. */
export function Controls({ interaction, reset, label, model, fitKey }: { interaction: RefObject<TurntableInteraction>; reset: number; label: string; model: THREE.Object3D; fitKey: string }) {
  const { camera, gl, size: viewportSize } = useThree();
  const controlsRef = useRef<ComponentRef<typeof DreiOrbitControls> | null>(null);
  const pendingFit = useRef(true);
  useEffect(() => {
    pendingFit.current = true;
  }, [camera, model, fitKey, reset, viewportSize.width, viewportSize.height]);
  // Fit after the mounted figure has updated its pose and wrapper transforms.
  // OrbitControls can mount after this component's effects, so retry until its
  // ref is ready and keep the fitted target under imperative control.
  useFrame(() => {
    const controls = controlsRef.current;
    if (!pendingFit.current || !controls || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    model.updateWorldMatrix(true, false);
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld,
    // not updateWorldMatrix. Without this pass the first bounds include the
    // normalization wrapper twice; later rendered frames hide the mistake.
    model.updateMatrixWorld(true);
    const bounds = heroPreviewBounds(model, getHeroPreviewNormalization(model)?.bounds);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const perspective = camera as THREE.PerspectiveCamera;
    const tangent = Math.tan(THREE.MathUtils.degToRad(perspective.fov ?? 40) / 2);
    const distance = Math.max(1.6, Math.max(size.y / 2 / tangent,
      size.x / 2 / tangent / Math.max(0.001, perspective.aspect ?? 1)) * 1.2 + size.z / 2);
    camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
    controls.target.copy(center);
    controls.maxDistance = Math.max(6, distance * 2);
    Object.assign(camera.userData, { previewHome: { position: camera.position.toArray(), target: center.toArray() } });
    controls.update();
    pendingFit.current = false;
  });
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', label);
    const focus = () => canvas.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      const controls = controlsRef.current;
      if (!controls || event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (!['w', 'a', 's', 'd', 'q', 'e', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      if (key === 'r') {
        const home = camera.userData.previewHome as { position: number[]; target: number[] } | undefined;
        controls.target.fromArray(home?.target ?? [0, 0, 0]);
        camera.position.fromArray(home?.position ?? [0, 0, 3.2]);
      } else if (key === 'q' || key === 'e') {
        camera.position.copy(controls.target).add(offset.setLength(THREE.MathUtils.clamp(offset.length() * (key === 'q' ? 1 / 1.1 : 1.1), controls.minDistance, controls.maxDistance)));
      } else {
        const horizontal = ['a', 'd', 'arrowleft', 'arrowright'].includes(key);
        const sign = ['a', 'w', 'arrowleft', 'arrowup'].includes(key) ? 1 : -1;
        if (event.shiftKey) {
          const direction = new THREE.Vector3(horizontal ? sign * 0.06 : 0, horizontal ? 0 : sign * 0.06, 0).applyQuaternion(camera.quaternion);
          controls.target.add(direction);
          camera.position.add(direction);
        } else {
          const spherical = new THREE.Spherical().setFromVector3(offset);
          if (horizontal) spherical.theta += sign * 0.08;
          else spherical.phi -= sign * 0.08;
          spherical.makeSafe();
          camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
        }
      }
      controls.update();
    };
    canvas.addEventListener('pointerdown', focus);
    canvas.addEventListener('keydown', keydown);
    return () => { canvas.removeEventListener('pointerdown', focus); canvas.removeEventListener('keydown', keydown); };
  }, [camera, gl, label]);
  useEffect(() => {
    // Dolly toward/away from the target in any state, clamped to min/max distance.
    const onWheel = (e: WheelEvent) => {
      const controls = controlsRef.current;
      if (!controls) return;
      e.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const dist = THREE.MathUtils.clamp(
        offset.length() * (e.deltaY > 0 ? 1.1 : 1 / 1.1),
        controls.minDistance,
        controls.maxDistance
      );
      camera.position.copy(controls.target).add(offset.setLength(dist));
    };
    gl.domElement.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      gl.domElement.removeEventListener('wheel', onWheel);
    };
  }, [camera, gl]);

  return (
    <DreiOrbitControls
      ref={controlsRef}
      enableDamping
      enablePan
      enableZoom={false}
      minDistance={1.6}
      maxDistance={6}
      onStart={() => {
        // eslint-disable-next-line react-hooks/immutability -- ref.current mutation is the sanctioned React pattern; `interaction` is a RefObject, not immutable hook state
        interaction.current.dragging = true;
      }}
      onEnd={() => {
        // eslint-disable-next-line react-hooks/immutability -- ref.current mutation is the sanctioned React pattern; `interaction` is a RefObject, not immutable hook state
        interaction.current.dragging = false;
      }}
    />
  );
}

/** Live trippy-skin preview: paints the body meshes with the trippy pattern and
 *  animates it. The sprite from `previewTrippySprite` is a horizontal frame
 *  strip (the same asset the 2D swatch flipbooks); we draw the current frame
 *  onto an offscreen canvas and feed it as a tiling CanvasTexture, so the paint
 *  flows on the model. This is an approximation of the engine's UV-scroll shader
 *  (body only; the GLB carries no weapon mesh), not the exact bake.
 *
 *  Originals are captured per material and restored on unmount, so toggling the
 *  preview off (or closing the panel) returns the model to its real skin. */
function TrippyPaint({
  scene,
  sprite,
  fps = 12,
  repeat = 2,
}: {
  scene: THREE.Object3D;
  sprite: TrippySpriteResult;
  fps?: number;
  repeat?: number;
}) {
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const startRef = useRef<number | null>(null);
  const lastFrameRef = useRef(-1);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.size;
    canvas.height = sprite.size;
    canvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;

    const img = new Image();
    img.src = sprite.dataUrl;
    imgRef.current = img;

    // Unique materials so meshes sharing one material are touched once.
    const originals = new Map<THREE.MeshStandardMaterial, { map: THREE.Texture | null; color: number }>();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const sm = m as THREE.MeshStandardMaterial;
        if (!sm || originals.has(sm)) continue;
        originals.set(sm, { map: sm.map ?? null, color: sm.color?.getHex() ?? 0xffffff });
        sm.map = tex;
        sm.color?.setHex(0xffffff);
        sm.needsUpdate = true;
      }
    });

    return () => {
      for (const [sm, original] of originals) {
        sm.map = original.map;
        sm.color?.setHex(original.color);
        sm.needsUpdate = true;
      }
      originals.clear();
      tex.dispose();
      startRef.current = null;
      lastFrameRef.current = -1;
    };
  }, [scene, sprite, repeat]);

  useFrame((state) => {
    const tex = texRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!tex || !canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const now = state.clock.elapsedTime;
    if (startRef.current === null) startRef.current = now;
    const frame = Math.floor((now - startRef.current) * fps) % sprite.frames;
    if (frame === lastFrameRef.current) return;
    lastFrameRef.current = frame;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      img,
      frame * sprite.size,
      0,
      sprite.size,
      sprite.size,
      0,
      0,
      sprite.size,
      sprite.size
    );
    tex.needsUpdate = true;
  });

  return null;
}

const q = (x: number): number => Math.round(x * 100) / 100;

export default function HeroPoseViewer({
  heroName,
  skinSources = [],
  fallbackSkinMetaKey,
  trippyPreview,
  onFailureChange,
}: {
  heroName: string;
  /** Active visual VPK stack for this hero, ordered by the main process before export. */
  skinSources?: HeroPoseSkinSource[];
  /** Single-skin fallback when a multi-source preview stack cannot be exported. */
  fallbackSkinMetaKey?: string;
  /** Live Body + Gun trippy params to paint on the body in real time, or
   *  undefined for the plain skin. */
  trippyPreview?: TrippyPreview;
  /** Reports the failure kind outward whenever the internal failure state
   *  changes (including a reset to null), so a caller can raise its own
   *  auto-fallback surface without owning the viewer's state. */
  onFailureChange?: (kind: HeroPoseFailureKind | null) => void;
}) {
  const { t } = useTranslation();
  // The callback is deliberately held in a ref and kept out of the loading
  // effect's dependency array: a caller passing an inline arrow must not
  // restart the loader on every render. The ref is refreshed on every render
  // (before any effect reads it, effects run in declaration order).
  const onFailureChangeRef = useRef(onFailureChange);
  useEffect(() => {
    onFailureChangeRef.current = onFailureChange;
  });
  // Grabbed off the store rather than through a hook subscription: these are
  // stable actions, and the viewer only ever writes this state.
  const markBroken = usePoseFailureStore((s) => s.markBroken);
  const clearBroken = usePoseFailureStore((s) => s.clearBroken);
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [clips, setClips] = useState<THREE.AnimationClip[]>([]);
  const [rigged, setRigged] = useState(false);
  const [clothModel, setClothModel] = useState<ClothModel | null>(null);
  const [generating, setGenerating] = useState(false);
  // Spin state: the user's last explicit choice wins. Otherwise follow the
  // viewer default (paused unless the presentation switch turned auto-rotate
  // on), and always start paused when the OS asks for reduced motion.
  const prefersReducedMotion = usePrefersReducedMotion();
  const [spinPaused, setSpinPaused] = useState(
    () => readSpinPaused() ?? (prefersReducedMotion || !initialHeroPreviewFlags().autoRotate)
  );
  const interaction = useRef<TurntableInteraction>({ dragging: false, paused: spinPaused });
  const [failure, setFailure] = useState<HeroPoseFailureKind | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [playback, setPlayback] = useState({ paused: false, speed: 1 });
  const [clipName, setClipName] = useState('');
  const [seek, setSeek] = useState<HeroPlaybackSeek>({ time: 0, revision: 0 });
  const playbackProgressRef = useRef<HeroPlaybackProgress>({ time: 0, duration: 0 });
  const [viewerScene, setViewerScene] = useState<HeroViewerScene>('midtown');
  const [resetView, setResetView] = useState(0);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const backdrop = useViewerBackdrop();
  const backdropError = backdrop.errorKey === 'locker.pose.backgroundTooLarge'
    ? t('locker.pose.backgroundTooLarge') : backdrop.errorKey ? t('locker.pose.backgroundFailed') : null;
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [effect, setEffect] = useState<EffectMount | null>(null);
  const [effectUnavailable, setEffectUnavailable] = useState(false);
  const partialEffect = useMemo(() => effect ? fxPreviewIssues(effect.descriptor).length > 0
    || (scene ? particleAttachmentIssues(effect.descriptor, scene).length > 0 : false) : false, [effect, scene]);
  const sourceKey = skinSources.map((source) => `${source.priority}:${source.metaKey}`).join('|');
  const gifError = useCallback(() => setViewerError(t('locker.pose.gifFailed')), [t]);
  const gif = useViewerGif(canvasRef, `${heroName}:${sourceKey}:${scene?.uuid ?? ''}`, heroName, gifError);
  const [devFlags, setDevFlags] = useState<DevPreviewFlags>(initialHeroPreviewFlags);
  const [bloomParams, setBloomParams] = useState<BloomParams>(() => ({
    intensity: BLOOM_INTENSITY,
    radius: BLOOM_RADIUS,
    threshold: BLOOM_THRESHOLD,
  }));
  const setDevFlag = useCallback((key: keyof DevPreviewFlags, storageKey: string, value: boolean) => {
    writePreviewFlag(storageKey, value);
    if ((key === 'effects' || key === 'cloth') && value) writePreviewFlag('grimoire.preview.animated', true);
    setDevFlags((current) => ({ ...current, [key]: value, ...((key === 'effects' || key === 'cloth') && value ? { animated: true } : {}) }));
  }, []);
  const activeRenderFlags = {
    ...(import.meta.env.DEV ? devFlags : RELEASE_RENDER_FLAGS),
    cloth: devFlags.cloth,
    animated: devFlags.animated,
    bloom: devFlags.bloom,
  };
  const experimentalAbilityPreview = useAppStore(state => state.settings?.experimentalAbilityPreview ?? false);
  const effectPreviewEnabled = devFlags.effects;

  // The pose GLB has no weapon mesh, so a weapons-only paint has nothing to show
  // here, and intensity 0 is "no paint". Otherwise fetch the pattern as an
  // animated sprite strip (debounced) and flipbook it onto the body materials.
  const showTrippy =
    !!trippyPreview && trippyPreview.targets !== 'weapons' && trippyPreview.intensity > 0;
  const trippyKey = showTrippy
    ? `${trippyPreview.style}:${q(trippyPreview.intensity)}:${q(trippyPreview.phase)}:${q(trippyPreview.scroll)}`
    : null;
  const [trippySprite, setTrippySprite] = useState<TrippySpriteResult | null>(null);
  const features = resolveHeroPoseRenderFeatures(activeRenderFlags, !!trippySprite);
  useEffect(() => {
    if (!showTrippy || !trippyPreview) {
      setTrippySprite(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      previewTrippySprite({
        style: trippyPreview.style,
        phase: q(trippyPreview.phase),
        scroll: q(trippyPreview.scroll),
        intensity: q(trippyPreview.intensity),
        frames: 24,
        size: 128,
      })
        .then((sprite) => {
          if (!cancelled) setTrippySprite(sprite);
        })
        .catch(() => {
          if (!cancelled) setTrippySprite(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // trippyKey encodes the params that change the sprite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trippyKey]);

  useEffect(() => {
    // The caller remounts this component (via a hero+skin `key`) when the
    // selection changes, so initial state is already fresh here.
    let cancelled = false;
    setFailure(null);
    onFailureChangeRef.current?.(null);
    setScene(null);
    setClips([]);
    setSeek((s) => ({ time: 0, revision: s.revision + 1 }));
    playbackProgressRef.current = { time: 0, duration: 0 };
    setRigged(false);
    setClothModel(null);

    (async () => {
      try {
        // --- Attempt 1: rigged (animated, skinned) glb. Shipped by default as
        //     of RP-03 (docs/ingame-verification-record.md): the measured
        //     frame-time delta on Seven, the worst case on every axis, landed
        //     within the ship band. Missing clips or a failed export fall
        //     through to the static --pose menu pose (Attempt 2). ---
        if (features.riggedPreviewEnabled) {
          try {
            let rig = await getRiggedHeroPose(heroName, skinSources);
            if (cancelled) return;
            if (!rig.hasModel) {
              setGenerating(true);
              rig = await exportRiggedHeroPose(heroName, skinSources, fallbackSkinMetaKey);
              if (cancelled) return;
              setGenerating(false);
            }
            if (rig.hasModel) {
              const { gltf, clothModel } = await loadRiggedHeroPreview(rig, features.clothPreviewEnabled);
              if (cancelled) {
                disposeScene(gltf.scene);
                return;
              }
              const clip = pickIdleClip(gltf.animations ?? [], heroName);
              if (!clip) {
                disposeScene(gltf.scene);
                throw new Error('Rigged preview GLB has no animated clip.');
              }
              setClips((gltf.animations ?? []).filter((c) => Number.isFinite(c.duration) && c.duration > 0.001));
              setClipName((current) => gltf.animations.some((candidate) => candidate.name === current
                && Number.isFinite(candidate.duration) && candidate.duration > 0.001) ? current : clip.name);
              setRigged(true);
              setClothModel(clothModel);
              setScene(gltf.scene);
              return; // rigged path won.
            }
          } catch {
            // Rigged export/load failed; fall through to the static pose path.
            setGenerating(false);
          }
        }

        // --- Attempt 2: static --pose glb (the default). ---
        let info = await getHeroPoseInfo(heroName, skinSources);
        // A cached export for this exact stack means the stack poses fine.
        let stackPosed = info.hasModel;
        if (!info.hasModel) {
          if (cancelled) return;
          setGenerating(true);
          try {
            info = await exportHeroPose(heroName, skinSources, fallbackSkinMetaKey);
            stackPosed = true;
          } catch (skinError) {
            // A successful vanilla retry proves the installed skin stack is the
            // problem. Keep showing that usable base pose, but make the warning
            // explicit instead of blaming unsupported heroes or Grimoire.
            if (skinSources.length > 0 && !isUnsupportedPoseError(skinError)) {
              try {
                info = await exportHeroPose(heroName, []);
                if (!cancelled) {
                  setFailure('skin');
                  onFailureChangeRef.current?.('skin');
                  // Name the culprit so the grid can badge it. Detached from the
                  // render path: the base pose is already showing, and narrowing
                  // a stack costs an export per member.
                  void attributeBrokenSkinSources(
                    skinSources,
                    (source) =>
                      exportHeroPose(heroName, [source]).then((probed) => probed.hasModel),
                    () => cancelled
                  ).then((metaKeys) => {
                    if (!cancelled && metaKeys.length > 0) markBroken(heroName, metaKeys);
                  });
                }
              } catch (baseError) {
                if (!cancelled) {
                  setFailure(isUnsupportedPoseError(baseError) ? 'unsupported' : 'export');
                  onFailureChangeRef.current?.(
                    isUnsupportedPoseError(baseError) ? 'unsupported' : 'export'
                  );
                }
                return;
              }
            } else {
              if (!cancelled) {
                setFailure(isUnsupportedPoseError(skinError) ? 'unsupported' : 'export');
                onFailureChangeRef.current?.(
                  isUnsupportedPoseError(skinError) ? 'unsupported' : 'export'
                );
              }
              return;
            }
          }
          if (cancelled) return;
          setGenerating(false);
        }
        if (!info.hasModel) {
          if (!cancelled) {
            setFailure('export');
            onFailureChangeRef.current?.('export');
          }
          return;
        }
        // The stack posed, so nothing in it is broken: heal any card badge left
        // over from an older, genuinely broken version of one of these mods.
        if (stackPosed && !cancelled && skinSources.length > 0) {
          clearBroken(skinSources.map((source) => source.metaKey));
        }
        const url = meshUrlFor(info.key, info.mtimeMs);
        const gltf = await loadGltfPreview(url, { imageBitmaps: true });
        if (cancelled) {
          disposeScene(gltf.scene);
          return;
        }
        setRigged(false);
        setClips([]);
        setClothModel(null); // static path has no skeleton; nothing to simulate.
        setScene(gltf.scene);
      } catch {
        if (!cancelled) {
          setGenerating(false);
          setFailure('export');
          onFailureChangeRef.current?.('export');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // `skinSources` is deliberately not a dependency: `sourceKey` already
    // encodes its contents, and the array reference changes on every parent
    // mods refresh, which would tear down and re-fetch the GLB for an
    // identical stack (visible viewer churn on unrelated toggles).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    heroName,
    sourceKey,
    fallbackSkinMetaKey,
    retryNonce,
    features.riggedPreviewEnabled,
    features.clothPreviewEnabled,
  ]);

  // Dispose in the commit that drops the scene from the Canvas. Disposing in the
  // loader cleanup left a frame where the still-mounted Canvas re-uploaded
  // textures whose ImageBitmaps were already closed.
  useEffect(() => {
    if (!scene) return;
    return () => disposeScene(scene);
  }, [scene]);

  useEffect(() => {
    if (!scene || !features.nprDebugEnabled) return;
    console.info('[HeroPoseViewer] NPR material summary', heroName, summarizeNprScene(scene));
  }, [scene, heroName, features.nprDebugEnabled]);

  // Ambient FX overlay: curated base graphs use the selected skin's texture stack.
  // getHeroEffectInfo cheaply returns hasEffect=false for everyone else. The
  // bundle is built on demand, then the descriptor JSON is fetched over the
  // grimoire-hero: scheme and handed to the renderer.
  useEffect(() => {
    if (!effectPreviewEnabled) { setEffect(null); return; }
    let cancelled = false;
    setEffect(null);
    setEffectUnavailable(false);
    (async () => {
      try {
        let info = await getHeroEffectInfo(heroName, skinSources);
        if (cancelled) return;
        if (!info.entry) { setEffectUnavailable(true); return; }
        if (!info.hasEffect) {
          info = await exportHeroEffect(heroName, skinSources);
          if (cancelled) return;
          if (!info.hasEffect) { setEffectUnavailable(true); return; }
        }
        const res = await fetch(effectDescriptorUrl(info.key));
        if (!res.ok) { if (!cancelled) setEffectUnavailable(true); return; }
        const descriptor = (await res.json()) as FxDescriptor;
        if (cancelled) return;
        const recolor = await getActiveHeroColor(heroName).catch(() => null);
        if (cancelled) return;
        setEffect({ descriptor, baseUrl: effectTextureBaseUrl(info.key), recolor });
      } catch {
        if (!cancelled) setEffectUnavailable(true);
        // Effects are a non-essential overlay; a failure leaves the plain pose.
      }
    })();
    return () => {
      cancelled = true;
    };
    // sourceKey covers the stack; parent renders may allocate an equivalent array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroName, sourceKey, effectPreviewEnabled]);

  // The preference can be turned on while the app is open. Honor it live, but
  // never override an explicit choice the user made here.
  useEffect(() => {
    if (!prefersReducedMotion || readSpinPaused() !== null) return;
    interaction.current.paused = true;
    setSpinPaused(true);
  }, [prefersReducedMotion]);

  const toolbar = (
    <HeroViewerToolbar
      heroName={heroName}
      animated={features.riggedPreviewEnabled} clips={clips.map((c) => c.name)} clip={clipName}
      paused={playback.paused} speed={playback.speed} spinPaused={spinPaused}
      progressRef={playbackProgressRef} onSeek={(time) => {
        setPlayback((p) => ({ ...p, paused: true }));
        setSeek((s) => ({ time, revision: s.revision + 1 }));
      }}
      cloth={devFlags.cloth} bloom={devFlags.bloom} particles={devFlags.effects} scene={viewerScene}
      backdropControls={<ViewerBackdropControls hasImage={!!backdrop.texture} loading={backdrop.loading}
        preset={backdrop.preset} onPreset={(value) => {
          if (value !== 'none' && viewerScene === 'transparent') setViewerScene('studio');
          backdrop.choosePreset(value);
        }}
        onFile={(file) => {
          if (viewerScene === 'transparent') setViewerScene('studio');
          void backdrop.choose(file);
        }} onClear={backdrop.clear} />}
      status={viewerError ?? backdropError}
      onAnimated={(v) => {
        writePreviewFlag('grimoire.preview.animated', v);
        if (!v) {
          writePreviewFlag('grimoire.preview.cloth', false);
          writePreviewFlag('grimoire.preview.effects', false);
        }
        setDevFlags((f) => ({ ...f, animated: v, cloth: v ? f.cloth : false, effects: v ? f.effects : false }));
      }}
      onClip={(name) => {
        setClipName(name);
        setSeek((s) => ({ time: 0, revision: s.revision + 1 }));
        playbackProgressRef.current = { time: 0, duration: clips.find((c) => c.name === name)?.duration ?? 0 };
      }} onPaused={(paused) => setPlayback((p) => ({ ...p, paused }))}
      onSpeed={(speed) => setPlayback((p) => ({ ...p, speed }))}
      onSpinPaused={(paused) => {
        writePreviewFlag('grimoire.preview.autoRotate', !paused);
        writeSpinPaused(paused);
        interaction.current.paused = paused;
        setSpinPaused(paused);
      }}
      onCloth={(v) => setDevFlag('cloth', 'grimoire.preview.cloth', v)}
      onBloom={(v) => setDevFlag('bloom', 'grimoire.preview.bloom', v)}
      onParticles={(v) => setDevFlag('effects', 'grimoire.preview.effects', v)}
      onScene={setViewerScene} onReset={() => setResetView((v) => v + 1)}
      onScreenshot={() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          const link = document.createElement('a');
          link.download = `${heroName.replace(/[^a-z0-9_-]/gi, '_')}-preview.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          setViewerError(null);
        } catch { setViewerError(t('locker.pose.screenshotFailed')); }
      }}
      onFullscreen={() => {
        const request = document.fullscreenElement ? document.exitFullscreen() : viewerRef.current?.requestFullscreen();
        request?.catch(() => setViewerError(t('locker.pose.fullscreenFailed')));
      }}
      gifAvailable={!!scene} gif={gif} onGif={() => { setViewerError(null); void gif.toggle(); }}
    />
  );

  return (
    <div ref={viewerRef}
      data-particle-availability={effectUnavailable ? 'unavailable' : partialEffect ? 'partial' : effect ? 'ready' : 'pending'}
      data-animation-availability={scene ? rigged ? 'ready' : 'unavailable' : 'pending'}
      data-cloth-availability={scene ? clothModel ? 'ready' : 'unavailable' : 'pending'}
      className={`absolute inset-0 ${viewerScene === 'transparent' ? '' : 'bg-bg-secondary'}`}>
      {failure === 'unsupported' || failure === 'export' ? (
        <HeroPoseFailureState kind={failure} t={t} onRetry={() => setRetryNonce((n) => n + 1)} />
      ) : !scene ? (
        <HeroPoseLoadingState generating={generating} heroName={heroName} skinSourceCount={skinSources.length} t={t} />
      ) : <>
      {failure === 'skin' && (
        <div className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-md border border-state-warning/35 bg-black/70 px-2.5 py-2 text-xs text-state-warning shadow-lg">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <p>{t('locker.pose.skinFailed')}</p>
        </div>
      )}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
        camera={HERO_PREVIEW_CAMERA}
        dpr={[1, 2]}
        gl={{
          alpha: true,
          toneMapping: THREE.NoToneMapping,
          preserveDrawingBuffer: true,
        }}
      >
        <ViewerBackdrop texture={viewerScene === 'transparent' ? null : backdrop.texture} />
        {/* The IBL probe supplies ambient + reflections, so the bare ambientLight
            is gone and the directionals are softened to a warm key + cool fill
            that just shapes the form on top of the environment. */}
        <HeroViewerStage scene={viewerScene} />
        {rigged ? (
          <RiggedModel
            heroName={heroName}
            reset={resetView}
            clipName={clipName}
            playback={playback}
            seek={seek}
            progressRef={playbackProgressRef}
            scene={scene}
            clips={clips}
            interaction={interaction}
            clothModel={clothModel}
            clothEnabled={features.clothPreviewEnabled}
            effect={effectPreviewEnabled ? effect : null}
          />
        ) : (
          <PosedModel reset={resetView} scene={scene} interaction={interaction} />
        )}
        {scene && <HeroPreviewAppearance scene={scene} features={features} />}
        {trippySprite && <TrippyPaint scene={scene} sprite={trippySprite} />}
        {scene && (
          <BloomEffect
            deadlockExposure={viewerScene === 'midtown' ? 1.6 : 1.3}
            intensity={features.bloomEnabled ? bloomParams.intensity : 0}
            radius={import.meta.env.DEV ? bloomParams.radius : BLOOM_RADIUS}
            threshold={import.meta.env.DEV ? bloomParams.threshold : BLOOM_THRESHOLD}
          />
        )}
        <Controls interaction={interaction} reset={resetView} label={t('locker.pose.cameraHint')} model={scene} fitKey={clipName} />
      </Canvas>
      </>}
      {toolbar}
      {experimentalAbilityPreview && <div className="absolute bottom-3 right-3 z-10 max-w-72 space-y-2 rounded-sm bg-bg-secondary/90 p-2">
        <AbilityPreview heroName={heroName} skinSources={skinSources} fallbackSkinMetaKey={fallbackSkinMetaKey} />
      </div>}
      {import.meta.env.DEV && new URLSearchParams(window.location.search).has('viewer-debug') && (
        <DevViewerControls
          devFlags={devFlags}
          setDevFlag={setDevFlag}
          bloomParams={bloomParams}
          setBloomParams={setBloomParams}
        />
      )}
      {scene && import.meta.env.DEV && devFlags.matDebug && <MaterialDebugPanel scene={scene} />}
    </div>
  );
}

function DevViewerControls({
  devFlags,
  setDevFlag,
  bloomParams,
  setBloomParams,
}: {
  devFlags: DevPreviewFlags;
  setDevFlag: (key: keyof DevPreviewFlags, storageKey: string, value: boolean) => void;
  bloomParams: BloomParams;
  setBloomParams: Dispatch<SetStateAction<BloomParams>>;
}) {
  useControls(
    'Preview',
    () => ({
      Unified: {
        value: devFlags.unified,
        onChange: (value: boolean) =>
          setDevFlag('unified', 'grimoire.preview.unifiedMaterial', value),
      },
      'Cel v2': {
        value: devFlags.celV2,
        onChange: (value: boolean) => setDevFlag('celV2', 'grimoire.preview.celV2', value),
      },
      FX: {
        value: devFlags.effects,
        onChange: (value: boolean) => setDevFlag('effects', 'grimoire.preview.effects', value),
      },
      Bloom: folder(
        {
          On: {
            value: devFlags.bloom,
            onChange: (value: boolean) => setDevFlag('bloom', 'grimoire.preview.bloom', value),
          },
          Int: {
            value: bloomParams.intensity,
            min: 0,
            max: 5,
            step: 0.05,
            onChange: (value: number) =>
              setBloomParams((current) => ({ ...current, intensity: value })),
          },
          Radius: {
            value: bloomParams.radius,
            min: 0,
            max: 2,
            step: 0.01,
            onChange: (value: number) =>
              setBloomParams((current) => ({ ...current, radius: value })),
          },
          Gate: {
            value: bloomParams.threshold,
            min: 0,
            max: 2,
            step: 0.01,
            onChange: (value: number) =>
              setBloomParams((current) => ({ ...current, threshold: value })),
          },
        },
        { collapsed: true }
      ),
      Debug: folder(
        {
          Log: {
            value: devFlags.nprDebug,
            onChange: (value: boolean) =>
              setDevFlag('nprDebug', 'grimoire.preview.nprDebug', value),
          },
          Mats: {
            value: devFlags.matDebug,
            onChange: (value: boolean) =>
              setDevFlag('matDebug', 'grimoire.preview.matDebug', value),
          },
        },
        { collapsed: true }
      ),
    }),
    [bloomParams, devFlags, setBloomParams, setDevFlag]
  );

  // `fill` drops leva's fixed viewport-corner placement and makes it fill this
  // wrapper instead, so the dev panel stays inside the model panel rather than
  // spilling over the app chrome around it. Dragging is off for the same
  // reason: it would drag the panel back out of its box.
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-20 w-[15rem] max-w-[calc(100%-1rem)]">
      <div className="pointer-events-auto overflow-hidden rounded-lg shadow-lg">
        <Leva
          fill
          collapsed={false}
          hideCopyButton
          theme={COMPACT_LEVA_THEME}
          titleBar={{ title: 'Preview', drag: false, filter: false }}
        />
      </div>
    </div>
  );
}

function MaterialDebugPanel({ scene }: { scene: THREE.Object3D | null }) {
  const rows = useMemo(() => {
    if (!scene) return [];
    const byName = new Map<string, { name: string; morphic: MorphicExtras }>();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const morphic = getMorphic(m);
        if (!morphic) continue;
        const name = m.name || morphic.shader || '(unnamed)';
        if (!byName.has(name)) byName.set(name, { name, morphic });
      }
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [scene]);

  if (rows.length === 0) return null;

  const fmtExpr = (e: MorphicDynamicExpr) =>
    e.decompiled ? e.source : `[decompile failed: ${e.error ?? 'unknown'} #${e.hash.slice(0, 8)}]`;

  return (
    <div className="absolute bottom-3 right-3 z-10 max-h-[60%] w-[28rem] max-w-[55vw] overflow-auto rounded bg-black/80 p-2 font-mono text-[10px] leading-tight text-white">
      <div className="mb-1 font-semibold">morphic extras - {rows.length} material(s)</div>
      {rows.map(({ name, morphic }) => {
        const dyn = Object.entries(morphic.dynamic_params ?? {});
        const dynTex = Object.entries(morphic.dynamic_texture_params ?? {});
        const slots = Object.keys(morphic.texture_slots ?? {});
        const resolved = Object.keys(morphic.resolvedTextures ?? {});
        return (
          <div key={name} className="mb-1.5 border-t border-hl/20 pt-1">
            <div className="text-state-warning">{name}</div>
            <div>
              schema v{morphic.schema_version ?? 1} - {morphic.shader} -{' '}
              {morphic.blend_mode ?? 'opaque'}
              {flag(morphic, 'F_USE_NPR_LIGHTING') ? ' - NPR' : ''}
            </div>
            <div>
              slots: {slots.length} ({resolved.length} resolved)
              {slots.length ? `: ${slots.join(', ')}` : ''}
            </div>
            {dyn.length > 0 && (
              <div className="text-state-info">
                dynamic_params ({dyn.length}):
                {dyn.map(([k, e]) => (
                  <div key={k} className="pl-2">
                    {k} = {fmtExpr(e)}
                  </div>
                ))}
              </div>
            )}
            {dynTex.length > 0 && (
              <div className="text-state-info">
                dynamic_texture_params ({dynTex.length}):
                {dynTex.map(([k, e]) => (
                  <div key={k} className="pl-2">
                    {k} = {fmtExpr(e)}
                  </div>
                ))}
              </div>
            )}
            {(morphic.render_attributes_used?.length ?? 0) > 0 && (
              <div className="text-white/60">attrs: {morphic.render_attributes_used!.join(', ')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
