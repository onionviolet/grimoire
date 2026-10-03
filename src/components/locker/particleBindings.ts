import * as THREE from 'three';
import type { SpriteSimParams, FxAttachment } from './fxDescriptor';
import type { ActiveHeroColor } from '../../types/mod';
import { stopsForSpec } from '../../lib/abilityColorPreview';
/** Use authored named attachment nodes only. No guessed hand bone or offsets. */
export function resolveParticleAttachment(model: THREE.Object3D, controlPoint: number, attachment: string | null): THREE.Object3D | null {
  if (attachment) return model.getObjectByName(attachment) ?? null;
  return controlPoint === 0 ? model : null;
}
/** Compute authored weighted bone offsets in world space. Bone nodes retain
 * Source coordinates under the exporter's skeleton wrapper, so their matrix
 * includes the correct axis/unit conversion as well as the animation. */
export function particleAttachmentPosition(model: THREE.Object3D, controlPoint: number, name: string | null, definitions: FxAttachment[], target: THREE.Vector3): boolean {
  const direct = resolveParticleAttachment(model, controlPoint, name);
  if (direct) { direct.updateWorldMatrix(true, false); direct.getWorldPosition(target); return true; }
  const definition = name ? definitions.find(definition => definition.name === name) : null;
  if (!definition) return false;
  target.set(0, 0, 0);
  let total = 0;
  for (const influence of definition.influences) {
    if (influence.weight === 0) continue;
    const bone = model.getObjectByName(influence.rootTransform ? 'skeleton' : influence.bone);
    if (!bone) return false;
    bone.updateWorldMatrix(true, false);
    const point = new THREE.Vector3(...influence.offset).applyMatrix4(bone.matrixWorld);
    target.addScaledVector(point, influence.weight); total += influence.weight;
  }
  if (total <= 0) return false;
  target.divideScalar(total);
  return true;
}
function rgbToHsv([r, g, b]: number[]): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const h = !delta ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(h / 6 + 1) % 1, max ? delta / max : 0, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const sector = ((h % 1 + 1) % 1) * 6, i = Math.floor(sector), f = sector - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i] as [number, number, number];
}
/** Match the applied hue transform after authored randomization/interpolation. */
export function particleColor(layer: SpriteSimParams, start: [number, number, number], age: number, recolor?: ActiveHeroColor | null): [number, number, number] {
  const [from, to] = layer.colorWindow;
  const fraction = Math.max(0, Math.min(1, (age - from) / Math.max(0.0001, to - from)));
  const source = start.map((value, channel) => value + ((layer.colorEnd?.[channel] ?? value) - value) * fraction) as [number, number, number];
  if (!recolor || recolor.mode === 'trippy') return source;
  const [h, s, v] = rgbToHsv(source);
  const mode = recolor.mode ?? 'hue';
  let hue = recolor.hue / 360, saturation = s;
  if (mode === 'prism') hue += h;
  if (mode === 'gradient') {
    const stops = stopsForSpec(recolor.gradient).slice().sort((a, b) => a.pos - b.pos);
    const upper = stops.findIndex(stop => stop.pos >= h);
    const a = stops[Math.max(0, upper < 0 ? stops.length - 1 : upper - 1)];
    const b = stops[upper < 0 ? stops.length - 1 : upper];
    const fraction = Math.max(0, Math.min(1, (h - a.pos) / Math.max(0.0001, b.pos - a.pos)));
    const arc = ((b.hue - a.hue + 540) % 360) - 180;
    const sampled = { hue: a.hue + arc * fraction, sat: a.sat + (b.sat - a.sat) * fraction };
    hue += sampled.hue / 360; saturation *= sampled.sat;
  }
  return hsvToRgb(hue, Math.min(1, saturation * recolor.saturation), Math.min(1, v * recolor.brightness));
}
