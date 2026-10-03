/**
 * Renders an FX descriptor's sprite layers as additive billboard clusters on the
 * hero preview turntable. First slice of the effects-preview axis: a CPU sprite
 * sim driving a custom-shader `THREE.Points` (per-particle size + alpha + texture,
 * which plain `PointsMaterial` can't do -- it gives flat uniform dots that don't
 * read as VFX). Rope/model/light layers are skipped (see
 * `fxDescriptor.allSpriteLayers`).
 *
 * Preview-grade sprite interpretation: authored rates, attachment/control-point
 * positions, RandomColor and ColorInterpolate are honored. Unsupported operators
 * and renderer families are not reproduced. This does not claim engine fidelity.
 *
 * Point size is screen-space (px), NOT world units: the parent model group is
 * scaled ~0.01 (cm bounds normalized to a 2-unit view) and world-space point size
 * ignores that parent scale, so a world size renders fullscreen. Mount inside the
 * model's normalized group so positions share its centering. Data comes from
 * `vpkmerge particle ... --out effect.json --textures-dir tex/`, served over the
 * `grimoire-hero:` scheme.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ActiveHeroColor } from '../../types/mod';
import { particleColor, particleAttachmentPosition } from './particleBindings';
import * as THREE from 'three';

import {
  allSpriteLayers,
  fxTexturePngName,
  type FxDescriptor,
  type SpriteSimParams,
  type FxAttachment,
} from './fxDescriptor';

/** Screen-space billboard size range (px). */
const MIN_POINT_PX = 8;
const MAX_POINT_PX = 64;
// The model exporter converts Source inches to glTF meters.
const SOURCE_UNIT_METERS = 0.0254;

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uHasMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    // Round soft falloff when there's no texture; otherwise sample the sprite.
    vec2 uv = gl_PointCoord;
    float d = length(uv - vec2(0.5));
    vec4 tex = uHasMap > 0.5 ? texture2D(map, uv) : vec4(smoothstep(0.5, 0.0, d));
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
    if (gl_FragColor.a <= 0.001) discard;
  }
`;

interface Particle {
  age: number;
  life: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Tangential orbit angular speed (rad/s) about the spawn axis. */
  orbit: number;
  baseSize: number;
  color: [number, number, number];
  anchor: THREE.Vector3;
}

/** One additive billboard cluster for a single sprite layer. */
function SpriteLayer({ layer, textureBaseUrl, model, recolor, attachments }: {
  layer: SpriteSimParams; textureBaseUrl: string; model?: THREE.Object3D; recolor?: ActiveHeroColor | null; attachments: FxAttachment[];
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useRef<Particle[]>([]);
  const spawnAcc = useRef(0);

  const texture = useMemo(() => {
    if (!layer.texture) return null;
    const tex = new THREE.TextureLoader().load(textureBaseUrl + fxTexturePngName(layer.texture));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [layer.texture, textureBaseUrl]);

  const cap = Math.max(1, Math.min(256, layer.maxParticles));
  const anchor = useMemo(() => new THREE.Vector3(), []);
  const baseSize = THREE.MathUtils.clamp(layer.radius * 1.6, MIN_POINT_PX, MAX_POINT_PX);

  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    geom.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(cap), 1));
    geom.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(cap), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, uHasMap: { value: texture ? 1 : 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: layer.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    return { geometry: geom, material: mat };
  }, [cap, layer.additive, texture]);

  useEffect(
    () => () => {
      texture?.dispose();
      geometry.dispose();
      material.dispose();
    },
    [texture, geometry, material]
  );

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.05);
    const points = pointsRef.current;
    if (!points) return;
    const list = particles.current;

    // An unresolved authored attachment must not silently spawn at the feet.
    if (model) {
      const resolved = particleAttachmentPosition(model, layer.controlPoint, layer.attachment, attachments, anchor);
      if (!resolved) { points.geometry.setDrawRange(0, 0); return; }
      points.updateWorldMatrix(true, false);
      points.worldToLocal(anchor);
    } else {
      if (layer.controlPoint !== 0 || layer.attachment) { points.geometry.setDrawRange(0, 0); return; }
      anchor.set(0, 0, 0);
    }
    spawnAcc.current += Math.max(0, layer.emitRate) * delta;
    while (spawnAcc.current >= 1 && list.length < cap) {
      spawnAcc.current -= 1;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      const r = Math.cbrt(Math.random()) * Math.max(layer.spawnRadius, layer.radius) * SOURCE_UNIT_METERS;
      list.push({
        age: 0,
        life: THREE.MathUtils.lerp(layer.lifetime[0], layer.lifetime[1], Math.random()),
        pos: dir.clone().multiplyScalar(r).add(anchor),
        anchor: anchor.clone(),
        color: layer.colorMin.map((value, channel) => THREE.MathUtils.lerp(value, layer.colorMax[channel], Math.random())) as [number, number, number],
        vel: dir.clone().multiplyScalar(layer.drift * SOURCE_UNIT_METERS),
        orbit: THREE.MathUtils.lerp(layer.spin[0], layer.spin[1], Math.random()),
        baseSize: baseSize * (0.6 + Math.random() * 0.6),
      });
    }

    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = points.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const size = points.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alpha = points.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    let w = 0;
    for (const p of list) {
      p.age += delta;
      if (p.age >= p.life) continue;
      if (layer.positionLocked) {
        p.pos.add(anchor.clone().sub(p.anchor));
        p.anchor.copy(anchor);
      }
      // Orbit offsets around the injected attachment, never the model root.
      const a = p.orbit * delta;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const ox = p.pos.x - p.anchor.x;
      const oz = p.pos.z - p.anchor.z;
      p.pos.x = p.anchor.x + ox * cos - oz * sin;
      p.pos.z = p.anchor.z + ox * sin + oz * cos;
      p.pos.addScaledVector(p.vel, delta);
      const t = p.age / p.life;
      const env = Math.sin(Math.min(t, 1) * Math.PI); // fade in/out
      pos.setXYZ(w, p.pos.x, p.pos.y, p.pos.z);
      const color = particleColor(layer, p.color, t, recolor);
      col.setXYZ(w, color[0], color[1], color[2]);
      size.setX(w, p.baseSize * (0.5 + 0.5 * env));
      alpha.setX(w, env);
      w++;
    }
    if (w < list.length) {
      particles.current = list.filter((p) => p.age < p.life);
    }
    points.geometry.setDrawRange(0, w);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    size.needsUpdate = true;
    alpha.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Renders all sprite layers of a descriptor. `textureBaseUrl` must end in `/`
 *  and point at the bundle's texture dir served over `grimoire-hero:`. */
export function ParticleEffect({
  descriptor,
  textureBaseUrl,
  model,
  recolor,
}: {
  descriptor: FxDescriptor;
  textureBaseUrl: string;
  model?: THREE.Object3D;
  recolor?: ActiveHeroColor | null;
}) {
  const layers = useMemo(() => allSpriteLayers(descriptor), [descriptor]);
  return (
    <group>
      {layers.map((layer, i) => (
        <SpriteLayer key={i} layer={layer} textureBaseUrl={textureBaseUrl} model={model} recolor={recolor} attachments={descriptor.attachments ?? []} />
      ))}
    </group>
  );
}
