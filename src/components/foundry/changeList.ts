import type { TextureCategory } from '../../types/foundry';
import type { Mod } from '../../types/mod';
// One definition of how a game path is normalized and how a source `.vsnd`
// maps to its compiled entry. The shuffle planner keys pools off the same
// rules, and two copies of an ownership rule is how the two surfaces would
// quietly disagree about what a change owns.
import { compiledSoundEntry, normalizeChangeEntry } from '../../lib/foundryChanges';
import { canonicalHeroName } from '../../lib/lockerUtils';

export { compiledSoundEntry, normalizeChangeEntry };

/**
 * The read model behind `My changes`: one row per thing the user actually
 * changed, derived from installed-mod provenance only.
 *
 * Three provenance shapes feed it, and they are not interchangeable. A sound
 * swap and a legacy texture replacement are each one mod, one change. An
 * installed build is one mod with several parts, so it contributes one row per
 * part: a build that swapped a portrait and a voice line should read as two
 * changes the user can find, not as one opaque VPK.
 *
 * Everything here is pure and derives from `entries` (exact normalized VPK
 * paths). Labels, hero names, and categories are display and grouping only:
 * ownership questions are answered by inspecting those paths, never by this.
 */

export type FoundryChangeKind = 'sound' | 'texture' | 'recolor';

export interface FoundryChangeEntry {
  /** Stable row identity. A multi-part build needs more than the mod id. */
  id: string;
  /** The installed mod this row belongs to. Enabled state, rename, and delete
   *  all act on this, so Installed/Locker stays the single authority. */
  mod: Mod;
  kind: FoundryChangeKind;
  /** What was changed, in the user's terms. */
  title: string;
  /** The game-side identifier: a soundevent, or the replaced entry path. */
  subtitle: string;
  /** Exact normalized VPK entries this row claims, for winner inspection. */
  entries: string[];
  category?: TextureCategory;
  heroName?: string;
  sourceFileName?: string;
  /** True when the row is one part of a multi-part installed build, so the UI
   *  can say the enable/delete controls act on the whole build. */
  partOfBuild: boolean;
}

/** The exact paths a sound swap claims, from its recorded assignments. */
function soundSwapEntries(mod: Mod): string[] {
  const recorded = mod.soundSwap?.reforge;
  const clips = recorded?.assignments.map(({ clipPath }) => clipPath) ?? recorded?.clipPaths ?? [];
  return [...new Set(clips.map(compiledSoundEntry).filter(Boolean))];
}

export function collectFoundryChanges(mods: readonly Mod[]): FoundryChangeEntry[] {
  const rows: FoundryChangeEntry[] = [];
  for (const mod of mods) {
    if (mod.soundSwap) {
      rows.push({
        id: mod.id,
        mod,
        kind: 'sound',
        title: mod.name,
        subtitle: mod.soundSwap.event || mod.soundSwap.heroCodename,
        entries: soundSwapEntries(mod),
        heroName: mod.lockerHero?.trim() || mod.soundSwap.reforge?.heroName?.trim() || undefined,
        sourceFileName: mod.soundSwap.audioFileName,
        partOfBuild: false,
      });
    }
    if (mod.textureReplacement) {
      rows.push({
        id: mod.id,
        mod,
        kind: 'texture',
        title: mod.name,
        subtitle: normalizeChangeEntry(mod.textureReplacement.entryPath),
        entries: [normalizeChangeEntry(mod.textureReplacement.entryPath)].filter(Boolean),
        category: mod.textureReplacement.category,
        heroName: mod.textureReplacement.heroName?.trim() || mod.lockerHero?.trim() || undefined,
        sourceFileName: mod.textureReplacement.imageFileName,
        partOfBuild: false,
      });
    }
    const build = mod.foundryBuild;
    if (build) {
      // A build with no recorded parts is still a real change the user made, so
      // it gets one row carrying the whole confirmed write set rather than
      // vanishing from the list.
      if (!build.parts.length) {
        rows.push({
          id: mod.id,
          mod,
          kind: 'texture',
          title: mod.name,
          subtitle: build.writeSet[0] ?? '',
          entries: build.writeSet.map(normalizeChangeEntry).filter(Boolean),
          heroName: mod.lockerHero?.trim() || undefined,
          partOfBuild: false,
        });
        continue;
      }
      build.parts.forEach((part, index) => {
        rows.push({
          id: `${mod.id}#${index}`,
          mod,
          kind: part.kind,
          title: part.title || mod.name,
          subtitle: part.kind === 'sound'
            ? (part.event || part.entries[0] || '')
            : (part.entries[0] || ''),
          entries: part.entries.map(normalizeChangeEntry).filter(Boolean),
          category: part.category,
          heroName: part.heroName?.trim() || mod.lockerHero?.trim() || undefined,
          sourceFileName: part.sourceFileName,
          partOfBuild: build.parts.length > 1,
        });
      });
    }
  }
  return rows;
}

/** Which shelf a row sits on. Visual rows split by catalog category so
 *  "portraits" is a thing the user can actually ask for. */
/**
 * Scope changes to one hero. Canonical names on both sides so an alias recorded
 * by one surface still matches the roster name another surface used, and an
 * unscoped change is excluded rather than shown under a hero it does not belong
 * to.
 */
export function scopeFoundryChangesToHero(
  entries: readonly FoundryChangeEntry[],
  heroName: string,
): FoundryChangeEntry[] {
  const wanted = canonicalHeroName(heroName);
  return entries.filter((entry) => entry.heroName && canonicalHeroName(entry.heroName) === wanted);
}

/**
 * How many changes the user has authored per hero, keyed by canonical hero
 * name. Derived from the same rows `My changes` lists, so the grid badge and
 * the workshop's own list can never disagree about what counts.
 */
export function countFoundryChangesByHero(mods: readonly Mod[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of collectFoundryChanges(mods)) {
    if (!entry.heroName) continue;
    const key = canonicalHeroName(entry.heroName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export type FoundryChangeFilter = 'all' | 'sound' | TextureCategory;

export function changeFilterOf(entry: FoundryChangeEntry): FoundryChangeFilter {
  if (entry.kind === 'sound') return 'sound';
  // A recolor row carries no catalog category (its entries are the baked VFX
  // paths), so it shelves under `other` exactly as an uncategorized texture
  // row does.
  return entry.category ?? 'other';
}

export function filterFoundryChanges(
  entries: readonly FoundryChangeEntry[],
  { filter = 'all', query = '' }: { filter?: FoundryChangeFilter; query?: string } = {},
): FoundryChangeEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter !== 'all' && changeFilterOf(entry) !== filter) return false;
    if (!needle) return true;
    // The entry paths are searchable too: a user who knows the game path they
    // replaced should be able to find the change by pasting it.
    return [entry.title, entry.subtitle, entry.heroName, entry.sourceFileName, entry.mod.name, ...entry.entries]
      .some((field) => typeof field === 'string' && field.toLowerCase().includes(needle));
  });
}

export type FoundryChangeSort = 'recent' | 'name' | 'hero' | 'enabled';

/** Sort without mutating the input. `recent` reads installedAt, which is an
 *  ISO string, so an unparseable/missing value sorts last rather than throwing
 *  the whole list into an arbitrary order. */
export function sortFoundryChanges(
  entries: readonly FoundryChangeEntry[],
  sort: FoundryChangeSort,
): FoundryChangeEntry[] {
  const installedAt = (entry: FoundryChangeEntry) => {
    const value = Date.parse(entry.mod.installedAt ?? '');
    return Number.isNaN(value) ? -Infinity : value;
  };
  const byTitle = (a: FoundryChangeEntry, b: FoundryChangeEntry) => a.title.localeCompare(b.title);
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'name':
        return byTitle(a, b);
      case 'hero':
        return (a.heroName ?? '￿').localeCompare(b.heroName ?? '￿') || byTitle(a, b);
      case 'enabled':
        return Number(b.mod.enabled) - Number(a.mod.enabled) || byTitle(a, b);
      case 'recent':
      default:
        return installedAt(b) - installedAt(a) || byTitle(a, b);
    }
  });
}

/** Group into hero shelves, preserving the sorted order inside each group. An
 *  empty key means "not hero-scoped" and the caller labels it. */
export function groupFoundryChanges(
  entries: readonly FoundryChangeEntry[],
): Array<[string, FoundryChangeEntry[]]> {
  const grouped = new Map<string, FoundryChangeEntry[]>();
  for (const entry of entries) {
    const scope = entry.heroName ?? '';
    grouped.set(scope, [...(grouped.get(scope) ?? []), entry]);
  }
  // Unscoped changes sort last: a named hero shelf is the more useful heading.
  return [...grouped.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
}
