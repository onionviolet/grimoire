import { soundTermLabel, type SoundCategory } from './soundVocabulary';
import type { GlobalSoundCategory } from '../types/foundry';

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

/** The rail (and pane heading) label for a global sound category.
 *
 *  The English wording comes from the shared vocabulary's one label table, so
 *  this rail and Foundry's base-game catalog cannot end up calling the same
 *  thing two different names (S2). The i18n key namespace stays this surface's
 *  own, because those strings are already translated. */
export function globalSoundSectionLabel(
  t: (key: string, fallback: string) => string,
  category: SoundCategory
): string {
  return t(`soundLocker.category.${category}`, soundTermLabel(category));
}

/** Map an installed-sound category to the nearest Foundry catalog rail. */
export function globalSoundFoundryCategory(category: SoundCategory): GlobalSoundCategory {
  const categories: Record<SoundCategory, GlobalSoundCategory> = {
    announcer: 'voice', music: 'music', ui: 'ui', ambience: 'ambience', npc: 'npc',
    item: 'item', melee: 'gameplay', unclassified: 'other', ability: 'gameplay',
    voice: 'voice', weapon: 'gameplay', movement: 'gameplay',
  };
  return categories[category];
}
