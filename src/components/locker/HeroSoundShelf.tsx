import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileWarning, Hammer } from 'lucide-react';
import SoundEntryRow from './SoundEntryRow';
import HeroSoundPicker from './HeroSoundPicker';
import { useSoundAnnotations } from './useSoundAnnotations';
import { useClipPlayer } from '../foundry/useClipPlayer';
import { useAppStore } from '../../stores/appStore';
import {
  buildSoundInventory,
  entriesInCategory,
  overlappingClaims,
  type SoundCategory,
} from '../../lib/soundInventory';
import type { Mod } from '../../types/mod';

/**
 * One hero's installed sound shelf, as the body of the Locker hero page's
 * Sounds section.
 *
 * This used to be a whole separate destination (a second hero grid behind a
 * Looks/Sounds mode switch) whose content was strictly richer than the
 * picker-only Sounds tab the hero page already had. Two surfaces for one
 * hero's sounds is the redundancy; the hero page keeps the tab, and this is
 * what that tab renders.
 *
 * Categories are shown as an inline filter rather than a second rail, because
 * the hero page's rail already belongs to Skins / Sounds / Cards / Effects.
 */

/** Sections a hero shelf can show, in reading order. Global-only categories
 *  (announcer, music, ui) never appear here: they have no hero. */
const HERO_SECTIONS: readonly SoundCategory[] = ['ability', 'voice', 'weapon', 'movement', 'unclassified'];

const SECTION_FALLBACK: Record<string, string> = {
  ability: 'Abilities',
  voice: 'Voice',
  weapon: 'Weapon',
  movement: 'Movement',
  unclassified: 'Needs classification',
};

/** Which Foundry workshop section authors this kind of sound. Voice lines live
 *  under Voice; everything else a hero makes is authored from Abilities. */
function foundrySectionFor(category: SoundCategory): string {
  return category === 'voice' ? 'voice' : 'abilities';
}

interface HeroSoundShelfProps {
  heroName: string;
  /** This hero's installed sound mods, as the hero page already resolved them. */
  soundList: Mod[];
  onSelect: (modId: string) => void | Promise<void>;
}

export default function HeroSoundShelf({ heroName, soundList, onSelect }: HeroSoundShelfProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const player = useClipPlayer();
  const mods = useAppStore((s) => s.mods);
  const annotations = useSoundAnnotations();
  const [category, setCategory] = useState<SoundCategory>('ability');

  const entries = useMemo(
    () => buildSoundInventory(mods).byHero.get(heroName) ?? [],
    [mods, heroName]
  );
  const audioUrls = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const mod of mods) if (mod.audioUrl) map[mod.id] = mod.audioUrl;
    return map;
  }, [mods]);

  const counts = useMemo(
    () =>
      HERO_SECTIONS.map((id) => ({ id, count: entriesInCategory(entries, id).length })),
    [entries]
  );

  // Never rest on an empty category: fall back to the first one that has rows.
  const active: SoundCategory =
    entriesInCategory(entries, category).length > 0
      ? category
      : (counts.find((entry) => entry.count > 0)?.id ?? 'ability');

  const shown = entriesInCategory(entries, active);
  // The local half of "only one mod should own an event": recorded claims only,
  // so it can only under-report. The per-row inspection is the authority.
  const overlaps = useMemo(() => overlappingClaims(shown), [shown]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('soundLocker.hero.sections', 'Sound sections')}>
        {counts.map(({ id, count }) => {
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              disabled={count === 0}
              aria-pressed={selected}
              title={
                count === 0
                  ? t('soundLocker.hero.emptySection', 'No installed sound mods in this section.')
                  : undefined
              }
              onClick={() => setCategory(id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selected
                  ? 'border-accent/60 bg-accent/15 text-text-primary'
                  : 'border-border/70 text-text-secondary hover:border-accent/50 hover:text-text-primary'
              } ${count === 0 ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
            >
              {t(`soundLocker.category.${id}`, SECTION_FALLBACK[id])}{' '}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            navigate(
              `/foundry?hero=${encodeURIComponent(heroName)}&section=${encodeURIComponent(foundrySectionFor(active))}`
            )
          }
          className="ml-auto flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary cursor-pointer"
        >
          <Hammer className="h-3.5 w-3.5" />
          {t('soundLocker.hero.makeInFoundry', 'Make a new one in Foundry')}
        </button>
      </div>

      {overlaps.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <FileWarning className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {t(
              'soundLocker.hero.overlapWarning',
              '{{count}} sound files are claimed by more than one enabled mod here. Only the highest-priority mod is heard; expand a row to see who wins.',
              { count: overlaps.length }
            )}
          </span>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 p-3 text-xs text-text-secondary">
          {t('soundLocker.hero.empty', 'No installed sound mods in this section for {{hero}}.', {
            hero: heroName,
          })}
        </p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((entry) => (
            <SoundEntryRow
              key={entry.key}
              entry={entry}
              annotations={annotations}
              audioUrl={audioUrls[entry.modId]}
              player={player}
              onToggleEnabled={onSelect}
              onOpenInInstalled={(modId) => navigate(`/?focusMod=${encodeURIComponent(modId)}`)}
            />
          ))}
        </div>
      )}

      {/* Installed rows are deliberately first: this is the inventory and
          enablement surface. The per-ability picker is a secondary panel for
          the Locker-managed selections it can build from those rows. */}
      <div className="mt-6 rounded-xl border border-white/10 bg-bg-secondary/65 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        <HeroSoundPicker
          heroName={heroName}
          soundList={soundList}
          onSelect={onSelect}
          panelTitle={t('soundLocker.hero.currentSelections', 'Current selections')}
          panelDescription={t(
            'soundLocker.hero.currentSelectionsDescription',
            'Choose the source Grimoire applies for each ability. These selections are independent of a mod’s installed row above.',
          )}
        />
      </div>
    </section>
  );
}
