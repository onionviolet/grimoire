import { describe, expect, it } from 'vitest';
import { recolorParticleRgb } from './particleBindings';

describe('particle recolor', () => {
  it('applies the persisted hue to the resolved color and preserves neutral highlights', () => {
    const recolored = recolorParticleRgb([1, 0, 0], { hue: 240, saturation: 1, brightness: 0.5 });
    recolored.forEach((value, index) => expect(value).toBeCloseTo([0, 0, 0.5][index]));
    expect(recolorParticleRgb([1, 1, 1], { hue: 240, saturation: 1, brightness: 1 })).toEqual([1, 1, 1]);
  });
  it('leaves the color untouched without a recolor or in trippy mode', () => {
    expect(recolorParticleRgb([0.2, 0.4, 0.6])).toEqual([0.2, 0.4, 0.6]);
    expect(recolorParticleRgb([0.2, 0.4, 0.6], { hue: 90, saturation: 1, brightness: 1, mode: 'trippy' })).toEqual([0.2, 0.4, 0.6]);
  });
});
