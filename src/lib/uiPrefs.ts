/**
 * One typed place for remembered view preferences.
 *
 * These were written straight to `localStorage` from five files with four
 * conventions: inline string literals, module constants, store-owned keys with
 * a legacy fallback, and three different boolean encodings ('true'/'false',
 * '1'/'0', and sentinel-string comparison). Every reader re-implemented the
 * same defensive try/catch, and one of them documented a real bug the shape
 * caused (a StrictMode save closure capturing `[]` and clobbering the stored
 * value). There was also no inventory of what is remembered, so there was no
 * way to reset a layout you had painted yourself into.
 *
 * This is a typed wrapper over the keys that already exist, not a new
 * abstraction to grow into. The scope is deliberately *view preferences*: what
 * a surface looks like. User data (favorites, mod lists, the launch shuffle
 * pools, accepted terms) keeps its own storage, because "reset my view
 * preferences" must never throw that away.
 *
 * The stored key strings are frozen. Changing one silently resets that
 * preference for everyone who already has it set.
 */

/** How one preference is encoded in storage. `parse` returns null when the
 *  stored text is absent or unusable, which is what selects the default. */
interface Codec<T> {
  parse(raw: string): T | null;
  format(value: T): string;
}

/** Booleans, reading both encodings that shipped. New writes are 'true' /
 *  'false'; '1' / '0' is read so nobody's saved toggle resets on upgrade. */
const boolean: Codec<boolean> = {
  parse: (raw) => (raw === 'true' || raw === '1' ? true : raw === 'false' || raw === '0' ? false : null),
  format: (value) => (value ? 'true' : 'false'),
};

/** A closed set of string values. Anything else reads as absent. */
function oneOf<T extends string>(...allowed: readonly T[]): Codec<T> {
  return {
    parse: (raw) => (allowed as readonly string[]).includes(raw) ? (raw as T) : null,
    format: (value) => value,
  };
}

/** A number held inside bounds. A stored value outside them is clamped rather
 *  than discarded: the user did choose a direction, the range just moved. */
function clamped(min: number, max: number): Codec<number> {
  return {
    parse: (raw) => {
      const value = Number(raw);
      if (raw === '' || !Number.isFinite(value)) return null;
      return Math.min(max, Math.max(min, value));
    },
    format: (value) => String(Math.min(max, Math.max(min, value))),
  };
}

/** A JSON array filtered to a known member set, empty meaning "unset". Used
 *  for multi-select filters that persist. */
function setOf<T extends string>(...allowed: readonly T[]): Codec<T[]> {
  return {
    parse: (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (!Array.isArray(parsed)) return null;
      const valid = Array.from(
        new Set(parsed.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))
      );
      return valid.length > 0 ? valid : null;
    },
    format: (value) => JSON.stringify(value),
  };
}

interface PrefDef<T> {
  /** The storage key. Frozen. */
  key: string;
  /** What the surface uses when nothing is stored. */
  fallback: T;
  codec: Codec<T>;
  /** Keys read (never written) so an existing saved value survives a rename.
   *  Tried in order, after `key`. */
  legacy?: readonly { key: string; codec: Codec<T> }[];
}

function def<T>(def_: PrefDef<T>): PrefDef<T> {
  return def_;
}

/** Card-size bounds, shared by the Browse and Installed grids. */
export const CARD_SIZE_MIN = 0.8;
export const CARD_SIZE_MAX = 2;
const cardSize = clamped(CARD_SIZE_MIN, CARD_SIZE_MAX);

/**
 * Every remembered view preference, with its default, in one place.
 *
 * Shared vs per-page is a decision per key, not a default:
 *
 * - `cardSize` is **shared**. Browse and Installed had two keys with identical
 *   bounds, identical defaults, and duplicated read functions driving the same
 *   control over the same kind of grid. Tuning it on one and finding the other
 *   unchanged is the exact complaint this lane exists to fix. Both old keys are
 *   read as legacy, so an existing preference carries over from whichever page
 *   set it.
 * - View mode stays **per page**. A hero gallery, a mod grid, and a conflict
 *   list are different content, and wanting cards on one does not imply
 *   wanting them on another.
 * - Sort order and source selection stay **per page**. They name columns that
 *   only exist on their own page.
 */
export const UI_PREFS = {
  /** Shared across the Browse and Installed grids. */
  cardSize: def({
    key: 'grimoire:cardSize',
    fallback: 1,
    codec: cardSize,
    legacy: [
      { key: 'browseCardSizeMultiplier', codec: cardSize },
      { key: 'installedCardSizeMultiplier', codec: cardSize },
    ],
  }),

  browseLayout: def({
    key: 'browseLayout',
    fallback: 'grid' as 'grid' | 'list',
    codec: oneOf('grid', 'list'),
    // Pre-slider key holding 'grid' | 'compact' | 'dense' | 'list'. Only
    // 'list' carried structure, so only 'list' migrates.
    legacy: [{ key: 'browseViewMode', codec: oneOf('list') }],
  }),
  browseSort: def({
    key: 'browseSort',
    fallback: 'default' as 'default' | 'popular' | 'recent' | 'updated' | 'views' | 'name',
    codec: oneOf('default', 'popular', 'recent', 'updated', 'views', 'name'),
  }),
  browseCardDesign: def({
    key: 'browseCardDesign',
    fallback: 'readable' as 'readable' | 'classic',
    codec: oneOf('readable', 'classic'),
  }),
  browseDetailsView: def({
    key: 'browseDetailsView',
    fallback: 'modal' as 'modal' | 'sidebar',
    codec: oneOf('modal', 'sidebar'),
  }),
  browseSidebarWidth: def({
    key: 'browseDetailsSidebarWidth',
    fallback: 0,
    // Upper bound is the viewport, which this module cannot see, so the width
    // is stored loosely and the page clamps it against the live window.
    codec: clamped(0, 100_000),
  }),

  installedLayout: def({
    key: 'installedLayout',
    fallback: 'grid' as 'grid' | 'list',
    codec: oneOf('grid', 'list'),
    legacy: [{ key: 'installedViewMode', codec: oneOf('list') }],
  }),
  installedSort: def({
    key: 'installedSortMode',
    fallback: 'priority' as 'priority' | 'recent' | 'name',
    codec: oneOf('priority', 'recent', 'name'),
  }),
  installedDisabledSort: def({
    key: 'installedDisabledSort',
    fallback: 'custom' as 'custom' | 'name',
    codec: oneOf('custom', 'name'),
  }),
  installedSource: def({
    key: 'installedSourceSel',
    fallback: ['gamebanana', 'local'] as ('gamebanana' | 'local')[],
    codec: setOf('gamebanana', 'local'),
  }),
  installedFixUnknownHidden: def({
    key: 'installedFixUnknownHidden',
    fallback: false,
    codec: boolean,
  }),

  lockerViewMode: def({
    key: 'lockerViewMode',
    fallback: 'gallery' as 'gallery' | 'list',
    codec: oneOf('gallery', 'list'),
  }),
  lockerHideEmpty: def({
    key: 'lockerHideEmpty',
    fallback: false,
    codec: boolean,
  }),

  conflictsViewMode: def({
    key: 'grimoire:conflicts-view-mode',
    fallback: 'grid' as 'grid' | 'list',
    codec: oneOf('grid', 'list'),
  }),

  soundVolume: def({
    key: 'grimoire:sound-preview-volume',
    fallback: 0.7,
    codec: clamped(0, 1),
  }),
} as const;

export type UiPrefName = keyof typeof UI_PREFS;
type PrefOf<K extends UiPrefName> = (typeof UI_PREFS)[K];
export type UiPrefValue<K extends UiPrefName> = PrefOf<K> extends PrefDef<infer T> ? T : never;

/** Every reader used to write this out again. Storage can be unavailable or
 *  full (restricted contexts, quota), and a preference is never worth failing
 *  a render over. */
function rawRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rawWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference lost for this session; the surface still works.
  }
}

function rawRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do: the value stays and the reset is a no-op.
  }
}

export function readPref<K extends UiPrefName>(name: K): UiPrefValue<K> {
  const pref = UI_PREFS[name] as PrefDef<UiPrefValue<K>>;
  const stored = rawRead(pref.key);
  if (stored !== null) {
    const parsed = pref.codec.parse(stored);
    if (parsed !== null) return parsed;
  }
  for (const fallbackKey of pref.legacy ?? []) {
    const legacyRaw = rawRead(fallbackKey.key);
    if (legacyRaw === null) continue;
    const parsed = fallbackKey.codec.parse(legacyRaw);
    if (parsed !== null) return parsed;
  }
  return pref.fallback;
}

export function writePref<K extends UiPrefName>(name: K, value: UiPrefValue<K>): void {
  const pref = UI_PREFS[name] as PrefDef<UiPrefValue<K>>;
  rawWrite(pref.key, pref.codec.format(value));
}

/** Forget one preference, including the legacy keys it can fall back to.
 *  Leaving those would make a reset silently restore the old value. */
export function resetPref(name: UiPrefName): void {
  const pref = UI_PREFS[name] as PrefDef<unknown>;
  rawRemove(pref.key);
  for (const fallbackKey of pref.legacy ?? []) rawRemove(fallbackKey.key);
}

/** Forget every remembered view preference. Driven off the registry, so a new
 *  key is covered the moment it is added and cannot fall out of date. */
export function resetAllPrefs(): void {
  for (const name of Object.keys(UI_PREFS) as UiPrefName[]) resetPref(name);
}

/** How many preferences currently differ from their default. Lets the reset
 *  control say whether it would do anything. */
export function changedPrefCount(): number {
  let count = 0;
  for (const name of Object.keys(UI_PREFS) as UiPrefName[]) {
    const pref = UI_PREFS[name] as PrefDef<unknown>;
    const current = readPref(name);
    const differs = Array.isArray(current)
      ? JSON.stringify(current) !== JSON.stringify(pref.fallback)
      : current !== pref.fallback;
    if (differs) count += 1;
  }
  return count;
}
