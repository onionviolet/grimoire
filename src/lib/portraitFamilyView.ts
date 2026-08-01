/**
 * The one portrait-family view model, consumed by both the Locker and Foundry.
 *
 * This is item 9 of #10 Part 2 and the seam the A2d decision commits to. It
 * exists because the 2026-07-30 screenshot matrix caught the two surfaces
 * disagreeing about the picture on the screen, not merely about a count:
 *
 * - Foundry drew Mina's stock `vampirebat_card_psd.vtex_c` as though it were
 *   current, while the Locker, same hero and same session, reported
 *   `Lucy Cyberpunk Edgerunners as Mina` winning that exact path. So a family
 *   view carries `stockImage` and `currentImage` as separate fields, and a
 *   surface that cannot decode the winner's art says "overridden" rather than
 *   showing stock art with no qualification.
 * - Two mods were both badged `winner` in one flat list, because a badge did not
 *   carry the path it won. So a winner here is always `(variant, source)`.
 * - The same mod was called `pak27` above and
 *   `Lucy Cyberpunk Edgerunners as Mina` four rows below. So a source has one
 *   `name`, and the file name is a separate, secondary field.
 *
 * Deliberately excluded: staging, cropping and build state. A2d-lane records
 * that teaching this model about authoring would close the door back to the
 * hard split, because a Locker that does not author could no longer consume it.
 * It therefore reads no store and knows nothing about either domain's actions.
 *
 * Layering note: this lives in `lib/` with the other shared pure models
 * (`portraitInventory`, `heroPortraitIdentity`, `heroStage`) and imports two
 * pure key functions from the Foundry authoring model. That direction is
 * deliberate: `portraitFamilyKey` is the definition of a family that the
 * staging preflight uses, and re-deriving it here would create exactly the
 * second derivation (S1) this module exists to remove.
 */
import { portraitFamilyKey, stripPortraitFileTokens } from '../components/foundry/visualEdits';
import { displayNameForHeroCodename, resolvePortraitHero } from './heroPortraitIdentity';
import type { PortraitProvenance } from './portraitInventory';

/** Canonical variant vocabulary. The base-card manifest says `minimap`/`small`
 *  and the compiled catalog path says `mm`/`sm`; both mean one variant, so the
 *  view model picks one spelling and both surfaces label from it. */
const VARIANT_SYNONYMS: Readonly<Record<string, string>> = {
  mm: 'minimap',
  sm: 'small',
  low_hp: 'card_critical',
  critical: 'card_critical',
  gloat: 'card_gloat',
};

/** Every canonical variant that has a translated label. A token outside this
 *  set is shown raw rather than given an invented friendly name. */
const KNOWN_VARIANTS: ReadonlySet<string> = new Set([
  'base',
  'portrait',
  'card',
  'vertical',
  'card_critical',
  'card_gloat',
  'minimap',
  'small',
  'other',
]);

/** Display order: the full card reads first, then roughly by prominence. */
const VARIANT_ORDER = [
  'card',
  'base',
  'portrait',
  'vertical',
  'card_critical',
  'card_gloat',
  'minimap',
  'small',
  'other',
];

export function normalizePortraitVariant(raw: string | null | undefined): string {
  if (!raw) return 'other';
  const token = raw.trim().toLowerCase().replace(/-/g, '_');
  return VARIANT_SYNONYMS[token] ?? token;
}

/** Translation key for a canonical variant, or null when the token is one this
 *  build does not recognize (the caller then shows the raw token). */
export function portraitVariantLabelKey(variant: string): string | null {
  return KNOWN_VARIANTS.has(variant) ? `portrait.variants.${variant}` : null;
}

/**
 * The name to show for one variant: its translated label, plus the file stem
 * when the family contains another member under the same name.
 */
export function portraitVariantDisplay(
  label: string,
  variant: Pick<PortraitVariantView, 'distinguisher'>,
): string {
  return variant.distinguisher ? `${label} (${variant.distinguisher})` : label;
}

export function portraitVariantRank(variant: string): number {
  const index = VARIANT_ORDER.indexOf(variant);
  return index === -1 ? VARIANT_ORDER.length : index;
}

export function normalizePortraitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/**
 * Which state inside its family a portrait path is: the part of the filename
 * the family key strips. `mina_card_low_hp.png` in the `.../mina` family is
 * `card_low_hp`; an unsuffixed `mina.png` is `base`.
 *
 * Not normalized: this returns the catalog's own spelling (`mm`, `sm`), which
 * `portraitFamilyVariants` still keys on. Call `normalizePortraitVariant` on
 * the result when the answer is going to be shown to a person.
 */
export function portraitVariantKey(path: string): string {
  // Diff against the family stem with the pak's hash/format tail removed, so
  // `astro_card_gloat_psd` reads as the `card_gloat` state, not `card_gloat_psd`.
  const normalized = normalizePortraitPath(path);
  const base = stripPortraitFileTokens(normalized.slice(normalized.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''));
  const family = portraitFamilyKey(path);
  const familyBase = family.slice(family.lastIndexOf('/') + 1);
  const suffix = base.startsWith(familyBase) ? base.slice(familyBase.length) : '';
  return suffix.replace(/^[_-]+/, '').replace(/-/g, '_') || 'base';
}

/** One member of a base-game portrait family, as the surface discovered it.
 *  The Locker builds these from `getCustomCardSlots` (one hero, so it never
 *  copies the catalog: #10 Part 2 item 7); Foundry builds them from the
 *  hero-image catalog it already loads. */
export interface PortraitFamilySlotInput {
  /** Exact `.vtex_c` entry path. The only ownership key in this model. */
  path: string;
  /** The caller's own variant spelling, when it has one. Round-tripped back
   *  out as `sourceVariant` so an apply call keeps using the caller's token. */
  variant?: string;
  width?: number;
  height?: number;
  /** The base game's art, when the surface could decode it. */
  stockImage?: string | null;
  /** Panorama codename the catalog filed this entry under. */
  hero?: string | null;
  /** Human label the catalog carries for the entry, if any. */
  label?: string | null;
}

/** An installed claimant. One row per mod, named the way the user named it. */
export interface PortraitSourceInput {
  /** Whatever key the surface uses to identify the mod's file: `metaKey` or
   *  `modFileName`. Candidate images and winners are keyed on this. */
  sourceKey: string;
  /** Store id, when known, so a surface can deep-link into Installed. */
  modId?: string | null;
  /** The mod's display name. Never a `pakNN` file name: that is `fileName`. */
  name: string;
  fileName?: string | null;
  enabled: boolean;
  priority?: number | null;
  provenance?: PortraitProvenance | null;
}

/** One installed mod's decoded art for one variant, when the surface has it. */
export interface PortraitCandidateInput {
  sourceKey: string;
  /** Any spelling; normalized here. */
  variant: string;
  image: string;
}

export interface PortraitFamilyViewInput {
  /** Display hero name. Used for labels and for alias reporting. */
  heroName?: string | null;
  slots: readonly PortraitFamilySlotInput[];
  sources?: readonly PortraitSourceInput[];
  candidates?: readonly PortraitCandidateInput[];
  /**
   * Exact entry path -> the `sourceKey` the game will actually read, from the
   * single claims index. `null` means the path was inspected and nothing
   * installed claims it. A path absent from the record was not inspected,
   * which is a different thing and is reported as `unknown`.
   */
  winners?: Readonly<Record<string, string | null>>;
  /** Exact entry path -> every `sourceKey` claiming it, enabled or not. */
  claims?: Readonly<Record<string, readonly string[]>>;
}

/**
 * What the game will draw for one variant.
 *
 * `unknown` is a first-class answer and not a failure: Foundry's catalog mode
 * lists thousands of entries and does not inspect installed VPKs for all of
 * them. Saying "not checked" is the honest reading, and it is what stops a
 * surface from rendering stock art as current.
 */
export type PortraitVariantStatus = 'stock' | 'installed' | 'disabled' | 'conflict' | 'unknown';

export interface PortraitVariantView {
  /** Canonical variant token. */
  key: string;
  /**
   * File stem, set only when another member of the same family normalizes to
   * the same variant token. The compiled catalog really does ship two entries
   * that both read as one variant (a format or hash-suffixed duplicate), and
   * both are separate ownership keys: they cannot be collapsed. Labelling them
   * identically would put two rows called "Compact portrait" in one list with
   * different states, which is the same illegibility as two bare `winner`
   * badges. Null whenever the variant name is already unambiguous.
   */
  distinguisher: string | null;
  /** The caller's own spelling, for round-tripping into an apply call. */
  sourceVariant: string | null;
  /** Exact normalized `.vtex_c` entry path. */
  path: string;
  width: number | null;
  height: number | null;
  /** The base game's art. */
  stockImage: string | null;
  /**
   * What the game will draw. Equal to `stockImage` when nothing installed wins
   * this path, the winner's decoded art when the surface had it, and null when
   * something wins but this surface cannot decode it. A null with a non-stock
   * status is the case that must not be papered over with the stock image.
   */
  currentImage: string | null;
  status: PortraitVariantStatus;
  /** The claimant the game reads, when one was established. */
  winner: PortraitSourceInput | null;
  /** Every claimant of this exact path, winner first. */
  claimants: PortraitSourceInput[];
}

export type PortraitFamilyStatus = PortraitVariantStatus;

export interface PortraitFamilyView {
  /** The family stem shared by every member: stable list key and deep-link id. */
  key: string;
  /** Panorama codename, when the input carried one. */
  heroCodename: string | null;
  /** Resolved display name, falling back to the input hero then the codename. */
  heroName: string | null;
  /** Every panorama folder that can carry this hero's portraits. */
  aliases: readonly string[];
  /** The member that represents the family (the recognizable state). */
  base: PortraitVariantView;
  variants: PortraitVariantView[];
  /** Worst status across the family, so one card can state it once. */
  status: PortraitFamilyStatus;
  /** Distinct installed claimants across the whole family, winners first. */
  sources: PortraitSourceInput[];
  /** One row per won path, so a badge can never lose the path it won. */
  winners: Array<{ variant: PortraitVariantView; source: PortraitSourceInput }>;
}

/** Which member represents a family, most recognizable state first. */
const BASE_PREFERENCE = ['card', 'base', 'portrait', 'vertical'];

/** Ordered worst-last, so a family reports the most alarming member's state. */
const STATUS_SEVERITY: Readonly<Record<PortraitVariantStatus, number>> = {
  stock: 0,
  unknown: 1,
  disabled: 2,
  installed: 3,
  conflict: 4,
};

function severest(statuses: readonly PortraitVariantStatus[]): PortraitVariantStatus {
  let worst: PortraitVariantStatus = 'stock';
  for (const status of statuses) {
    if (STATUS_SEVERITY[status] > STATUS_SEVERITY[worst]) worst = status;
  }
  return worst;
}

function compareSources(a: PortraitSourceInput, b: PortraitSourceInput): number {
  return (
    Number(b.enabled) - Number(a.enabled) ||
    (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Fold one hero's (or one catalog's) portrait slots, installed claimants and
 * claims index into one view per family.
 *
 * Everything here is derived; nothing is guessed. A path with no entry in
 * `winners` comes out `unknown` rather than `stock`, because "nobody asked" and
 * "nobody claims it" are the two answers the matrix showed being conflated.
 */
export function buildPortraitFamilyViews(input: PortraitFamilyViewInput): PortraitFamilyView[] {
  const sourcesByKey = new Map<string, PortraitSourceInput>();
  for (const source of input.sources ?? []) sourcesByKey.set(source.sourceKey, source);

  const candidates = new Map<string, string>();
  for (const candidate of input.candidates ?? []) {
    candidates.set(`${candidate.sourceKey}\n${normalizePortraitVariant(candidate.variant)}`, candidate.image);
  }

  const winners = new Map<string, string | null>();
  for (const [path, key] of Object.entries(input.winners ?? {})) {
    winners.set(normalizePortraitPath(path), key);
  }
  const claims = new Map<string, readonly string[]>();
  for (const [path, keys] of Object.entries(input.claims ?? {})) {
    claims.set(normalizePortraitPath(path), keys);
  }

  const groups = new Map<string, PortraitVariantView[]>();
  const groupHero = new Map<string, string | null>();

  for (const slot of input.slots) {
    const path = normalizePortraitPath(slot.path);
    const familyKey = portraitFamilyKey(path);
    const key = normalizePortraitVariant(portraitVariantKey(path));

    const claimKeys = claims.get(path) ?? [];
    const claimants = claimKeys
      .map((sourceKey) => sourcesByKey.get(sourceKey))
      .filter((source): source is PortraitSourceInput => Boolean(source));
    const winnerKey = winners.has(path) ? winners.get(path) ?? null : undefined;
    const winner = winnerKey ? sourcesByKey.get(winnerKey) ?? null : null;

    // `unknown` only when nobody inspected this path. Once inspected, an empty
    // claim set is a real "stock" answer.
    const enabledClaimants = claimants.filter((source) => source.enabled);
    const status: PortraitVariantStatus =
      winnerKey === undefined && claimants.length === 0
        ? 'unknown'
        : enabledClaimants.length > 1
          ? 'conflict'
          : winner && winner.enabled
            ? 'installed'
            : claimants.length > 0
              ? 'disabled'
              : 'stock';

    const stockImage = slot.stockImage ?? null;
    const winnerImage = winner ? candidates.get(`${winner.sourceKey}\n${key}`) ?? null : null;
    const currentImage = status === 'installed' || status === 'conflict' ? winnerImage : stockImage;

    const ordered = [...claimants].sort(compareSources);
    if (winner) ordered.sort((a, b) => Number(b === winner) - Number(a === winner));

    const view: PortraitVariantView = {
      key,
      distinguisher: null,
      sourceVariant: slot.variant ?? null,
      path,
      width: slot.width ?? null,
      height: slot.height ?? null,
      stockImage,
      currentImage,
      status,
      winner,
      claimants: ordered,
    };

    const members = groups.get(familyKey);
    if (members) members.push(view);
    else groups.set(familyKey, [view]);
    if (slot.hero && !groupHero.get(familyKey)) groupHero.set(familyKey, slot.hero);
  }

  const fallbackHero = input.heroName?.trim() || null;
  return [...groups.entries()].map(([key, members]) => {
    members.sort((a, b) => portraitVariantRank(a.key) - portraitVariantRank(b.key) || a.path.localeCompare(b.path));

    const perKey = new Map<string, number>();
    for (const member of members) perKey.set(member.key, (perKey.get(member.key) ?? 0) + 1);
    for (const member of members) {
      if ((perKey.get(member.key) ?? 0) < 2) continue;
      const file = member.path.slice(member.path.lastIndexOf('/') + 1);
      member.distinguisher = file.replace(/\.[^.]+$/, '');
    }
    const codename = groupHero.get(key) ?? null;
    const heroName =
      displayNameForHeroCodename(codename) ??
      fallbackHero ??
      codename;
    const aliases = resolvePortraitHero(heroName)?.panoramaCodenames ?? (codename ? [codename] : []);

    const base =
      BASE_PREFERENCE.map((variant) => members.find((member) => member.key === variant)).find(Boolean) ??
      members[0];

    const sources: PortraitSourceInput[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      for (const claimant of member.claimants) {
        if (seen.has(claimant.sourceKey)) continue;
        seen.add(claimant.sourceKey);
        sources.push(claimant);
      }
    }
    sources.sort(compareSources);

    const winners = members
      .filter((member) => member.winner && (member.status === 'installed' || member.status === 'conflict'))
      .map((member) => ({ variant: member, source: member.winner as PortraitSourceInput }));

    return {
      key,
      heroCodename: codename,
      heroName,
      aliases,
      base,
      variants: members,
      status: severest(members.map((member) => member.status)),
      sources,
      winners,
    };
  });
}

/**
 * The claims half of the input, adapted from one exact-path inspection.
 *
 * Typed structurally rather than against `FoundryAssetSourcesInspection` so the
 * view model stays free of Foundry types: the inspection satisfies this shape,
 * and so would any other single claims index (S1's direction) that replaced it.
 */
export interface PortraitClaimsInspection {
  winners: Readonly<Record<string, string | null>>;
  sources: ReadonlyArray<{
    modId: string;
    modName: string;
    enabled: boolean;
    priority: number;
    provenance: string;
    entries: readonly string[];
  }>;
}

const PROVENANCE_BY_INSPECTION_LABEL: Readonly<Record<string, PortraitProvenance>> = {
  Downloaded: 'downloaded',
  Imported: 'imported',
  Forged: 'forged',
  'Third-party': 'third-party',
};

/**
 * Turn one inspection into the `sources` / `winners` / `claims` a family view
 * needs. `fileNameFor` is optional because only the Locker knows the mod file
 * name; a surface without it simply has no secondary label, which is better
 * than heading a card with `pakNN` (matrix finding 4).
 */
export function portraitClaimsFromInspection(
  inspection: PortraitClaimsInspection | null | undefined,
  fileNameFor?: (modId: string) => string | null | undefined,
): Pick<PortraitFamilyViewInput, 'sources' | 'winners' | 'claims'> {
  if (!inspection) return {};
  const sources: PortraitSourceInput[] = inspection.sources.map((source) => ({
    sourceKey: source.modId,
    modId: source.modId,
    name: source.modName,
    fileName: fileNameFor?.(source.modId) ?? null,
    enabled: source.enabled,
    priority: source.priority,
    provenance: PROVENANCE_BY_INSPECTION_LABEL[source.provenance] ?? null,
  }));
  const claims: Record<string, string[]> = {};
  for (const source of inspection.sources) {
    for (const entry of source.entries) {
      const path = normalizePortraitPath(entry);
      (claims[path] ??= []).push(source.modId);
    }
  }
  const winners: Record<string, string | null> = {};
  for (const [path, modId] of Object.entries(inspection.winners)) {
    winners[normalizePortraitPath(path)] = modId;
    claims[normalizePortraitPath(path)] ??= [];
  }
  return { sources, winners, claims };
}

/**
 * Translation key for a family or variant status. Kept as a static map rather
 * than a template literal so the i18n gate can see every key, and so a status
 * added later cannot build a missing key at runtime.
 *
 * Status is never colour-only on either surface (#10 Part 2 item 4): these are
 * the words that carry it.
 */
export const PORTRAIT_STATUS_LABEL_KEYS: Readonly<Record<PortraitVariantStatus, string>> = {
  stock: 'portrait.status.stock',
  installed: 'portrait.status.installed',
  disabled: 'portrait.status.disabled',
  conflict: 'portrait.status.conflict',
  unknown: 'portrait.status.unknown',
};
