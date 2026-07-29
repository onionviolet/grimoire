import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AudioLines, ChevronDown, Hammer, Music } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/common/PageComponents';
import Tx from '../components/translation/Tx';
import SoundEntryRow from '../components/locker/SoundEntryRow';
import { useClipPlayer } from '../components/foundry/useClipPlayer';
import { useAppStore } from '../stores/appStore';
import { foundrySoundAnnotations } from '../lib/api';
import {
  buildSoundInventory,
  categoriesPresent,
  entriesInCategory,
  type SoundCategory,
} from '../lib/soundInventory';
import type { SoundAnnotation } from '../types/foundry';

/**
 * The Global sounds shelf: installed sound mods that belong to no hero.
 *
 * Per-hero sounds used to live here too, behind a Looks/Sounds mode switch and
 * a second hero grid. They are now a tab on the hero's own Locker page
 * (`HeroSoundShelf`), which already had a Sounds section. What is left is the
 * content that genuinely has no hero to hang off: announcers, music, interface
 * sounds, shared melee, and anything unclassified.
 *
 * Reached as the Sounds tab of the Global drill-in (`/locker/global?mode=sounds`).
 * Foundry's Global sounds tool remains the authoring side; this is where the
 * resulting installed swap is heard, enabled, traced, or removed.
 */

const GLOBAL_SECTIONS: readonly SoundCategory[] = ['ui', 'music', 'ambience', 'npc', 'item', 'shared', 'melee', 'announcer', 'other'];

const GLOBAL_FALLBACK: Record<string, string> = {
  announcer: 'Announcer',
  music: 'Music',
  ui: 'Interface',
  ambience: 'Ambience',
  npc: 'NPC',
  item: 'Items',
  melee: 'Shared melee',
  shared: 'Shared',
  other: 'Other',
};

export default function SoundLocker() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mods = useAppStore((s) => s.mods);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
  const player = useClipPlayer();

  // Personal names for events, loaded once. A failure is not fatal: the rows
  // fall back to the raw event paths.
  useEffect(() => {
    let active = true;
    foundrySoundAnnotations()
      .then((result) => {
        if (active) setAnnotations(result);
      })
      .catch(() => {
        // Provenance detail only; never blank the inventory over it.
      });
    return () => {
      active = false;
    };
  }, []);

  const inventory = useMemo(() => buildSoundInventory(mods), [mods]);
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
            {/* A drill-in, so it always keeps a visible way back to the grid. */}
            <button
              type="button"
              onClick={() => navigate('/locker')}
              className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
            >
              <ChevronDown size={15} className="rotate-90" />
              <Tx k="locker.page.backToLocker" fallback="Back to Locker" />
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
          action={
            <button
              type="button"
              onClick={() => navigate('/foundry?tool=globalSound')}
              className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
            >
              <Hammer size={15} />
              <Tx k="soundLocker.global.makeNew" fallback="Make one in Foundry" />
            </button>
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
                    player={player}
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
