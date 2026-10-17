import type { AbilitySlot, ActiveHeroColor, AbilitySoundParams } from './mod';
export interface HeroAbilityPreview {
  slot: AbilitySlot;
  label: string;
  token: string;
  clip: string | null;
  clipChoices?: string[];
  soundPath: string | null;
  /** Exact entry when the join is unambiguous; null means unavailable. */
  particlePath: string | null;
}
export interface HeroAbilityPreviewOptions {
  sourceMode?: 'base' | 'applied';
  clipName?: string;
  skinSources?: import('./portrait').HeroPoseSkinSource[];
  fallbackSkinMetaKey?: string;
}
export interface HeroAbilityPlayback {
  ability: HeroAbilityPreview;
  modelUrl: string | null;
  soundUrl: string | null;
  soundSource: 'base' | 'applied' | 'unavailable';
  soundParams?: AbilitySoundParams;
  skinApplied: boolean;
  skinFallback: boolean;
  effect: import('./assetInspection').AssetInspectionResult | null;
  recolor: ActiveHeroColor | null;
  /** Exact exported animation metadata. Slot/effect associations remain unverified. */
  clipEvents?: import('./abilityEvents').EmbeddedClipEventMetadata | null;
}
