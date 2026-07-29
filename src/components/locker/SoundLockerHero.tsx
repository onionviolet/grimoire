import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, FileWarning, Hammer, Footprints, Music, Swords, Volume2 } from 'lucide-react';
import HeroDetailFrame, { type HeroDetailSection } from '../common/HeroDetailFrame';
import SoundEntryRow from './SoundEntryRow';
import { useClipPlayer } from '../foundry/useClipPlayer';
import {
  categoriesPresent,
  entriesInCategory,
  overlappingClaims,
  type SoundCategory,
  type SoundInventoryEntry,
} from '../../lib/soundInventory';
import { getHeroChipIconPath } from '../../lib/lockerUtils';
import type { SoundAnnotation } from '../../types/foundry';

/**
 * One hero's sound shelf: every installed sound mod that touches them, grouped
 * by what kind of sound it changes.
 *
 * The sections are the inventory model's categories, not the four ability slots
 * `HeroSoundPicker` uses. That is the split between the two surfaces: the picker
 * answers "which mod supplies ability 3", this answers "what sound content do I
 * have for this hero, and which of it is actually winning".
 */

/** Sections a hero shelf can show, in reading order. Global-only categories
 *  (announcer, music, ui) never appear here: they have no hero. */
const HERO_SECTIONS: readonly SoundCategory[] = ['ability', 'voice', 'weapon', 'movement', 'other'];

const SECTION_ICON: Record<SoundCategory, typeof Volume2> = {
  ability: Swords,
  voice: Volume2,
  weapon: Swords,
  movement: Footprints,
  music: Music,
  announcer: AudioLines,
  ui: AudioLines,
  other: AudioLines,
};

const SECTION_FALLBACK: Record<SoundCategory, string> = {
  ability: 'Abilities',
  voice: 'Voice',
  weapon: 'Weapon',
  movement: 'Movement',
  music: 'Music',
  announcer: 'Announcer',
  ui: 'Interface',
  other: 'Other',
};

/** Which Foundry workshop section authors this kind of sound. Voice lines live
 *  under Voice; everything else a hero makes is authored from Abilities. */
function foundrySectionFor(category: SoundCategory): string {
  return category === 'voice' ? 'voice' : 'abilities';
}

interface SoundLockerHeroProps {
  heroName: string;
  entries: SoundInventoryEntry[];
  /** Preview clip URLs by mod id, for downloaded mods that shipped one. */
  audioUrls: Record<string, string | undefined>;
  annotations: Record<string, SoundAnnotation>;
  activeSection: SoundCategory;
  onSectionChange: (section: SoundCategory) => void;
  onBack: () => void;
  onToggleEnabled: (modId: string) => void | Promise<void>;
  onOpenInInstalled: (modId: string) => void;
  onOpenInFoundry: (section: string) => void;
  /** Jump to this hero's Locker page, where the per-ability picker lives. */
  onOpenPicker: () => void;
}

export default function SoundLockerHero({
  heroName,
  entries,
  audioUrls,
  annotations,
  activeSection,
  onSectionChange,
  onBack,
  onToggleEnabled,
  onOpenInInstalled,
  onOpenInFoundry,
  onOpenPicker,
}: SoundLockerHeroProps) {
  const { t } = useTranslation();
  const player = useClipPlayer();
  const present = useMemo(() => categoriesPresent(entries), [entries]);

  const sections: Array<HeroDetailSection<SoundCategory>> = HERO_SECTIONS.map((category) => {
    const count = entriesInCategory(entries, category).length;
    return {
      id: category,
      label: t(`soundLocker.category.${category}`, SECTION_FALLBACK[category]),
      icon: SECTION_ICON[category],
      count,
      disabled: count === 0,
    };
  });

  // Fall back to the first section that actually has something, so a shelf
  // never opens on an empty pane.
  const section: SoundCategory =
    entriesInCategory(entries, activeSection).length > 0
      ? activeSection
      : (present.find((category) => HERO_SECTIONS.includes(category)) ?? 'ability');

  const shown = entriesInCategory(entries, section);
  // The local half of "only one mod should own an event": recorded claims only,
  // so it can only under-report. The per-row inspection is the authority.
  const overlaps = useMemo(() => overlappingClaims(shown), [shown]);

  return (
    <HeroDetailFrame
      heroName={heroName}
      heroIconUrl={getHeroChipIconPath(heroName)}
      backLabel={t('soundLocker.hero.back', 'Sound Locker')}
      onBack={onBack}
      navLabel={t('soundLocker.hero.sections', 'Sound sections')}
      sections={sections}
      activeSection={section}
      onSectionChange={onSectionChange}
      railTop={
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onOpenPicker}
            className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary cursor-pointer"
          >
            <Volume2 className="h-4 w-4" />
            {t('soundLocker.hero.openPicker', 'Pick sounds per ability')}
          </button>
          <button
            type="button"
            onClick={() => onOpenInFoundry(foundrySectionFor(section))}
            className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary cursor-pointer"
          >
            <Hammer className="h-4 w-4" />
            {t('soundLocker.hero.makeInFoundry', 'Make a new one in Foundry')}
          </button>
        </div>
      }
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-base font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
          {t(`soundLocker.category.${section}`, SECTION_FALLBACK[section])}
        </h3>
        <span className="text-xs text-white/60">
          {t('soundLocker.hero.modCount', '{{count}} mods', { count: shown.length })}
        </span>
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
              onToggleEnabled={onToggleEnabled}
              onOpenInInstalled={onOpenInInstalled}
            />
          ))}
        </div>
      )}
    </HeroDetailFrame>
  );
}
