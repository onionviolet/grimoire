import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AudioLines, Hammer } from 'lucide-react';
import SoundEntryRow from './SoundEntryRow';
import { useSoundAnnotations } from './useSoundAnnotations';
import { useClipPlayer } from '../foundry/useClipPlayer';
import { useAppStore } from '../../stores/appStore';
import { globalSoundSectionLabel } from '../../lib/globalSoundSections';
import type {
  SoundCategory,
  SoundClassificationBasis,
  SoundInventoryEntry,
} from '../../lib/soundInventory';

/**
 * The Global sounds shelf: installed sound mods that belong to no hero
 * (announcers, killstreak music, interface sounds, shared melee, and anything
 * Grimoire could not classify).
 *
 * This was a page (`src/pages/SoundLocker.tsx`) with its own `PageHeader` and
 * its own Back button, reached by the Global drill-in's Sounds tab returning a
 * different component. Selecting the tab therefore unmounted the drill-in
 * shell, which is why Visuals became unreachable from Sounds. It is now a body
 * component rendered into `LockerGlobalView`'s right pane, mirroring
 * `HeroSoundShelf`: no header, no back control, no page padding of its own.
 *
 * The owning shell supplies the category (its rail lists global sound
 * categories exactly as it lists visual types) and the pane heading, so this
 * renders rows and an empty state and nothing else.
 */

interface GlobalSoundShelfProps {
  /** The rail's selected category. The shell owns the selection. */
  category: SoundCategory;
  /** Entries in the selected category, in display order. */
  shown: readonly SoundInventoryEntry[];
}

export default function GlobalSoundShelf({ category, shown }: GlobalSoundShelfProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mods = useAppStore((s) => s.mods);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const annotations = useSoundAnnotations();
  const player = useClipPlayer();
  const categoryLabel = globalSoundSectionLabel(t, category);

  const audioUrls = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const mod of mods) if (mod.audioUrl) map[mod.id] = mod.audioUrl;
    return map;
  }, [mods]);

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

  if (shown.length === 0) {
    // Same dashed empty box the visual pane uses for an empty type, so the two
    // sections of this drill-in differ only in their content.
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-bg-sunken/30 px-6 py-12 text-center">
        <AudioLines className="h-8 w-8 text-white/40" />
        <p className="max-w-sm text-sm text-white/70">
          {t(
            'soundLocker.global.empty.description',
            'No installed {{type}} sound mods yet. Browse {{type}} sounds in Foundry to forge one.',
            { type: categoryLabel }
          )}
        </p>
        <button
          type="button"
          onClick={() =>
            navigate(`/foundry?tool=globalSound&category=${category}`)
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/60 hover:bg-accent/20 cursor-pointer"
        >
          <Hammer className="h-3.5 w-3.5" />
          {t('soundLocker.global.makeNew', 'Forge {{type}} sound', { type: categoryLabel })}
        </button>
      </div>
    );
  }

  return (
    // The rows sit on a surface of their own. `SoundEntryRow` tints rather
    // than fills (an enabled row is `bg-accent/10`), which reads correctly on
    // the hero page's opaque pane but let the Global drill-in's background art
    // through the moment these rows moved onto it. The visual pane solves the
    // same problem per card, with `bg-bg-sunken` behind the artwork; rows get
    // one shared surface instead, so the tint lands on this and not on the art.
    <div className="space-y-1.5 rounded-xl border border-white/10 bg-bg-sunken/60 p-3 backdrop-blur-sm">
      {shown.map((entry) => (
        <div key={entry.key} className="space-y-1">
          <SoundEntryRow
            entry={entry}
            annotations={annotations}
            audioUrl={audioUrls[entry.modId]}
            player={player}
            onToggleEnabled={toggleEnabled}
            onOpenInInstalled={openInInstalled}
          />
          {/* Needs classification is a work queue, and a queue item you cannot
              act on is just a complaint. Saying which evidence ran out tells
              the reader whether to expect a rule fix or an unreadable VPK. */}
          {category === 'unclassified' && (
            <p className="px-2 pb-0.5 text-[11px] text-white/45">
              {unclassifiedReason(t, entry.basis)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Why this entry is in the queue, in the reader's terms. */
function unclassifiedReason(
  t: (key: string, fallback: string) => string,
  basis: SoundClassificationBasis
): string {
  switch (basis) {
    case 'vpk':
      return t(
        'soundLocker.global.unclassified.vpk',
        'Its files were read, but none of their paths name a kind of sound we know.'
      );
    case 'recorded':
      return t(
        'soundLocker.global.unclassified.recorded',
        'It recorded what it writes, but those entries name no kind of sound we know.'
      );
    case 'download-category':
      return t(
        'soundLocker.global.unclassified.downloadCategory',
        'Only its download category was readable, and it describes how it was filed rather than what it changes.'
      );
    case 'projected':
      return t(
        'soundLocker.global.unclassified.projected',
        'Nothing in its classified contents named a kind of sound we know.'
      );
    case 'none':
    default:
      return t(
        'soundLocker.global.unclassified.none',
        'Nothing readable: its VPK lists no sound entries and it recorded none.'
      );
  }
}
