import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Images, Loader2, Users, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/PageComponents';
import { Tag } from '../common/ui';
import { HeroSelect } from '../common/HeroSelect';
import CatalogDiagnostics from './CatalogDiagnostics';
import Tx from '../translation/Tx';
import { foundryInspectAssetSources, foundryThumbnails } from '../../lib/api';
import { displayNameForHeroCodename, resolvePortraitHero } from '../../lib/heroPortraitIdentity';
import { buildHeroFilterOptions } from './heroFilterOptions';
import { VEILED_CONTENT_CLASS } from '../../lib/heroStage';
import {
  buildPortraitFamilyViews,
  normalizePortraitPath,
  normalizePortraitVariant,
  portraitClaimsFromInspection,
  portraitVariantDisplay,
  portraitVariantLabelKey as sharedVariantLabelKey,
  type PortraitVariantView,
} from '../../lib/portraitFamilyView';
import { showToast } from '../../stores/toastStore';
import type { TextureGridItem } from '../../types/foundry';
import PortraitEditor from './PortraitEditor';
import PortraitFamilyCard from '../common/PortraitFamilyCard';
import PortraitFamilyPreview from '../common/PortraitFamilyPreview';
import AssetSourcesPanel from './AssetSourcesPanel';
import { useAssetSourceInspection } from './assetSourceInspection';
import { groupPortraitFamilies } from './portraitFamily';
import type { VisualStagedEdit } from './visualEdits';
import SearchInput from '../common/SearchInput';
import { portraitFamiliesForHero } from './portraitFamilyLookup';

interface PortraitBrowseProps {
  /** codename -> display name, resolved once by the Foundry shell. */
  heroNames: Map<string, string>;
  /** Pin the list to one hero (the workshop passes its codename), or `null` for
   *  the unscoped catalog. Required, never optional: see the note on
   *  `LibraryBrowse`'s `hero` prop (structural cause S3). When pinned, the hero
   *  dropdown is hidden because the scope is not the user's to change there. */
  hero: string | null;
  /** Hand a staged family to the shared build tray. Absent means browse-only. */
  onStage?: (edit: VisualStagedEdit) => void;
  /** Open straight onto this family (`/foundry?...&family=<key>`), the Locker's
   *  "Create replacement in Foundry" landing. Unknown keys are ignored, so a
   *  stale link lands on the hero's portrait list rather than on an error. */
  initialFamilyKey?: string;
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
export default function PortraitBrowse({ heroNames, hero, onStage, initialFamilyKey }: PortraitBrowseProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TextureGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [heroFilter, setHeroFilter] = useState('all');
  const [editing, setEditing] = useState<TextureGridItem | null>(null);
  const [openFamilyKey, setOpenFamilyKey] = useState<string | null>(null);
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

  // Hero dropdown scoped to codenames that actually have a family here. The
  // options resolve through the same buildHeroFilterOptions path the Library
  // catalog uses: the old silent fallback to the raw codename is what let an
  // unplaceable codename pose as a hero, and the shared helper already draws
  // the distinction that heroPortraitIdentity is the single source for.
  const heroOptions = useMemo(
    () =>
      buildHeroFilterOptions({
        codenames: families.flatMap((family) => (family.hero ? [family.hero] : [])),
        heroNames,
        labels: {
          all: t('foundry.filters.allHeroes', 'All heroes'),
          unresolved: t('foundry.filters.unreleasedGroup', 'Unreleased or internal'),
        },
      }),
    [families, heroNames, t],
  );
  const hasHeroOptions = heroOptions.some((option) => option.value !== 'all');

  // A hero workshop has a roster codename, while the texture catalog has a
  // panorama codename. They only meet through the shared portrait resolver.
  const scope = hero ? (heroNames.get(hero) ?? hero) : (heroFilter === 'all' ? null : heroFilter);
  const scopedFamilies = useMemo(
    () => (scope ? portraitFamiliesForHero(families, scope) : families),
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
  // Named the way every other surface names them. This line used to list the
  // raw compiled tokens (`mm`, `sm`, `card_critical`) beside cards that said
  // "Minimap icon", which is the same one-thing-two-names problem the shared
  // vocabulary exists to end.
  const targetVariants = useMemo(() => {
    const labels = scopedFamilies.flatMap((family) =>
      family.variants.map((variant) => {
        const canonical = normalizePortraitVariant(variant.key);
        const key = sharedVariantLabelKey(canonical);
        return key ? t(key) : canonical;
      }),
    );
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b));
  }, [scopedFamilies, t]);

  // Codenames a completed read left unplaceable: no alias-table entry and no
  // roster name. Each keeps its raw token in a neutral tag rather than posing
  // as a hero. This derives from the visible set only, so it never renders
  // while the catalog is still loading and never for a read that failed (both
  // branches render before this one).
  const unresolvedCodenames = useMemo(
    () =>
      [...new Set(visible.flatMap((family) => (family.hero ? [family.hero] : [])))]
        .filter((code) => displayNameForHeroCodename(code) === null)
        .sort(),
    [visible],
  );

  /**
   * Ownership, but only where asking is bounded.
   *
   * A hero-pinned surface is a handful of families, so one inspection answers
   * "what does the game actually draw" for all of them. Catalog mode is
   * thousands of entries and deliberately asks nothing: every family there
   * reports `unknown`, which is the honest answer and is what stops the card
   * from presenting the stock art as current (2026-07-30 matrix, finding 1).
   */
  const inspectPaths = useMemo(
    () =>
      hero
        ? [
            ...new Set(
              scopedFamilies.flatMap((family) =>
                family.variants.map((variant) => normalizePortraitPath(variant.path)),
              ),
            ),
          ].sort()
        : [],
    [hero, scopedFamilies],
  );
  const inspection = useAssetSourceInspection(
    inspectPaths,
    inspectPaths.length > 0,
    foundryInspectAssetSources,
  );

  // The shared view model (#10 Part 2 item 9). Built from the same families the
  // editor and the staging preflight work in, so a card can never present a
  // narrower or wider family than a change here would write.
  const viewByKey = useMemo(() => {
    const views = buildPortraitFamilyViews({
      heroName: scope ?? undefined,
      slots: visible.flatMap((family) =>
        family.variants.map((variant) => ({
          path: variant.path,
          hero: variant.item.hero ?? family.hero,
          width: variant.item.sourceWidth,
          height: variant.item.sourceHeight,
          stockImage: variant.item.thumbUrl,
          label: variant.item.label,
        })),
      ),
      ...portraitClaimsFromInspection(inspection.result),
    });
    return new Map(views.map((view) => [view.key, view]));
  }, [visible, scope, inspection.result]);

  const itemByPath = useMemo(
    () => new Map(items.map((item) => [normalizePortraitPath(item.path), item])),
    [items],
  );
  const openFamily = openFamilyKey ? viewByKey.get(openFamilyKey) ?? null : null;

  // A deep link only fires once the catalog it names has loaded, and only when
  // the family is really there: an unknown key leaves the user on the list.
  // Consumed exactly once, during render, so closing the preview does not
  // immediately reopen it while the query string is still in the URL.
  const [linkConsumed, setLinkConsumed] = useState(false);
  if (!linkConsumed && initialFamilyKey && !loading) {
    setLinkConsumed(true);
    if (viewByKey.has(initialFamilyKey)) setOpenFamilyKey(initialFamilyKey);
  }

  const variantLabel = useCallback(
    (variant: PortraitVariantView) => {
      const key = sharedVariantLabelKey(variant.key);
      return portraitVariantDisplay(key ? t(key) : variant.key, variant);
    },
    [t],
  );

  /** Open the crop controls on the family member the user was looking at. */
  const editVariant = useCallback(
    (variant: PortraitVariantView) => {
      const item = itemByPath.get(variant.path);
      if (!item) return;
      setOpenFamilyKey(null);
      setEditing(item);
    },
    [itemByPath],
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
        {!hero && hasHeroOptions && (
          <div className="flex items-center gap-1.5">
            <Users size={14} className="flex-shrink-0 text-text-secondary" aria-hidden="true" />
            {/* Not a native select: each row carries a hero name over its engine
                codename, which `<option>` cannot lay out. The shared resolver
                replaces the old silent codename fallback: a codename the table
                cannot place keeps its raw token and reads as unresolved rather
                than posing as a hero. */}
            <HeroSelect
              value={heroFilter}
              options={heroOptions}
              onChange={setHeroFilter}
              ariaLabel={t('foundry.filters.heroLabel', 'Filter assets by hero')}
              placeholder={t('foundry.filters.allHeroes', 'All heroes')}
              size="sm"
              className="w-56"
              search={{
                ariaLabel: t('foundry.filters.heroSearchLabel', 'Search heroes'),
                placeholder: t('foundry.filters.heroSearchPlaceholder', 'Hero or codename...'),
                getEmptyMessage: (query) =>
                  t('foundry.filters.heroSearchEmpty', 'No hero matches "{{query}}".', { query }),
                clearLabel: t('foundry.filters.heroSearchClear', 'Clear hero search'),
                scope: t('foundry.filters.heroSearchScope', 'Searches hero names and engine codenames.'),
                getResultCount: (visible, total) =>
                  t('foundry.filters.heroSearchCount', 'Showing {{visible}} of {{total}} heroes', {
                    visible,
                    total,
                  }),
              }}
            />
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
            title={<Tx k="foundry.portraits.catalogFailed.title" fallback="Portrait catalog could not be read" />}
            description={
              <>
                <Tx
                  k="foundry.portraits.catalogFailed.description"
                  fallback="Something went wrong reading your installed game files. Try again, or check the game path in Settings."
                />
                {error && <span className="mt-1 block font-mono text-xs text-text-secondary/70">{error}</span>}
              </>
            }
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
        <div className={`space-y-3 ${VEILED_CONTENT_CLASS}`}>
          <EmptyState
            icon={Images}
            title={<Tx k="foundry.portraits.notIndexed.title" fallback="No base-game portrait family found" />}
            description={<Tx k="foundry.portraits.notIndexed.description" fallback="This hero has no indexed editable portrait family in this game build. Browse the global catalog or report the missing mapping." />}
            action={<a href="/foundry?section=portraits" className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-primary hover:border-accent/50">{t('foundry.portraits.browseGlobal', 'Browse global portrait catalog')}</a>}
          />
          <div className="flex justify-center"><CatalogDiagnostics /></div>
        </div>
      ) : visible.length === 0 ? (
        /* Two different facts, two different messages. Reading one string for
           both is why the 2026-07-29 Abrams report could not be diagnosed: a
           search that matches nothing and a catalog that indexed nothing looked
           identical. The width cap keeps this on the frosted veil rather than
           centring it over the hero's face, which is what the fluid content
           pane does unaided (matrix findings 5 and 6). */
        <div className={VEILED_CONTENT_CLASS}>
          {hasActiveFilter ? (
            <EmptyState
              icon={Images}
              title={<Tx k="foundry.portraits.filtered.title" fallback="Nothing matches this search" />}
              description={t('foundry.portraits.filtered.description', {
                total: scopedFamilies.length,
              })}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    if (!hero) setHeroFilter('all');
                  }}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-primary hover:border-accent/50 cursor-pointer"
                >
                  {t('foundry.search.clearFilters', 'Clear search and filters')}
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              <EmptyState
                icon={Images}
                title={<Tx k="foundry.portraits.empty.title" fallback="No portraits in the catalog" />}
                description={
                  <Tx
                    k="foundry.portraits.empty.description"
                    fallback="No portrait families were indexed from your game files. This is a catalog result, not a filter: nothing is being hidden."
                  />
                }
              />
              <div className="flex justify-center"><CatalogDiagnostics /></div>
            </div>
          )}
        </div>
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
          {/* An unplaceable family is a fact, not a card with a blank hero:
              one hint for the group and one neutral tag per raw codename. The
              raw token lives in each tag's title, so length never widens the
              layout. */}
          {unresolvedCodenames.length > 0 && !hero && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-snug text-text-secondary">
              <span>{t('portrait.family.unresolvedHint')}</span>
              {unresolvedCodenames.map((code) => (
                <Tag key={code} tone="neutral" title={code}>
                  {t('portrait.family.unresolvedTag')}
                </Tag>
              ))}
            </p>
          )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
          {visible.map((family) => {
            const view = viewByKey.get(family.key);
            if (!view) return null;
            return (
              <PortraitFamilyCard
                key={family.key}
                family={view}
                // A pinned-hero surface (the workshop section) says the hero
                // once in its own chrome; repeating it on every card is noise.
                showHero={!hero}
                onOpen={() => setOpenFamilyKey(family.key)}
              />
            );
          })}
        </div>
        </div>
      )}

      {/* Compare before cropping (#10 Part 2 items 2, 3, 10): the expanded
          family opens first, and the crop controls are one explicit step
          further in. Nothing here installs or stages anything. */}
      <PortraitFamilyPreview
        family={openFamily}
        onClose={() => setOpenFamilyKey(null)}
        actions={(variant) =>
          onStage ? (
            <button
              type="button"
              onClick={() => editVariant(variant)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {t('portrait.family.editVariant', { variant: variantLabel(variant) })}
            </button>
          ) : null
        }
        footer={
          openFamily && (
            <details className="rounded-sm border border-border/60 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] text-text-secondary hover:text-text-primary">
                {t('portrait.family.sourcesTitle')}
              </summary>
              <AssetSourcesPanel
                paths={openFamily.variants.map((variant) => variant.path)}
                pathLabels={Object.fromEntries(
                  openFamily.variants.map((variant) => [variant.path, variantLabel(variant)]),
                )}
                inspection={hero ? inspection.result : undefined}
                inspectionLoading={hero ? inspection.loading : undefined}
                inspectionError={hero ? inspection.error : undefined}
                onRefreshInspection={hero ? inspection.refresh : undefined}
              />
            </details>
          )
        }
      />

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
