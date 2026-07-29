import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AudioLines, ChevronDown, Globe, Hammer, Music, Volume2 } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/common/PageComponents';
import Tx from '../components/translation/Tx';
import SoundEntryRow from '../components/locker/SoundEntryRow';
import SoundLockerHero from '../components/locker/SoundLockerHero';
import { useClipPlayer } from '../components/foundry/useClipPlayer';
import { useAppStore } from '../stores/appStore';
import { foundrySoundAnnotations } from '../lib/api';
import { getAssetPath } from '../lib/assetPath';
import {
  buildSoundInventory,
  categoriesPresent,
  countEnabledMods,
  countMods,
  entriesInCategory,
  type SoundCategory,
} from '../lib/soundInventory';
import {
  HERO_NAMES_SORTED,
  canonicalHeroName,
  getHeroChipIconPath,
  getHeroRenderPath,
} from '../lib/lockerUtils';
import type { SoundAnnotation } from '../types/foundry';

/**
 * The Sound Locker: a hero-first home for the sound mods you already have.
 *
 * Sibling of the Locker rather than a tab inside it. The Locker's grid is built
 * from the GameBanana category tree and keys its routes by category id; the
 * sound inventory needs no such roster (every inbound link already speaks hero
 * names), so this page keys by name and costs no category fetch.
 *
 * See docs/sound-locker-plan.md for why this is a separate surface from
 * `HeroSoundPicker` rather than a bigger version of it.
 */

const GLOBAL_SECTIONS: readonly SoundCategory[] = ['announcer', 'music', 'ui', 'other'];

const GLOBAL_FALLBACK: Record<string, string> = {
  announcer: 'Announcer',
  music: 'Music',
  ui: 'Interface',
  other: 'Other',
};

export default function SoundLocker() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const mods = useAppStore((s) => s.mods);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
  const [showAllHeroes, setShowAllHeroes] = useState(false);
  const [section, setSection] = useState<SoundCategory>('ability');
  const globalPlayer = useClipPlayer();

  // Personal names for events, loaded once. A failure is not fatal: the rows
  // simply fall back to the engine's own naming.
  useEffect(() => {
    let cancelled = false;
    foundrySoundAnnotations()
      .then((entries) => {
        if (!cancelled) {
          setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const inventory = useMemo(() => buildSoundInventory(mods), [mods]);
  const audioUrls = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const mod of mods) if (mod.audioUrl) map[mod.id] = mod.audioUrl;
    return map;
  }, [mods]);

  const routeHero = useMemo(() => {
    const match = /^\/locker\/sounds\/hero\/(.+?)\/?$/.exec(location.pathname);
    return match ? canonicalHeroName(decodeURIComponent(match[1])) : null;
  }, [location.pathname]);
  const globalSelected = useMemo(
    () => /^\/locker\/sounds\/global\/?$/.test(location.pathname),
    [location.pathname]
  );

  // `?hero=<display name>` opens that hero's shelf, the same inbound contract
  // Locker and Foundry already honour. The query is replaced rather than kept so
  // a back-navigation cannot re-fire it.
  useEffect(() => {
    if (routeHero || globalSelected) return;
    const wanted = new URLSearchParams(location.search).get('hero');
    if (!wanted) return;
    const canonical = canonicalHeroName(wanted);
    const known = HERO_NAMES_SORTED.includes(canonical);
    navigate(known ? `/locker/sounds/hero/${encodeURIComponent(canonical)}` : '/locker/sounds', {
      replace: true,
    });
  }, [globalSelected, location.search, navigate, routeHero]);

  const openInInstalled = useCallback(
    (modId: string) => navigate(`/?focusMod=${encodeURIComponent(modId)}`),
    [navigate]
  );
  // The store reports whether the toggle stuck; the shelf renders from the mod
  // list either way, so the row only needs to know when the call has settled.
  const toggleEnabled = useCallback(
    async (modId: string) => {
      await toggleMod(modId);
    },
    [toggleMod]
  );

  if (routeHero) {
    return (
      <SoundLockerHero
        heroName={routeHero}
        entries={inventory.byHero.get(routeHero) ?? []}
        audioUrls={audioUrls}
        annotations={annotations}
        activeSection={section}
        onSectionChange={setSection}
        onBack={() => navigate('/locker/sounds')}
        onToggleEnabled={toggleEnabled}
        onOpenInInstalled={openInInstalled}
        onOpenInFoundry={(foundrySection) =>
          navigate(
            `/foundry?hero=${encodeURIComponent(routeHero)}&section=${encodeURIComponent(foundrySection)}`
          )
        }
        onOpenPicker={() => navigate(`/locker?hero=${encodeURIComponent(routeHero)}`)}
      />
    );
  }

  if (globalSelected) {
    const present = categoriesPresent(inventory.global).filter((category) =>
      GLOBAL_SECTIONS.includes(category)
    );
    return (
      <div className="space-y-4 p-6">
        <PageHeader
          title={<Tx k="soundLocker.global.title" fallback="Global sounds" />}
          description={
            <Tx
              k="soundLocker.global.description"
              fallback="Installed sound mods that belong to no hero: announcers, killstreak music, interface sounds, and anything Grimoire could not classify."
            />
          }
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/foundry?tool=globalSound')}
                className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
              >
                <Hammer size={15} />
                <Tx k="soundLocker.global.makeNew" fallback="Make one in Foundry" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/locker/sounds')}
                className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
              >
                <ChevronDown size={15} className="rotate-90" />
                <Tx k="soundLocker.global.back" fallback="Sound Locker" />
              </button>
            </div>
          }
        />
        {inventory.global.length === 0 ? (
          <EmptyState
            icon={AudioLines}
            title={<Tx k="soundLocker.global.empty.title" fallback="No global sound mods" />}
            description={
              <Tx
                k="soundLocker.global.empty.description"
                fallback="Announcer packs, killstreak music, and interface sounds show up here once you install one."
              />
            }
          />
        ) : (
          present.map((category) => {
            const shown = entriesInCategory(inventory.global, category);
            return (
              <section key={category} className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <Music size={14} className="text-accent" />
                  {t(`soundLocker.category.${category}`, GLOBAL_FALLBACK[category] ?? category)}
                  <span className="font-normal normal-case text-text-secondary/60">{shown.length}</span>
                </h3>
                <div className="space-y-1.5">
                  {shown.map((entry) => (
                    <SoundEntryRow
                      key={entry.key}
                      entry={entry}
                      annotations={annotations}
                      audioUrl={audioUrls[entry.modId]}
                      player={globalPlayer}
                      onToggleEnabled={toggleEnabled}
                      onOpenInInstalled={openInInstalled}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    );
  }

  const heroes = HERO_NAMES_SORTED.filter(
    (hero) => showAllHeroes || (inventory.byHero.get(hero)?.length ?? 0) > 0
  );

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={<Tx k="soundLocker.title" fallback="Sound Locker" />}
        description={
          <Tx
            k="soundLocker.description"
            fallback="Every sound mod you have installed, filed under the hero it changes. Audition it, see exactly what it overrides, and turn it on or off."
          />
        }
        action={
          <button
            type="button"
            onClick={() => setShowAllHeroes((value) => !value)}
            aria-pressed={showAllHeroes}
            className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
              showAllHeroes
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-border bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Volume2 size={15} />
            <Tx k="soundLocker.showAllHeroes" fallback="Show every hero" />
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {/* Always rendered: the Global shelf is the only home for announcer and
            music packs, so it must stay reachable with nothing installed yet. */}
        <button
          type="button"
          onClick={() => navigate('/locker/sounds/global')}
          className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-lg border border-accent/40 bg-bg-secondary p-3 text-left transition-colors hover:border-accent/70 cursor-pointer"
        >
          {/* Same environment art the Locker's own Global card uses, so the two
              shelves read as the same place. */}
          <img
            src={getAssetPath('/locker/global-bg.webp')}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-80"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/70 to-transparent"
          />
          <Globe className="absolute right-3 top-3 h-5 w-5 text-accent/70" />
          <div className="relative z-10">
            <div className="text-sm font-semibold text-text-primary">
              {t('soundLocker.global.title', 'Global sounds')}
            </div>
            <div className="text-[11px] text-text-secondary">
              {inventory.global.length > 0
                ? t('soundLocker.card.modCount', '{{count}} mods', {
                    count: countMods(inventory.global),
                  })
                : t('soundLocker.card.none', 'Nothing installed')}
            </div>
          </div>
        </button>

        {heroes.map((hero) => (
          <HeroSoundCard
            key={hero}
            hero={hero}
            entries={inventory.byHero.get(hero) ?? []}
            onOpen={() => navigate(`/locker/sounds/hero/${encodeURIComponent(hero)}`)}
          />
        ))}
      </div>

      {heroes.length === 0 && (
        <EmptyState
          icon={AudioLines}
          title={<Tx k="soundLocker.empty.title" fallback="No sound mods installed" />}
          description={
            <Tx
              k="soundLocker.empty.description"
              fallback="Download a sound mod, or forge one in Foundry, and it lands here under its hero."
            />
          }
        />
      )}
    </div>
  );
}

function HeroSoundCard({
  hero,
  entries,
  onOpen,
}: {
  hero: string;
  entries: ReturnType<typeof buildSoundInventory>['all'];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [renderFailed, setRenderFailed] = useState(false);
  const total = countMods(entries);
  const enabled = countEnabledMods(entries);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-lg border border-border bg-bg-secondary p-3 text-left transition-colors hover:border-accent/60 cursor-pointer"
    >
      <img
        src={renderFailed ? getHeroChipIconPath(hero) : getHeroRenderPath(hero)}
        alt=""
        aria-hidden
        onError={() => setRenderFailed(true)}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-80 transition-transform duration-300 group-hover:scale-105"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/70 to-transparent"
      />
      <div className="relative z-10">
        <div className="truncate text-sm font-semibold text-text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {hero}
        </div>
        <div className="text-[11px] text-text-secondary drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {total === 0
            ? t('soundLocker.card.none', 'Nothing installed')
            : t('soundLocker.card.summary', '{{count}} mods, {{enabled}} on', {
                count: total,
                enabled,
              })}
        </div>
      </div>
    </button>
  );
}
