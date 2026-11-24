import type { TextureEntry } from '../types/foundry';

/** Verified color slots in the Hideout portrait materials. The similarly
 * named self-illumination texture is a mask, never a painting replacement. */
export const HIDEOUT_PAINTING_PATHS = [
  'models/hideout/materials/hideout_portraits_color_psd_52e10adb.vtex_c',
  'models/hideout/materials/hideout_portraits_02_color_psd_e147c504.vtex_c',
  'models/hideout/materials/hideout_portrait_large_color_psd_bc05d6c1.vtex_c',
] as const;

/** Keep only verified entries actually present in the installed game's index.
 * Missing assets after a game update must not become synthetic bake targets. */
export function hideoutPaintings(entries: readonly TextureEntry[], search = ''): TextureEntry[] {
  const paths = new Set<string>(HIDEOUT_PAINTING_PATHS);
  const term = search.trim().toLowerCase();
  return entries.filter(entry => paths.has(entry.path)
    && (!term || `${entry.label} ${entry.path}`.toLowerCase().includes(term)));
}
