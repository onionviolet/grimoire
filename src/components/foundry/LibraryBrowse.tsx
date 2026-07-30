import { useCallback, useEffect, useMemo, useState } from 'react';
import { Library, Loader2, AlertTriangle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../common/confirmContext';
import { EmptyState } from '../common/PageComponents';
import Tx from '../translation/Tx';
import { foundryInspectAssetSources, foundryThumbnails } from '../../lib/api';
import { showToast } from '../../stores/toastStore';
import type { TextureCategory, TextureGridItem } from '../../types/foundry';
import PortraitEditor from './PortraitEditor';
import TextureGrid from './TextureGrid';
import TextureLightbox from './TextureLightbox';
import SearchInput from '../common/SearchInput';
import { filterTextureGridItems } from './assetSearch';
import { prepareVisualStagedEdit, visualAssetInspectionPaths, type VisualStagedEdit } from './visualEdits';

interface LibraryBrowseProps {
  /** codename -> display name, resolved once by the Foundry shell. */
  heroNames: Map<string, string>;
  /** Category the grid opens on (the Items sub-tool lands on item icons). */
  initialCategory?: TextureCategory;
  onStage?: (edit: VisualStagedEdit) => void;
}

// The bounded, thumbnailable categories the browse grid surfaces this pass.
const CATEGORIES: { value: TextureCategory; labelKey: string; fallback: string }[] = [
  { value: 'ability-icon', labelKey: 'foundry.categories.abilityIcon', fallback: 'Ability icons' },
  { value: 'item-icon', labelKey: 'foundry.categories.itemIcon', fallback: 'Item icons' },
  // This catalog family includes hero cards and portrait textures as well as
  // other hero-facing panorama art, so name the thing a modder is looking for.
  { value: 'hero-image', labelKey: 'foundry.categories.heroImage', fallback: 'Portraits & hero images' },
];

/**
 * The Library sub-tool: browse the texture/icon catalog by category, with a
 * client-side hero/search narrowing and an enlarge-on-click lightbox. One IPC
 * call per category (thumbnails decoded once and cached); filtering is local.
 */
export default function LibraryBrowse({ heroNames, initialCategory = 'ability-icon', onStage }: LibraryBrowseProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [category, setCategory] = useState<TextureCategory>(initialCategory);
  const [items, setItems] = useState<TextureGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [heroFilter, setHeroFilter] = useState('all');
  const [lightbox, setLightbox] = useState<TextureGridItem | null>(null);
  const [replacingPath, setReplacingPath] = useState<string | null>(null);
  // Portrait/hero-image drops open the editor instead of staging the raw file:
  // that family has state variants and a real target size, so a raw drop cannot
  // show what the card will show. Every other category is unchanged.
  const [portrait, setPortrait] = useState<{ item: TextureGridItem; file: File | null } | null>(null);

  const replace = useCallback(async (item: TextureGridItem, file: File) => {
    if (item.category === 'hero-image') {
      if (onStage) setPortrait({ item, file });
      return;
    }
    const imagePath = window.electronAPI.getDroppedFilePath(file);
    if (!imagePath) return;
    setReplacingPath(item.path);
    try {
      if (!onStage) throw new Error('Foundry staging is unavailable.');
      const staged = await prepareVisualStagedEdit({
        item,
        catalog: items,
        imagePath,
        name: t('foundry.texture.defaultReplacementName', '{{label}} replacement', { label: item.label || 'Texture' }),
        inspect: foundryInspectAssetSources,
        confirm: (modNames) =>
          confirm({
            title: t('foundry.texture.stageConflictTitle', 'Stage a separate layered replacement?'),
            message: t(
              'foundry.texture.stageConflictBody',
              'These installed mods already replace this asset and are enabled. Staging adds a separate managed replacement layered over them; nothing is removed.'
            ),
            items: modNames,
            confirmLabel: t('foundry.texture.stageConflictConfirm', 'Stage anyway'),
          }),
        unreadableMessage: t('foundry.texture.stageUnreadable'),
        heroName: item.hero ? heroNames.get(item.hero) : undefined,
      });
      if (!staged) return;
      onStage(staged);
      showToast(t('foundry.texture.replaceDone', 'Added to the Foundry build tray. Nothing has been installed.'), { tone: 'success', duration: 6000 });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { tone: 'error', duration: 8000 });
    } finally {
      setReplacingPath(null);
    }
  }, [items, heroNames, onStage, t, confirm]);

  const loadCategory = useCallback(async (cat: TextureCategory) => {
    setLoading(true);
    setError(null);
    try {
      const grid = await foundryThumbnails(cat);
      setItems(grid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHeroFilter('all');
    void loadCategory(category);
  }, [category, loadCategory]);

  // Hero dropdown is scoped to the codenames actually present in this category.
  const presentHeroes = useMemo(() => {
    const codes = new Set<string>();
    for (const it of items) if (it.hero) codes.add(it.hero);
    return [...codes]
      .map((code) => ({ code, name: heroNames.get(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, heroNames]);
  const visibleItems = useMemo(
    () => filterTextureGridItems(items, search, heroFilter),
    [items, search, heroFilter],
  );
  const hasActiveFilter = Boolean(search.trim()) || heroFilter !== 'all';

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-tertiary px-2 py-1.5">
          <Library size={14} className="text-text-secondary" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TextureCategory)}
            className="bg-transparent text-sm text-text-primary focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-bg-secondary">
                {t(c.labelKey, c.fallback)}
              </option>
            ))}
          </select>
        </div>

        {presentHeroes.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-tertiary px-2 py-1.5">
            <Users size={14} className="text-text-secondary" />
            <select
              value={heroFilter}
              onChange={(e) => setHeroFilter(e.target.value)}
              className="bg-transparent text-sm text-text-primary focus:outline-none"
            >
              <option value="all" className="bg-bg-secondary">
                {t('foundry.filters.allHeroes', 'All heroes')}
              </option>
              {presentHeroes.map((h) => (
                <option key={h.code} value={h.code} className="bg-bg-secondary">
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('foundry.filters.searchPlaceholder', 'Search assets...')}
          clearLabel={t('foundry.search.clear', 'Clear asset search')}
          scope={t('foundry.search.assetScope', 'Searches asset names and game paths.')}
          summary={
            hasActiveFilter
              ? t('foundry.search.resultCount', 'Showing {{visible}} of {{total}} assets', {
                  visible: visibleItems.length,
                  total: items.length,
                })
              : undefined
          }
        />
      </div>

      {/* Grid / states */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
          <Tx k="foundry.loading" fallback="Building catalog from your game files..." />
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          variant="error"
          title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
          description={error}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={Library}
          title={<Tx k="foundry.library.empty.title" fallback="No assets match" />}
          description={<Tx k="foundry.library.empty.description" fallback="Try a different asset name or game-path fragment." />}
          action={hasActiveFilter ? <button type="button" onClick={() => { setSearch(''); setHeroFilter('all'); }} className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-primary hover:border-accent/50">{t('foundry.search.clearFilters', 'Clear search and filters')}</button> : undefined}
        />
      ) : (
        // No count paragraph here: it belongs in the search field's own status
        // line, so this list has one live region rather than two.
        <TextureGrid
          items={visibleItems}
          heroNames={heroNames}
          search=""
          heroFilter="all"
          onOpen={setLightbox}
          onReplace={replacingPath ? undefined : replace}
        />
      )}

      <PortraitEditor
        item={portrait?.item ?? null}
        catalog={items}
        heroName={portrait?.item.hero ? heroNames.get(portrait.item.hero) : undefined}
        initialFile={portrait?.file ?? null}
        onClose={() => setPortrait(null)}
        onStage={(edits) => {
          for (const edit of edits) onStage?.(edit);
          showToast(
            t('portraitEditor.staged', { count: edits.length }),
            { tone: 'success', duration: 6000 },
          );
        }}
      />

      <TextureLightbox
        item={lightbox}
        heroName={lightbox?.hero ? heroNames.get(lightbox.hero) : undefined}
        sourcePaths={lightbox ? visualAssetInspectionPaths(lightbox, items) : undefined}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}
