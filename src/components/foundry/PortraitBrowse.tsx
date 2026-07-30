import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Images, Loader2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/PageComponents';
import CatalogDiagnostics from './CatalogDiagnostics';
import Tx from '../translation/Tx';
import { foundryThumbnails } from '../../lib/api';
import { matchesPortraitHero, resolvePortraitHero } from '../../lib/heroPortraitIdentity';
import { showToast } from '../../stores/toastStore';
import type { TextureGridItem } from '../../types/foundry';
import PortraitEditor from './PortraitEditor';
import {
  groupPortraitFamilies,
  portraitVariantLabelKey,
  type PortraitFamilyGroup,
} from './portraitFamily';
import type { VisualStagedEdit } from './visualEdits';
import SearchInput from '../common/SearchInput';

interface PortraitBrowseProps {
  /** codename -> display name, resolved once by the Foundry shell. */
  heroNames: Map<string, string>;
  /** Pin the list to one hero (the workshop passes its codename); the hero
   *  dropdown is hidden because the scope is not the user's to change there. */
  hero?: string;
  /** Hand a staged family to the shared build tray. Absent means browse-only. */
  onStage?: (edit: VisualStagedEdit) => void;
}

/**
 * The Portraits sub-tool: the portrait families the game actually reads, one
 * card per family, instead of one card per file. The Library grid still lists
 * the same entries individually; this surface exists so "change my hero's
 * portrait" starts at the family (the unit the preflight and the editor already
 * work in) rather than at whichever variant the user happened to recognize.
 *
 * The full hero-image category is one pre-thumbnailed IPC call (identical to
 * the Library grid's), and everything after it is client-side, so the editor is
 * always opened with the same catalog membership the preflight will inspect.
 */
export default function PortraitBrowse({ heroNames, hero, onStage }: PortraitBrowseProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TextureGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [heroFilter, setHeroFilter] = useState('all');
  const [editing, setEditing] = useState<TextureGridItem | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Runs once on mount; `loading` starts true and `error` starts null, so the
  // effect only has to record the outcome.
  useEffect(() => {
    let cancelled = false;
    foundryThumbnails('hero-image')
      .then((grid) => {
        if (!cancelled) setItems(grid);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const families = useMemo(() => groupPortraitFamilies(items), [items]);

  // Hero dropdown scoped to codenames that actually have a family here.
  const presentHeroes = useMemo(() => {
    const codes = new Set<string>();
    for (const family of families) if (family.hero) codes.add(family.hero);
    return [...codes]
      .map((code) => ({ code, name: resolvePortraitHero(code)?.displayName ?? heroNames.get(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [families, heroNames]);

  // A hero workshop has a roster codename, while the texture catalog has a
  // panorama codename. They only meet through the shared portrait resolver.
  const scope = hero ? (heroNames.get(hero) ?? hero) : (heroFilter === 'all' ? null : heroFilter);
  const scopedFamilies = useMemo(
    () => families.filter((family) => !scope || matchesPortraitHero(scope, family.hero)),
    [families, scope],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedFamilies
      .filter((family) => {
        if (!q) return true;
        const heroName = family.hero ? (resolvePortraitHero(family.hero)?.displayName ?? heroNames.get(family.hero) ?? family.hero) : '';
        return (
          family.base.label.toLowerCase().includes(q) ||
          family.key.includes(q) ||
          heroName.toLowerCase().includes(q)
        );
      })
      // Real state families (the hero cards) lead; single-file hero art
      // (backgrounds, gun art) follows, alphabetical by hero inside each band.
      .sort((a, b) => {
        const band = Number(b.variants.length > 1) - Number(a.variants.length > 1);
        if (band !== 0) return band;
        const nameA = a.hero ? (heroNames.get(a.hero) ?? a.hero) : '';
        const nameB = b.hero ? (heroNames.get(b.hero) ?? b.hero) : '';
        return nameA.localeCompare(nameB) || a.key.localeCompare(b.key);
      });
  }, [scopedFamilies, search, heroNames]);
  const targetVariants = useMemo(
    () => [...new Set(scopedFamilies.flatMap((family) => family.variants.map((variant) => variant.key)))].sort(),
    [scopedFamilies],
  );

  const stageFamily = useCallback(
    (edits: VisualStagedEdit[]) => {
      if (!onStage) return;
      for (const edit of edits) onStage(edit);
      showToast(t('portraitEditor.staged', { count: edits.length }), { tone: 'success', duration: 6000 });
    },
    [onStage, t],
  );
  const hasActiveFilter = Boolean(search.trim()) || (!hero && heroFilter !== 'all');

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {!hero && presentHeroes.length > 0 && (
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
          placeholder={t('foundry.portraits.searchPlaceholder', 'Search portraits...')}
          clearLabel={t('foundry.search.clear', 'Clear asset search')}
          scope={t('foundry.search.portraitScope', 'Searches portrait names, heroes, and game paths.')}
          summary={
            hasActiveFilter
              ? t('foundry.search.resultCount', 'Showing {{visible}} of {{total}} assets', {
                  visible: visible.length,
                  total: scopedFamilies.length,
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
        <div className="space-y-3">
          <EmptyState
            icon={AlertTriangle}
            variant="error"
            title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
            description={error}
          />
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadNonce((nonce) => nonce + 1);
            }}
            className="mx-auto block rounded-sm border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary hover:border-accent/50"
          >
            {t('common.actions.retry', 'Retry')}
          </button>
          {/* An unreadable catalog is exactly when "which pak, from when" is
              the question, so the diagnostics sit under the retry. */}
          <div className="flex justify-center"><CatalogDiagnostics /></div>
        </div>
      ) : scope && scopedFamilies.length === 0 ? (
        // The "Abrams portraits disappeared" surface. Whether the cause is an
        // unindexed family or a stale cache is not guessable from the message,
        // so the diagnostics ship with it.
        <div className="space-y-3">
          <EmptyState
            icon={Images}
            title={<Tx k="foundry.portraits.notIndexed.title" fallback="No base-game portrait family found" />}
            description={<Tx k="foundry.portraits.notIndexed.description" fallback="This hero has no indexed editable portrait family in this game build. Browse the global catalog or report the missing mapping." />}
            action={<a href="/foundry?section=portraits" className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-primary hover:border-accent/50">{t('foundry.portraits.browseGlobal', 'Browse global portrait catalog')}</a>}
          />
          <div className="flex justify-center"><CatalogDiagnostics /></div>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Images}
          title={<Tx k="foundry.portraits.empty.title" fallback="No portraits match" />}
          description={
            <Tx
              k="foundry.portraits.empty.description"
              fallback="No portrait families match that hero or search."
            />
          }
          action={hasActiveFilter ? <button type="button" onClick={() => { setSearch(''); if (!hero) setHeroFilter('all'); }} className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-primary hover:border-accent/50">{t('foundry.search.clearFilters', 'Clear search and filters')}</button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {/* Standing scope, not an announcement: it describes what this surface
              covers and does not change under a keystroke. The search count is
              what gets announced, from the field's own status line. */}
          {scope && <p className="text-sm tabular-nums text-text-secondary">
            {t('foundry.portraits.coverage', 'Families available: {{count}} · Targets: {{variants}}', {
              count: scopedFamilies.length,
              variants: targetVariants.join(', '),
            })}
          </p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
          {visible.map((family) => (
            <FamilyCard
              key={family.key}
              family={family}
              // A pinned-hero surface (the workshop section) says the hero
              // once in its own chrome; repeating it on every card is noise.
              heroName={!hero && family.hero ? (resolvePortraitHero(family.hero)?.displayName ?? heroNames.get(family.hero)) : undefined}
              onOpen={() => setEditing(family.base)}
            />
          ))}
        </div>
        </div>
      )}

      <PortraitEditor
        item={editing}
        catalog={items}
        heroName={editing?.hero ? heroNames.get(editing.hero) : undefined}
        onClose={() => setEditing(null)}
        onStage={stageFamily}
      />
    </>
  );
}

/** One portrait family. The thumbnail is the anchor member's; the chips name
 *  every state variant a change here will cover. */
function FamilyCard({
  family,
  heroName,
  onOpen,
}: {
  family: PortraitFamilyGroup<TextureGridItem>;
  heroName?: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-sm border border-border bg-bg-secondary text-left transition-colors hover:border-accent/50 cursor-pointer"
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-bg-tertiary">
        {family.base.thumbUrl ? (
          <img
            src={family.base.thumbUrl}
            alt={family.base.label}
            loading="lazy"
            className="h-full w-full object-contain transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <Images size={28} className="text-text-secondary/50" />
        )}
      </span>
      <span className="flex flex-col gap-1 p-2">
        <span className="truncate text-sm capitalize text-text-primary" title={family.base.label}>
          {family.base.label || t('foundry.lightbox.unnamed', '(unnamed)')}
        </span>
        {heroName && <span className="truncate text-[11px] text-text-secondary">{heroName}</span>}
        <span className="flex flex-wrap gap-1">
          {family.variants.slice(0, 4).map((variant) => {
            const labelKey = portraitVariantLabelKey(variant.key);
            return (
              <span
                key={variant.path}
                className="rounded-sm border border-border/70 bg-bg-tertiary px-1 py-0.5 text-[10px] text-text-secondary"
              >
                {labelKey ? t(labelKey) : variant.key}
              </span>
            );
          })}
          {family.variants.length > 4 && (
            <span
              className="rounded-sm border border-border/70 bg-bg-tertiary px-1 py-0.5 text-[10px] text-text-secondary"
              title={family.variants
                .slice(4)
                .map((variant) => {
                  const labelKey = portraitVariantLabelKey(variant.key);
                  return labelKey ? t(labelKey) : variant.key;
                })
                .join(', ')}
            >
              +{family.variants.length - 4}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
