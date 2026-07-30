import type { SoundCategory } from './soundInventory';

/**
 * The Global sounds vocabulary: which sound categories the Global drill-in's
 * rail lists, and what each is called.
 *
 * Kept out of the shelf component so the shell can render the rail from the
 * same list the shelf renders rows from, without either importing the other.
 */

/** Global sound categories, in rail order. Hero-only categories (ability,
 *  voice, weapon, movement) never appear here: they have a hero to hang off. */
export const GLOBAL_SOUND_SECTIONS: readonly SoundCategory[] = [
  'announcer',
  'music',
  'ui',
  'ambience',
  'npc',
  'item',
  'melee',
  // Last, and visually distinct in the rail: it is a work queue of things the
  // app could not classify, not a kind of sound. `shared` and `shared melee`
  // used to sit here and were both implementation leaks (see soundInventory).
  'unclassified',
];

/** English fallbacks, for the window between a key landing in the en catalog
 *  and a translation arriving. The catalog is the source of truth. */
const GLOBAL_SECTION_FALLBACK: Record<string, string> = {
  announcer: 'Announcer',
  music: 'Music',
  ui: 'Interface',
  ambience: 'Ambience',
  npc: 'NPC',
  item: 'Items',
  melee: 'Melee',
  unclassified: 'Needs classification',
};

/** The rail (and pane heading) label for a global sound category. */
export function globalSoundSectionLabel(
  t: (key: string, fallback: string) => string,
  category: SoundCategory
): string {
  return t(`soundLocker.category.${category}`, GLOBAL_SECTION_FALLBACK[category] ?? category);
}
