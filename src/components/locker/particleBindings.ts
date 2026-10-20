import type { ActiveHeroColor } from '../../types/mod';
import { stopsForSpec } from '../../lib/abilityColorPreview';
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
/** Apply the persisted ability-color choice to an already-resolved particle
 * color, matching the transform used for the applied textures. */
export function recolorParticleRgb(source: [number, number, number], recolor?: ActiveHeroColor | null): [number, number, number] {
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
