import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HeroInfo } from '../../types/foundry';
import { canonicalHeroName, getHeroChipIconPath } from '../../lib/lockerUtils';
import { useHeroRenderFallback } from '../../lib/heroRenderFallback';
import { useHeroFavorites } from '../../lib/heroFavorites';
import { useAppStore } from '../../stores/appStore';
import { countFoundryChangesByHero } from './changeList';
import ResultSummary from '../common/ResultSummary';

interface FoundryHeroGridProps {
  /** Full roster from `catalog heroes`. */
  heroes: HeroInfo[];
  /** Open the per-hero workshop for the picked hero. */
  onPick: (hero: HeroInfo) => void;
}

/**
 * The Foundry landing: an aesthetic roster grid. Pick a hero to open their
 * workshop (the per-hero "edit everything" view). Mirrors the Locker's
 * hero-first entry, but lands in the creation workflow rather than installed
 * mods.
 *
 * Like the Locker grid, it shows state rather than only a roster: favorites
 * float to the top and each card badges what you have already made for that
 * hero. Both come from data Foundry already had. Favorites are the Locker's own
 * store, so a hero starred in one grid reads as starred in the other.
 *
 * Within each group: heroes with authored changes first, then selectable
 * heroes, then in-development ones, alphabetical inside each.
 */
export default function FoundryHeroGrid({ heroes, onPick }: FoundryHeroGridProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const summaryId = useId();
  const mods = useAppStore((s) => s.mods);
  const modsLoaded = useAppStore((s) => s.modsLoaded);
  const loadMods = useAppStore((s) => s.loadMods);
  const { isFavorite, toggleFavorite } = useHeroFavorites();

  // The badges are derived from installed-mod provenance, so the grid needs the
  // mod list even when the user never opens a workshop.
  useEffect(() => {
    if (!modsLoaded) void loadMods();
  }, [modsLoaded, loadMods]);

  // Lifted from the same rows `My changes` lists, rather than a second query
  // path that could count something different from what the workshop shows.
  const changeCounts = useMemo(() => countFoundryChangesByHero(mods), [mods]);
  const countFor = useCallback(
    (hero: HeroInfo) => changeCounts.get(canonicalHeroName(hero.name)) ?? 0,
    [changeCounts]
  );

  // The roster the search narrows, which is the selectable heroes rather than
  // every row in the catalog: "of 38" has to match what an empty field shows.
  const rosterCount = useMemo(() => heroes.filter((h) => !h.disabled).length, [heroes]);

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes
      .filter((h) => !h.disabled)
      .filter((h) => (q ? h.name.toLowerCase().includes(q) || h.codename.includes(q) : true))
      .sort((a, b) => {
        const aFav = isFavorite(a.name);
        const bFav = isFavorite(b.name);
        if (aFav !== bFav) return aFav ? -1 : 1;
        const aMade = countFor(a) > 0;
        const bMade = countFor(b) > 0;
        if (aMade !== bMade) return aMade ? -1 : 1;
        if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [heroes, query, isFavorite, countFor]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-2 w-full max-w-xs">
        <Search size={15} className="text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('foundry.heroes.search', 'Search heroes')}
          aria-describedby={summaryId}
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
        />
      </div>
      <ResultSummary
        id={summaryId}
        className="-mt-3 text-[11px]"
        scope={t('foundry.heroes.searchScope', 'Searches hero names and codenames.')}
        summary={
          query.trim()
            ? t('foundry.heroes.resultCount', 'Showing {{visible}} of {{total}} heroes', {
                visible: ordered.length,
                total: rosterCount,
              })
            : undefined
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
        {ordered.map((hero) => (
          <HeroCard
            key={hero.codename}
            hero={hero}
            changeCount={countFor(hero)}
            favorite={isFavorite(hero.name)}
            onToggleFavorite={() => toggleFavorite(hero.name)}
            onPick={() => onPick(hero)}
          />
        ))}
      </div>

      {ordered.length === 0 && (
        <p className="text-sm text-text-secondary">
          {t('foundry.heroes.noMatch', 'No heroes match that search.')}
        </p>
      )}
    </div>
  );
}

function HeroCard({
  hero,
  changeCount,
  favorite,
  onToggleFavorite,
  onPick,
}: {
  hero: HeroInfo;
  changeCount: number;
  favorite: boolean;
  onToggleFavorite: () => void;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  // Render, wiki render, chip icon, name text: the shared four-step chain, so
  // the grid and the detail view degrade identically.
  const { src, onError } = useHeroRenderFallback(hero.name, getHeroChipIconPath(hero.name));
  const isIconStep = src === getHeroChipIconPath(hero.name);

  return (
    <div
      className={`group relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-bg-secondary transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg hover:shadow-black/30 ${
        hero.selectable ? '' : 'opacity-70'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        title={hero.name}
        className="absolute inset-0 z-0 flex cursor-pointer flex-col justify-end text-left"
      >
        {src ? (
          <img
            src={src}
            alt={hero.name}
            loading="lazy"
            onError={onError}
            className={
              isIconStep
                ? 'absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 object-contain opacity-80'
                : 'absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105'
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-sm font-medium text-text-secondary">
            {hero.name}
          </div>
        )}

        {/* Bottom gradient + name plate. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="relative z-10 p-2">
          <span className="block truncate text-sm font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
            {hero.name}
          </span>
          {!hero.selectable && (
            <span className="text-[10px] uppercase tracking-wide text-accent/90">
              {t('foundry.heroes.inDevelopment')}
            </span>
          )}
        </div>
      </button>

      {/* What you have already made for this hero. Absent rather than "0": an
          empty badge would be noise on most of the roster. */}
      {changeCount > 0 && (
        <span
          title={t('foundry.heroes.changeCount', { count: changeCount })}
          className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground"
        >
          {changeCount}
        </span>
      )}

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        title={favorite ? t('foundry.heroes.unfavorite') : t('foundry.heroes.favorite')}
        aria-label={favorite ? t('foundry.heroes.unfavorite') : t('foundry.heroes.favorite')}
        className={`absolute right-1.5 top-1.5 z-10 cursor-pointer rounded-full p-1 transition-colors ${
          favorite
            ? 'bg-yellow-400/25 text-yellow-300'
            : 'bg-black/45 text-white/60 opacity-0 hover:text-white group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
