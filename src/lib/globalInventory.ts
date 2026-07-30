import type { SoundInventoryEntry } from './soundInventory';
import { entriesInCategory } from './soundInventory';
import { GLOBAL_SOUND_SECTIONS } from './globalSoundSections';
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
