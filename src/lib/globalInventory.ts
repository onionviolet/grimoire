import type { SoundInventoryEntry } from './soundInventory';
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
