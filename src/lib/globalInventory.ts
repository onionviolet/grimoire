import type { SoundInventoryEntry } from './soundInventory';
import { entriesInCategory } from './soundInventory';
import { GLOBAL_SOUND_SECTIONS } from './globalSoundSections';
import type { LockerMode } from './lockerMode';
import {
  GLOBAL_VISUAL_MOD_TYPE_ORDER,
  type GlobalModGroups,
} from './lockerUtils';

/**
 * One denominator for the Global drill-in.
 *
 * A sound mod can retain a legacy `globalType` (for example Announcer) while
 * also being represented by the sound taxonomy. Count its mod id once, and
 * keep sound-shaped legacy buckets out of the visual rail entirely.
 */
export function countGlobalInventoryMods(
  groups: GlobalModGroups,
  soundEntries: readonly SoundInventoryEntry[]
): number {
  const ids = new Set<string>();
  for (const type of GLOBAL_VISUAL_MOD_TYPE_ORDER) {
    for (const mod of groups[type]) ids.add(mod.id);
  }
  for (const entry of soundEntries) ids.add(entry.modId);
  return ids.size;
}

/**
 * How many Global categories actually hold something, across both axes.
 *
 * The tile used to count over every legacy `globalType`, including the
 * sound-shaped ones the visual rail no longer renders, so it could claim four
 * categories against a drill-in showing seven. Counting populated visual types
 * plus populated sound categories is the same question the drill-in answers.
 */
export function countGlobalInventoryCategories(
  groups: GlobalModGroups,
  soundEntries: readonly SoundInventoryEntry[]
): number {
  const visual = GLOBAL_VISUAL_MOD_TYPE_ORDER.filter((type) => groups[type].length > 0).length;
  const sound = GLOBAL_SOUND_SECTIONS.filter(
    (category) => entriesInCategory(soundEntries, category).length > 0
  ).length;
  return visual + sound;
}

/** One rail row's input: already-localized label and its unique-mod count. */
export interface GlobalRailRowInput {
  key: string;
  label: string;
  count: number;
}

/** A rail row tagged with the vocabulary it belongs to, for merged rendering. */
export interface GlobalRailRow extends GlobalRailRowInput {
  kind: 'visual' | 'sound';
}

/**
 * The Global drill-in's rail projection for one section.
 *
 * Returns the visual rows for `looks`, the sound rows for `sounds`, and the
 * visual rows followed by the sound rows for `all`, in every case keeping only
 * rows whose count is greater than zero.
 *
 * Hiding a zero-count row reverses a deliberate as-shipped decision: the rail
 * used to list every category, empty ones included, so an empty row could open
 * its own empty state. D-04 reversed that: empty categories are hidden by
 * default, and a narrower section with nothing left renders a reset state
 * instead. Labels arrive already localized because they come from `t()` and
 * `GLOBAL_MOD_TYPE_LABELS` in the component; this module stays
 * renderer-framework free.
 */
export function globalInventoryRailRows(
  section: LockerMode,
  visualRows: readonly GlobalRailRowInput[],
  soundRows: readonly GlobalRailRowInput[]
): GlobalRailRow[] {
  if (section === 'looks') {
    return visualRows.filter((row) => row.count > 0).map((row) => ({ ...row, kind: 'visual' }));
  }
  if (section === 'sounds') {
    return soundRows.filter((row) => row.count > 0).map((row) => ({ ...row, kind: 'sound' }));
  }
  return [
    ...visualRows
      .filter((row) => row.count > 0)
      .map((row) => ({ ...row, kind: 'visual' as const })),
    ...soundRows.filter((row) => row.count > 0).map((row) => ({ ...row, kind: 'sound' as const })),
  ];
}

/** The first row's key, or null when the rail has nothing to highlight. */
export function firstGlobalRailRowKey(rows: readonly GlobalRailRow[]): string | null {
  return rows.length > 0 ? rows[0].key : null;
}
