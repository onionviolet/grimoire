import type { CSSProperties } from 'react';
import { getHeroFacePosition } from './lockerUtils';

/**
 * The composition of the hero stage: the plate (what fills the full-bleed
 * backdrop), the veil (the feathered frosted-glass stack over its left side),
 * and the clear zone (the strip to the right of the veil where nothing is
 * blurred).
 *
 * Three things compete for the same right-hand pixels: the 2D backdrop art, the
 * frosted veil, and the 3D model panel. They were not reconciled even on the 2D
 * side. `HeroDetailFrame` chose the backdrop's anchoring by asking whether a
 * `backdropImage` prop happened to be set, which is one slot serving two
 * incompatible contracts, and the veil's geometry lived as four literals inside
 * the JSX, so the number that says "the blur has finished" was not derivable
 * from anything.
 *
 * Nothing else computes these numbers. A new occupant of the stage (the model)
 * declares a plate kind here rather than being drawn on top of whatever the
 * slot inferred.
 *
 * Deliberately free of stores, mod types and Foundry types, like the frame it
 * serves. It is also neutral between the three Locker/Foundry architectures
 * scored in `docs/global-locker-foundry-ux-plan.md`: it owns composition and
 * reads no state, so it survives whichever shape wins.
 *
 * Not the only frosted veil in the app: the Locker grid (`Locker.tsx`) has a
 * sibling with the same three blur radii and deliberately shorter tapers,
 * because it backs a 300px sidebar rather than a 300px rail plus a 480px
 * content pane. That divergence is intentional. Do not unify them by pointing
 * the grid at `HERO_STAGE_VEIL`; give it its own profile if it ever needs one.
 */

/**
 * One `backdrop-filter` layer of the veil. Stacking blurs compounds, so a
 * region under all three is far more blurred than one under the lightest only.
 * Each layer's mask fades out at a different stop, which is what makes the
 * effective blur soften from heavy through medium to nothing instead of
 * dropping off a cliff.
 */
export interface VeilLayer {
  blurPx: number;
  /** Saturation boost, percent. Only the heaviest layer carries one. */
  saturatePct?: number;
  /** Percent of the veil width where the layer is still fully opaque. */
  solidStopPct: number;
  /** Percent of the veil width where the layer has faded to nothing. */
  clearStopPct: number;
}

export interface VeilProfile {
  /**
   * Tailwind width class for the veil container. Intentionally much wider than
   * the panels it backs so the gradient has runway to feather all the way to
   * clear without swallowing more of the plate as the window narrows.
   */
  widthClass: string;
  /** The same width as a CSS length, so the clear zone can be derived from it. */
  widthCss: string;
  /** Heaviest first. The clear zone is derived from the heaviest layer. */
  layers: readonly VeilLayer[];
  /** The flat tint under the blurs, carrying the panel colour out to nothing. */
  tint: string;
}

export const HERO_STAGE_VEIL: VeilProfile = {
  widthClass: 'w-[clamp(680px,56vw,1160px)]',
  widthCss: 'clamp(680px, 56vw, 1160px)',
  layers: [
    { blurPx: 48, saturatePct: 135, solidStopPct: 42, clearStopPct: 94 },
    { blurPx: 24, solidStopPct: 32, clearStopPct: 78 },
    { blurPx: 10, solidStopPct: 26, clearStopPct: 60 },
  ],
  tint:
    'linear-gradient(to right, var(--color-bg-secondary) 0%, rgba(26,26,26,0.95) 40%, rgba(26,26,26,0.75) 58%, rgba(26,26,26,0.4) 74%, rgba(26,26,26,0.15) 87%, transparent 97%)',
};

/** The inline style for one veil layer: its blur and its taper mask. */
export function veilLayerStyle(layer: VeilLayer): CSSProperties {
  const filter = layer.saturatePct
    ? `blur(${layer.blurPx}px) saturate(${layer.saturatePct}%)`
    : `blur(${layer.blurPx}px)`;
  const mask = `linear-gradient(to right, black 0%, black ${layer.solidStopPct}%, transparent ${layer.clearStopPct}%)`;
  return {
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    WebkitMaskImage: mask,
    maskImage: mask,
  };
}

/**
 * Where the veil has finished: the heaviest layer's transparent stop, as a
 * percent of the veil width.
 *
 * Derived rather than written down, because the whole point of the token is
 * that it cannot disagree with the mask. Editing a `clearStopPct` above moves
 * this with it.
 */
export function veilClearStopPct(profile: VeilProfile = HERO_STAGE_VEIL): number {
  return Math.max(...profile.layers.map((layer) => layer.clearStopPct));
}

/**
 * The left edge of the clear zone, as a CSS length measured from the left of
 * the stage.
 *
 * This derives from the veil, never from the content pane. Foundry passes
 * `contentWidth="fluid"` and the Locker passes `capped`, so a clear zone
 * measured against the pane would put the two surfaces in different places and
 * they would diverge again. Anything that must stay unblurred (the model
 * stage, a centred empty state) belongs to the right of this.
 */
export function clearZoneStart(profile: VeilProfile = HERO_STAGE_VEIL): string {
  return `calc(${profile.widthCss} * ${veilClearStopPct(profile) / 100})`;
}

/**
 * Everything between the left edge of the stage and the left edge of the
 * content the pane actually lays out: the rail, plus the pane's own padding.
 *
 * The rail is `lg:w-[300px] xl:w-[340px]`, so a single number cannot be exact
 * at both breakpoints. The **wider** one is the safe choice, because the
 * available width is the clear zone minus this offset: assuming a narrow rail
 * over-states how much room is left and pushes content back onto the hero's
 * face, which is the exact failure this token exists to prevent. Assuming the
 * wide rail merely leaves 40px of unused glass at `lg`.
 *
 * The pane's `p-6` counts too. Measured against the live veil at 1440px, the
 * cap without it still overhung the clear stop by exactly those 24px.
 */
const RAIL_WIDTH_PX = 340;
const CONTENT_PADDING_PX = 24;
const CONTENT_OFFSET_CSS = `${RAIL_WIDTH_PX + CONTENT_PADDING_PX}px`;

/**
 * How wide content inside the content pane can be while staying entirely to the
 * left of the veil's clear stop, measured from the pane's own left edge.
 *
 * This is what a self-centring block needs. Foundry passes
 * `contentWidth="fluid"`, so its pane runs the full width of the stage while
 * the veil stops at 94% of `clamp(680px, 56vw, 1160px)`. A block that centres
 * itself in that pane lands on unblurred hero art: in the 2026-07-30 matrix,
 * white body text sat on Mina's face. Capping the block to this width and
 * left-aligning it puts it back on the glass.
 */
export function veiledContentWidth(profile: VeilProfile = HERO_STAGE_VEIL): string {
  return `calc(${clearZoneStart(profile)} - ${CONTENT_OFFSET_CSS})`;
}

/**
 * Published on the frame root so descendants can respect the clear zone
 * without importing the veil or recomputing its stops.
 */
export const CLEAR_ZONE_START_VAR = '--hero-stage-clear-zone-start';
export const VEILED_CONTENT_WIDTH_VAR = '--hero-stage-veiled-content-width';

export function heroStageVars(profile: VeilProfile = HERO_STAGE_VEIL): CSSProperties {
  return {
    [CLEAR_ZONE_START_VAR]: clearZoneStart(profile),
    [VEILED_CONTENT_WIDTH_VAR]: veiledContentWidth(profile),
  } as CSSProperties;
}

/**
 * Class for a block that must stay inside the veil.
 *
 * A class rather than an inline style because the cap is only correct at `lg`
 * and up. Below that the frame stacks into a column and the plate and veil are
 * `hidden`, so there is no hero art to avoid and capping the block would just
 * make it a narrow column for no reason.
 *
 * No `var()` fallback on purpose. Off the hero stage the variable is unset, the
 * declaration is invalid at computed-value time, and `max-width` stays `none`:
 * uncapped, which is exactly right for Foundry's catalog mode.
 *
 * Written out as a literal rather than interpolated from
 * `VEILED_CONTENT_WIDTH_VAR`: Tailwind scans source text for class names, and an
 * interpolated one is invisible to it, so the utility is simply never generated
 * and `max-width` silently stays `none`. A test asserts the two agree.
 */
export const VEILED_CONTENT_CLASS = 'lg:max-w-[var(--hero-stage-veiled-content-width)]';

/**
 * What is filling the stage.
 *
 * - `render`: the bundled hero render (or its wiki/icon fallbacks). Authored as
 *   a cutout, so it is height-scaled and right-anchored, and whatever is left
 *   to its left shows the solid `bg-primary` that the veil reads as a frosted
 *   panel.
 * - `skinImage`: a per-skin backdrop, authored as a backdrop rather than a
 *   cutout, so it is cover-fitted across the whole stage.
 * - `model`: a live 3D canvas. Fills the stage and frames itself with a camera
 *   rather than with CSS.
 */
export type HeroPlateKind = 'render' | 'skinImage' | 'model';

export interface HeroPlate {
  kind: HeroPlateKind;
  /** The image to draw. Absent on `model`, which paints into a canvas. */
  src?: string;
}

/**
 * The typed descriptor that replaces "is `backdropImage` set". The caller
 * declares what it handed over; the stage no longer infers it from the shape of
 * a prop.
 */
export function resolveHeroPlate(
  backdropImage: string | undefined,
  renderSrc: string
): HeroPlate | null {
  if (backdropImage) return { kind: 'skinImage', src: backdropImage };
  if (renderSrc) return { kind: 'render', src: renderSrc };
  return null;
}

export interface HeroPlateComposition {
  className: string;
  style?: CSSProperties;
  /**
   * Whether the four-step render fallback chain applies. Only the `render`
   * plate degrades; a skin backdrop that fails to load is the caller's problem
   * and a canvas has no `onError`.
   */
  usesRenderFallback: boolean;
}

export function heroPlateComposition(plate: HeroPlate): HeroPlateComposition {
  switch (plate.kind) {
    case 'skinImage':
      return {
        className: 'absolute inset-0 h-full w-full object-cover',
        // Centred on purpose, and stated rather than inherited from the CSS
        // initial value. `heroSubjectX` is NOT used here: it was calibrated
        // against the bundled hero renders, and this art is mod-authored with
        // its own framing.
        style: { objectPosition: '50% 50%' },
        usesRenderFallback: false,
      };
    case 'model':
      return { className: 'absolute inset-0', usesRenderFallback: false };
    case 'render':
    default:
      return {
        className: 'absolute top-0 right-0 h-full w-auto max-w-none',
        usesRenderFallback: true,
      };
  }
}

/**
 * Where the hero's face sits horizontally, as a percent of the art's width.
 *
 * `HERO_FACE_POSITION` holds hand-calibrated values for 38 heroes and is
 * consumed by the Locker grid, Browse, Installed and the sidebar. The hero
 * stage, the one surface where the hero art is the subject rather than a
 * decoration, was the only consumer flying blind. This is the seam that fixes
 * that.
 *
 * Two consumers, both framing the same calibrated subject:
 *
 * - the 3D camera target, so the model lands where the 2D art was calibrated to
 *   and no second table is needed;
 * - any future cover-fitted 2D plate's `object-position`.
 *
 * It is deliberately inert on the plates as they stand today: the `render`
 * plate is height-scaled with no `object-fit`, so an `object-position` would do
 * nothing, and re-anchoring it would re-frame all 38 heroes at once, which is a
 * design change and not a refactor.
 */
export function heroSubjectX(heroName: string | null | undefined): number {
  return getHeroFacePosition(heroName).x;
}
