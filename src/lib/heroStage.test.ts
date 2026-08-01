import { describe, expect, it } from 'vitest';
import {
  CLEAR_ZONE_START_VAR,
  HERO_STAGE_VEIL,
  VEILED_CONTENT_WIDTH_VAR,
  clearZoneStart,
  heroPlateComposition,
  heroStageVars,
  heroSubjectX,
  resolveHeroPlate,
  veilClearStopPct,
  veilLayerStyle,
  VEILED_CONTENT_CLASS,
  veiledContentWidth,
  type VeilProfile,
} from './heroStage';
import { HERO_FACE_POSITION } from './lockerUtils';

describe('the veil', () => {
  it('keeps the geometry the frame shipped with', () => {
    // The three blur radii and their tapers are a calibrated look, not an
    // arbitrary triple. Pinning them means a future edit has to be deliberate.
    expect(HERO_STAGE_VEIL.layers).toEqual([
      { blurPx: 48, saturatePct: 135, solidStopPct: 42, clearStopPct: 94 },
      { blurPx: 24, solidStopPct: 32, clearStopPct: 78 },
      { blurPx: 10, solidStopPct: 26, clearStopPct: 60 },
    ]);
    expect(HERO_STAGE_VEIL.widthCss).toBe('clamp(680px, 56vw, 1160px)');
  });

  it('softens rather than dropping off a cliff', () => {
    // Heaviest first, and each lighter layer must clear earlier than the one
    // below it, otherwise the effective blur ends on a hard edge.
    const layers = HERO_STAGE_VEIL.layers;
    for (let i = 1; i < layers.length; i += 1) {
      expect(layers[i].blurPx).toBeLessThan(layers[i - 1].blurPx);
      expect(layers[i].clearStopPct).toBeLessThan(layers[i - 1].clearStopPct);
      expect(layers[i].solidStopPct).toBeLessThan(layers[i - 1].solidStopPct);
    }
  });

  it('renders a layer as a blur plus a matching taper mask', () => {
    const [heaviest, middle] = HERO_STAGE_VEIL.layers;
    expect(veilLayerStyle(heaviest)).toEqual({
      backdropFilter: 'blur(48px) saturate(135%)',
      WebkitBackdropFilter: 'blur(48px) saturate(135%)',
      maskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 94%)',
      WebkitMaskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 94%)',
    });
    // Only the heaviest layer carries the saturation boost.
    expect(veilLayerStyle(middle).backdropFilter).toBe('blur(24px)');
  });
});

describe('the clear zone', () => {
  it('derives from the veil, not from a written-down constant', () => {
    expect(veilClearStopPct()).toBe(94);
    expect(clearZoneStart()).toBe('calc(clamp(680px, 56vw, 1160px) * 0.94)');
  });

  it('moves when the heaviest layer moves', () => {
    // The whole reason the token is derived: an edit to the mask cannot leave
    // the clear zone claiming the blur has finished when it has not.
    const shifted: VeilProfile = {
      ...HERO_STAGE_VEIL,
      layers: [{ blurPx: 48, solidStopPct: 42, clearStopPct: 80 }],
    };
    expect(clearZoneStart(shifted)).toBe('calc(clamp(680px, 56vw, 1160px) * 0.8)');
  });

  it('takes the widest stop, whatever order the layers are in', () => {
    const reordered: VeilProfile = {
      ...HERO_STAGE_VEIL,
      layers: [...HERO_STAGE_VEIL.layers].reverse(),
    };
    expect(veilClearStopPct(reordered)).toBe(94);
  });

  it('publishes itself as a custom property for descendants to read', () => {
    expect(heroStageVars()).toEqual({
      [CLEAR_ZONE_START_VAR]: clearZoneStart(),
      [VEILED_CONTENT_WIDTH_VAR]: veiledContentWidth(),
    });
  });
});

describe('the veiled content width', () => {
  it('is the clear zone less the rail and the pane padding', () => {
    expect(veiledContentWidth()).toBe('calc(calc(clamp(680px, 56vw, 1160px) * 0.94) - 364px)');
  });

  it('moves with the veil, like every other derived stage number', () => {
    const shifted: VeilProfile = {
      ...HERO_STAGE_VEIL,
      layers: [{ blurPx: 48, solidStopPct: 42, clearStopPct: 60 }],
    };
    expect(veiledContentWidth(shifted)).toBe('calc(calc(clamp(680px, 56vw, 1160px) * 0.6) - 364px)');
  });

  it('caps only at lg, and only where the stage published the variable', () => {
    // Below lg the plate and the veil are hidden, so there is nothing to avoid.
    // And with no variable set the declaration is invalid and max-width stays
    // none, which leaves Foundry's catalog mode uncapped.
    // The class is a literal so Tailwind's scanner can see it; this is what
    // stops the literal and the published variable from drifting apart.
    expect(VEILED_CONTENT_CLASS).toBe(`lg:max-w-[var(${VEILED_CONTENT_WIDTH_VAR})]`);
    expect(VEILED_CONTENT_CLASS).not.toContain('${');
  });
});

describe('plate resolution', () => {
  it('reads a skin backdrop as its own kind, not as an absent render', () => {
    expect(resolveHeroPlate('skin.png', 'render.png')).toEqual({
      kind: 'skinImage',
      src: 'skin.png',
    });
  });

  it('falls back to the render when no skin backdrop was handed over', () => {
    expect(resolveHeroPlate(undefined, 'render.png')).toEqual({
      kind: 'render',
      src: 'render.png',
    });
  });

  it('has no plate when the render chain has given up', () => {
    // The chain's final step is an empty string, and the frame draws the hero
    // name instead. Not an error state.
    expect(resolveHeroPlate(undefined, '')).toBeNull();
  });
});

describe('plate composition', () => {
  it('height-scales and right-anchors the render, which is a cutout', () => {
    const { className, usesRenderFallback } = heroPlateComposition({
      kind: 'render',
      src: 'r.png',
    });
    expect(className).toBe('absolute top-0 right-0 h-full w-auto max-w-none');
    expect(usesRenderFallback).toBe(true);
  });

  it('cover-fits a skin backdrop, which was authored as a backdrop', () => {
    const { className, style, usesRenderFallback } = heroPlateComposition({
      kind: 'skinImage',
      src: 's.png',
    });
    expect(className).toBe('absolute inset-0 h-full w-full object-cover');
    // Centred, and stated rather than inherited. The calibrated subject
    // position is for bundled renders; this art is mod-authored.
    expect(style).toEqual({ objectPosition: '50% 50%' });
    expect(usesRenderFallback).toBe(false);
  });

  it('gives the model the whole stage and no error chain', () => {
    const { className, usesRenderFallback } = heroPlateComposition({ kind: 'model' });
    expect(className).toBe('absolute inset-0');
    expect(usesRenderFallback).toBe(false);
  });

  it('arms the render fallback for the render plate only', () => {
    const kinds = ['render', 'skinImage', 'model'] as const;
    expect(kinds.filter((kind) => heroPlateComposition({ kind }).usesRenderFallback)).toEqual([
      'render',
    ]);
  });
});

describe('the subject position', () => {
  it('reads the calibrated table rather than a second one', () => {
    expect(heroSubjectX('Abrams')).toBe(HERO_FACE_POSITION.Abrams.x);
    expect(heroSubjectX('Infernus')).toBe(HERO_FACE_POSITION.Infernus.x);
  });

  it('falls back to the shared default for an uncalibrated hero', () => {
    expect(heroSubjectX('Not A Hero')).toBe(55);
    expect(heroSubjectX(null)).toBe(55);
  });

  it('spans nearly the full width across the roster', () => {
    // If this ever collapses toward the centre the token has stopped carrying
    // information and the plates may as well stay anchored.
    const xs = Object.values(HERO_FACE_POSITION).map((position) => position.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(100);
  });
});
