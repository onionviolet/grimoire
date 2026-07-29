import type { TextureGridItem } from '../../types/foundry';

/** The bounded thumbnail catalog searches friendly labels and exact game paths. */
export function filterTextureGridItems(items: TextureGridItem[], search: string, heroFilter: string) {
  const q = search.trim().toLowerCase();
  return items.filter((it) => {
    if (heroFilter !== 'all' && it.hero !== heroFilter) return false;
    if (!q) return true;
    return it.label.toLowerCase().includes(q) || it.path.toLowerCase().includes(q);
  });
}
