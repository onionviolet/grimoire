/**
 * Portrait-family authoring model (pure).
 *
 * A hero portrait is never one file. The catalog ships a family of state
 * variants (normal card, low-HP, gloat, minimap, ...), and
 * `visualAssetInspectionPaths` already groups them so the staging preflight
 * inspects the whole family at once. Until now the authoring surface ignored
 * that: a user dropped one PNG on one entry and the other variants silently kept
 * the stock art, even though the preflight had just warned about every one of
 * them.
 *
 * This module makes the family explicit and keeps two rules honest:
 *
 * 1. **The family is whatever the preflight says it is.** Variants are derived
 *    from `visualAssetInspectionPaths` / `portraitFamilyKey`, never re-guessed
 *    from labels or hero names, so the editor can never stage a narrower set
 *    than the preflight warned about.
 * 2. **The editor authors an image; it does not install one.** Every staged
 *    result goes through `prepareVisualStagedEdit` unchanged, so the unreadable
 *    VPK block and the enabled-owner acknowledgement apply exactly as they do
 *    for a plain PNG drop.
 *
 * Everything here is pure and DOM-free so it is unit-testable; the React surface
 * (`PortraitEditor.tsx`) only supplies canvas output and IPC callbacks.
 */
import type { FoundryAssetSourcesInspection, TextureEntry } from '../../types/foundry';
import {
  portraitFamilyKey,
  prepareVisualStagedEdit,
  visualAssetInspectionPaths,
  type VisualStagedEdit,
} from './visualEdits';

/**
 * The minimum a family member has to be for the coverage reasoning to apply: it
 * has to name the exact entry it writes. `TextureEntry` satisfies this, and so
 * does the Locker's `CustomCardSlot` (whose `entry` is a real VPK entry path),
 * which is what lets both surfaces share the reasoning without sharing a
 * component. Only `portraitFamilyVariants` needs a full catalog entry, because
 * only it derives the family from the catalog.
 */
export interface PortraitFamilyItem {
  path: string;
}

/** One discovered member of a portrait family. `item` is the catalog entry, so
 *  the exact entry path stays the ownership key throughout. */
export interface PortraitVariant<T extends PortraitFamilyItem = TextureEntry> {
  item: T;
  /** The exact, normalized VPK entry path this variant writes. */
  path: string;
  /** Filename state suffix that distinguishes it inside the family ("base" for
   *  the unsuffixed member). Display only: never an ownership key. */
  key: string;
  /** True for the entry the user opened the editor from. */
  anchor: boolean;
}

/** The state suffixes the catalog actually uses, mirrored from the family-key
 *  stripper in visualEdits. Anything else keeps its raw suffix as its label. */
const KNOWN_VARIANT_KEYS: ReadonlySet<string> = new Set([
  'base',
  'card',
  'portrait',
  'low_hp',
  'gloat',
  'minimap',
]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function basename(path: string): string {
  const normalized = normalizePath(path).toLowerCase();
  return normalized.slice(normalized.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
}

/**
 * Which state inside its family a portrait path is: the part of the filename the
 * family key strips. `mina_card_low_hp.png` in the `.../mina` family is
 * `card_low_hp`; an unsuffixed `mina.png` is `base`.
 */
export function portraitVariantKey(path: string): string {
  const base = basename(path);
  const family = portraitFamilyKey(path);
  const familyBase = family.slice(family.lastIndexOf('/') + 1);
  const suffix = base.startsWith(familyBase) ? base.slice(familyBase.length) : '';
  return suffix.replace(/^[_-]+/, '').replace(/-/g, '_') || 'base';
}

/** Translation key for a variant, or null when the suffix is not one the catalog
 *  is known to use (the caller then shows the raw suffix rather than inventing
 *  a friendly name for something it did not recognize). */
export function portraitVariantLabelKey(key: string): string | null {
  return KNOWN_VARIANT_KEYS.has(key) ? `portraitEditor.variants.${key}` : null;
}

/**
 * Every discovered variant of the anchor entry's family, in the exact order (and
 * with exactly the membership) the staging preflight inspects.
 *
 * A non-portrait entry is a family of one: the editor still previews and crops
 * it, it simply has nothing else to apply across.
 */
export function portraitFamilyVariants<T extends TextureEntry>(
  anchor: T,
  catalog: readonly T[],
): PortraitVariant<T>[] {
  const anchorPath = normalizePath(anchor.path);
  const paths = visualAssetInspectionPaths(anchor, catalog);
  const byPath = new Map(catalog.map((entry) => [normalizePath(entry.path), entry]));
  const seen = new Set<string>();
  const variants: PortraitVariant<T>[] = [];
  for (const raw of paths) {
    const path = normalizePath(raw);
    if (seen.has(path)) continue;
    seen.add(path);
    const item = byPath.get(path) ?? anchor;
    variants.push({ item, path, key: portraitVariantKey(path), anchor: path === anchorPath });
  }
  // The anchor is what the user clicked, so lead with it; the rest keep catalog
  // order. Membership is untouched, only presentation order.
  return variants.sort((a, b) => Number(b.anchor) - Number(a.anchor));
}

/** Normalized (source-fraction) crop rect, the shape LockerImageCropper emits. */
export interface PortraitCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

/** A source rect in natural pixels plus the exact output size to bake at. */
export interface PortraitBakeRect extends PortraitCrop, PixelSize {}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a normalized crop onto the source's real pixels and the **template's** real
 * pixel size.
 *
 * This is the whole point of previewing against the real target: the output is
 * baked at the dimensions read from the game's own texture, not at whatever size
 * the on-screen crop frame happened to be, so what the card shows is what the
 * editor showed.
 */
export function cropToTargetRect(
  crop: PortraitCrop,
  natural: PixelSize,
  target: PixelSize,
): PortraitBakeRect {
  const natW = Math.max(1, natural.width);
  const natH = Math.max(1, natural.height);
  const sx = clamp(crop.sx * natW, 0, natW);
  const sy = clamp(crop.sy * natH, 0, natH);
  return {
    sx,
    sy,
    sw: clamp(crop.sw * natW, 1, natW - sx),
    sh: clamp(crop.sh * natH, 1, natH - sy),
    width: Math.max(1, Math.round(target.width)),
    height: Math.max(1, Math.round(target.height)),
  };
}

/** Which image a single variant will be written from, and where it came from. */
export interface PortraitFamilyPlanEntry<T extends PortraitFamilyItem = TextureEntry> {
  variant: PortraitVariant<T>;
  imagePath: string;
  origin: 'family' | 'override';
}

/**
 * Resolve the family image and any per-variant overrides into one decision per
 * variant. A per-variant override always wins over the family image; a variant
 * with neither is deliberately absent from the plan rather than defaulted, so
 * the coverage check below can refuse the whole stage.
 */
export function planPortraitFamilyEdits<T extends PortraitFamilyItem>(
  variants: readonly PortraitVariant<T>[],
  familyImagePath: string | null,
  overrides: Readonly<Record<string, string>> = {},
): PortraitFamilyPlanEntry<T>[] {
  const plan: PortraitFamilyPlanEntry<T>[] = [];
  for (const variant of variants) {
    const override = overrides[variant.path]?.trim();
    if (override) {
      plan.push({ variant, imagePath: override, origin: 'override' });
      continue;
    }
    const family = familyImagePath?.trim();
    if (family) plan.push({ variant, imagePath: family, origin: 'family' });
  }
  return plan;
}

/**
 * Variants the current selection would leave untouched. The preflight inspects
 * the whole family, so staging a subset would quietly under-deliver against the
 * warning the user just acknowledged: the caller blocks on a non-empty result.
 */
export function portraitFamilyCoverageGap<T extends PortraitFamilyItem>(
  variants: readonly PortraitVariant<T>[],
  familyImagePath: string | null,
  overrides: Readonly<Record<string, string>> = {},
): string[] {
  const covered = new Set(planPortraitFamilyEdits(variants, familyImagePath, overrides).map((entry) => entry.variant.path));
  return variants.map((variant) => variant.path).filter((path) => !covered.has(path));
}

export interface PortraitStageContext<T extends TextureEntry = TextureEntry> {
  variants: readonly PortraitVariant<T>[];
  catalog: readonly T[];
  familyImagePath: string | null;
  overrides?: Readonly<Record<string, string>>;
  /** Display name for the staged edit of one variant. */
  name: (entry: PortraitFamilyPlanEntry<T>) => string;
  inspect: (paths: string[]) => Promise<FoundryAssetSourcesInspection>;
  confirm: (modNames: string[]) => boolean;
  unreadableMessage: string;
  /** Shown when the selection would not cover the whole inspected family. */
  coverageMessage: string;
  heroName?: string;
}

/**
 * Stage one edit per family variant, each through `prepareVisualStagedEdit`
 * unchanged.
 *
 * The editor deliberately has no install path of its own: every check that
 * guards a plain PNG drop (unreadable VPK blocks outright, an enabled owner needs
 * an explicit acknowledgement) runs here identically. Two things are collapsed so
 * the family does not multiply them: the exact-path inspection is memoized per
 * path set (every variant of one family inspects the same set), and the
 * acknowledgement is asked once and reused.
 *
 * Returns null when the user declines that acknowledgement, and stages nothing at
 * all in that case: a partially staged family is exactly the narrower set this
 * lane exists to prevent.
 */
export async function stagePortraitFamily<T extends TextureEntry>(
  context: PortraitStageContext<T>,
): Promise<VisualStagedEdit[] | null> {
  const gap = portraitFamilyCoverageGap(context.variants, context.familyImagePath, context.overrides);
  if (gap.length > 0) throw new Error(context.coverageMessage);

  const plan = planPortraitFamilyEdits(context.variants, context.familyImagePath, context.overrides);
  if (plan.length === 0) return [];

  const inspected = new Map<string, Promise<FoundryAssetSourcesInspection>>();
  const inspect = (paths: string[]): Promise<FoundryAssetSourcesInspection> => {
    const key = paths.join('\n');
    const cached = inspected.get(key);
    if (cached) return cached;
    const pending = context.inspect(paths);
    inspected.set(key, pending);
    return pending;
  };

  let acknowledged: boolean | null = null;
  const confirm = (modNames: string[]): boolean => {
    if (acknowledged === null) acknowledged = context.confirm(modNames);
    return acknowledged;
  };

  const staged: VisualStagedEdit[] = [];
  for (const entry of plan) {
    const edit = await prepareVisualStagedEdit({
      item: entry.variant.item,
      catalog: context.catalog,
      imagePath: entry.imagePath,
      name: context.name(entry),
      inspect,
      confirm,
      unreadableMessage: context.unreadableMessage,
      heroName: context.heroName,
    });
    if (!edit) return null;
    staged.push(edit);
  }
  return staged;
}
