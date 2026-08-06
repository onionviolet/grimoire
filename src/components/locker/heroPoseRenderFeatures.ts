// Rigged (animated, skinned) preview shipped in released builds as of RP-03
// in docs/ingame-verification-record.md: the measured frame-time delta on
// Seven, the worst case on every axis, landed within the ship band (see
// docs/rigged-preview-spike.md section 9). RELEASE_RENDER_FLAGS.rigged in
// HeroPoseViewer.tsx carries that decision.
//
// This module constant is a separate manual override for auditioning rigged
// alone in dev without going through the release flag or the Leva Cloth
// checkbox. It stays false because the release flag already turns rigged on;
// flip it locally only when testing a build where RELEASE_RENDER_FLAGS.rigged
// is temporarily false.
const USE_RIGGED_PREVIEW: boolean = false;

export interface HeroPoseDevFlags {
  unified: boolean;
  celV2: boolean;
  cloth: boolean;
  /** Play the hero's own animated clip on a skinned rig, without cloth. */
  rigged: boolean;
  bloom: boolean;
  nprDebug: boolean;
  matDebug: boolean;
}

export interface HeroPoseRenderFeatures {
  unifiedEnabled: boolean;
  celV2Enabled: boolean;
  clothPreviewEnabled: boolean;
  bloomEnabled: boolean;
  riggedPreviewEnabled: boolean;
  source2ShaderHintsEnabled: boolean;
  nprDebugEnabled: boolean;
  source2SkipNpr: boolean;
  nprMaterialsEnabled: boolean;
}

// `unified` is the single material-styling driver: it builds each material via
// buildDeadlockMaterial (Source 2 hints + NPR cel/rim/tint collapsed into one
// pass). The standalone Source 2 / NPR toggles were removed; both renderers now
// mount iff unified is on. Turn unified off to compare against the raw GLB.
export function resolveHeroPoseRenderFeatures(
  flags: HeroPoseDevFlags,
  trippySpriteActive: boolean
): HeroPoseRenderFeatures {
  const clothPreviewEnabled = flags.cloth;
  const unifiedEnabled = flags.unified;

  return {
    unifiedEnabled,
    celV2Enabled: flags.celV2,
    clothPreviewEnabled,
    bloomEnabled: flags.bloom,
    // Cloth implies rigged (a sim needs a skeleton to hang off), but the
    // converse is not true. Keeping cloth as the only way in meant rigged could
    // never be auditioned on its own: switching it on started the WIP cloth sim
    // too, so any frame-cost reading measured both at once.
    riggedPreviewEnabled: USE_RIGGED_PREVIEW || flags.rigged || clothPreviewEnabled,
    source2ShaderHintsEnabled: unifiedEnabled,
    nprDebugEnabled: flags.nprDebug,
    source2SkipNpr: unifiedEnabled && !trippySpriteActive,
    // Trippy/tattoo paint replaces the material maps, but unified still owns the
    // Source 2 shader path: self-illum masks, CelV2, and pulse uniforms live there.
    nprMaterialsEnabled: unifiedEnabled,
  };
}
