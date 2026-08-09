import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Volume2,
} from 'lucide-react';
import {
  foundrySoundAnnotationKey,
  getHeroSoundWriteSet,
  listUnknownModFiles,
} from '../../lib/api';
import { useAssetClaims } from '../../lib/useAssetClaims';
import { collapseClipTakes } from '../../lib/soundLabels';
import { soundEntriesInVpk, type SoundInventoryEntry } from '../../lib/soundInventory';
import type { ClipPlayer } from '../foundry/useClipPlayer';
import type { SoundAnnotation } from '../../types/foundry';
import AudioPreviewPlayer from '../AudioPreviewPlayer';
import { useAppStore } from '../../stores/appStore';

/**
 * One installed sound mod on a Sound Locker shelf.
 *
 * The row itself is free: everything on it comes off the inventory model, which
 * is folded from mod metadata the renderer already has. The two questions that
 * cost an IPC call ("what exactly does this write" and "who wins it") are asked
 * only when the user expands the row, which is the same on-demand contract
 * `AssetSourcesPanel` and the Locker's slot disclosure already keep: resolving
 * them eagerly would parse a VPK directory per mod on every page open.
 */

interface SoundEntryRowProps {
  entry: SoundInventoryEntry;
  /** Personal sound annotations, keyed by `foundrySoundAnnotationKey`. */
  annotations: Record<string, SoundAnnotation>;
  /** GameBanana preview clip, when the mod was downloaded with one. */
  audioUrl?: string;
  player: ClipPlayer;
  onToggleEnabled: (modId: string) => void | Promise<void>;
  onOpenInInstalled: (modId: string) => void;
}

const PROVENANCE_FALLBACK: Record<SoundInventoryEntry['provenance'], string> = {
  locker: 'Locker',
  forged: 'Forged',
  downloaded: 'Downloaded',
  imported: 'Imported',
  'third-party': 'Third-party',
};

export default function SoundEntryRow({
  entry,
  annotations,
  audioUrl,
  player,
  onToggleEnabled,
  onOpenInInstalled,
}: SoundEntryRowProps) {
  const { t } = useTranslation();
  const soundVolume = useAppStore((s) => s.soundVolume);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Null = not resolved yet. An empty array is a real answer: "this mod records
  // nothing we can name", which the panel says out loud rather than hiding.
  const [paths, setPaths] = useState<string[] | null>(entry.paths.length ? entry.paths : null);
  const [resolving, setResolving] = useState(false);

  /**
   * The exact entries this mod writes, from whichever record actually has them.
   * A forged swap recorded its own clip paths; a classified ability mod has
   * none recorded, but `getHeroSoundWriteSet` can read them straight out of its
   * VPK for a (hero, slot). Neither is inferred from a label.
   *
   * A global sound mod (a downloaded music or announcer pack) is neither: it
   * has no hero and no ability slot, so both of those records are empty and the
   * row used to say it could not name anything "without opening its VPK". So
   * open it. `listUnknownModFiles` parses the installed VPK's directory, which
   * is the same read the Installed page and the conflict scanner already do,
   * and the sound entries in that list are the write set.
   */
  const resolvePaths = useCallback(async () => {
    if (paths !== null || resolving) return;
    setResolving(true);
    try {
      if (entry.hero && entry.slots.length > 0) {
        const perSlot = await Promise.all(
          entry.slots.map((slot) =>
            getHeroSoundWriteSet(entry.hero as string, slot, entry.metaKey).catch(() => [] as string[])
          )
        );
        const recorded = [...new Set(perSlot.flat())].sort();
        if (recorded.length > 0) {
          setPaths(recorded);
          return;
        }
      }
      // Either not a hero/slot mod at all, or one whose slots resolved to
      // nothing. The VPK is the authority either way.
      const listing = await listUnknownModFiles(entry.modId).catch(() => null);
      setPaths(listing ? soundEntriesInVpk(listing.paths) : []);
    } finally {
      setResolving(false);
    }
  }, [entry.hero, entry.metaKey, entry.modId, entry.slots, paths, resolving]);

  useEffect(() => {
    if (expanded) void resolvePaths();
  }, [expanded, resolvePaths]);

  // Who actually wins each path right now. The shared asset-claims index, which
  // is the same index Foundry's sources panel and the staging preflights read,
  // so the two surfaces cannot disagree about ownership and neither re-derives
  // it (S1). It also refreshes itself when a mod is toggled anywhere, which the
  // old one-shot fetch here could not: it cached its first answer forever.
  const claims = useAssetClaims(paths, expanded);
  const inspection = claims.index?.raw ?? null;
  const inspectError = claims.error;

  // Numbered takes of one sound are one row with a count: three rows saying
  // `ball_01/02/03` cost three lines and say one thing.
  const runs = useMemo(() => collapseClipTakes(paths ?? []), [paths]);

  const toggle = async () => {
    setBusy(true);
    try {
      await onToggleEnabled(entry.modId);
    } finally {
      setBusy(false);
    }
  };

  // Projected off the index rather than looked up again here (S4). "Someone
  // else wins this" is the only case the row renders, so a win by this very mod
  // still returns null.
  const winnerFor = (path: string): { modId: string; modName: string } | null => {
    const winner = claims.index?.winnerFor(path);
    if (!winner || winner.modId === entry.modId) return null;
    return { modId: winner.modId, modName: winner.modName };
  };

  return (
    <div
      className={`overflow-hidden rounded border backdrop-blur-sm transition-colors ${
        entry.enabled ? 'border-accent/60 bg-accent/10' : 'border-border bg-bg-secondary/70'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-accent opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-text-primary" title={entry.name}>
            {entry.name}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-[10px] text-text-secondary">
            <span className="rounded-full bg-bg-tertiary px-1.5 py-px uppercase tracking-wide">
              {t(`soundLocker.provenance.${entry.provenance}`, PROVENANCE_FALLBACK[entry.provenance])}
            </span>
            {entry.slots.length > 0 && (
              <span className="rounded-full bg-bg-tertiary px-1.5 py-px uppercase tracking-wide">
                {t('soundLocker.row.abilitySlots', 'a{{slots}}', { slots: entry.slots.join(', a') })}
              </span>
            )}
            {entry.fileCount > 0 && (
              <span>{t('soundLocker.row.fileCount', '{{count}} sound files', { count: entry.fileCount })}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenInInstalled(entry.modId)}
          title={t('common.provenance.openInInstalled', 'Open in Installed')}
          className="shrink-0 rounded-sm border border-border px-1.5 py-1 text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          aria-pressed={entry.enabled}
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 cursor-pointer ${
            entry.enabled
              ? 'bg-accent text-accent-foreground'
              : 'border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {busy ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : entry.enabled ? (
            t('soundLocker.row.on', 'On')
          ) : (
            t('soundLocker.row.off', 'Off')
          )}
        </button>
      </div>

      {audioUrl && (
        <div className="px-2.5 pb-1.5">
          <AudioPreviewPlayer src={audioUrl} compact variant="inline" volume={soundVolume} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1 border-t border-border/50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
      >
        <ChevronDown className={`h-3 w-3 ${expanded ? '' : '-rotate-90'}`} />
        {t('soundLocker.row.whatItChanges', 'What it changes')}
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-border/50 px-2.5 py-2">
          {entry.events.length > 0 && (
            <p className="truncate text-[10px] text-text-secondary" title={entry.events.join(', ')}>
              {t('soundLocker.row.events', 'Events: {{events}}', { events: entry.events.join(', ') })}
            </p>
          )}
          {resolving ? (
            <p className="flex items-center gap-1.5 text-[10px] text-text-secondary">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('soundLocker.row.reading', 'Reading this mod’s write set')}
            </p>
          ) : paths && paths.length === 0 ? (
            <p className="text-[10px] text-text-secondary/70">
              {t(
                'soundLocker.row.unknownWriteSet',
                'No sound entries were found in this mod’s VPK, so what it overrides cannot be named. Enabled state and load order still decide who wins.'
              )}
            </p>
          ) : (
            <>
              {inspectError && (
                <p className="flex items-start gap-1 text-[10px] text-state-danger">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  <span>{inspectError}</span>
                </p>
              )}
              {inspection && inspection.unreadableMods.length > 0 && (
                <p className="flex items-start gap-1 text-[10px] text-amber-300/90">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  <span>
                    {t('soundLocker.row.incomplete', 'Some installed VPKs could not be read: {{mods}}', {
                      mods: inspection.unreadableMods.map((entry) => entry.modName).join(', '),
                    })}
                  </span>
                </p>
              )}
              <ul className="max-h-56 space-y-1 overflow-auto">
                {runs.map((run) => {
                  const first = run.members[0];
                  const annotationKey = entry.events[0]
                    ? foundrySoundAnnotationKey(entry.events[0], first)
                    : null;
                  const personal = annotationKey ? annotations[annotationKey]?.name?.trim() : undefined;
                  const state = player.stateFor(first);
                  const winner = winnerFor(first);
                  return (
                    <li key={first} className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          player.toggle({ event: first, vsnd: run.members, sourceModId: entry.modId })
                        }
                        title={t('soundLocker.row.audition', 'Audition from this mod')}
                        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-accent transition-colors hover:bg-accent/15 cursor-pointer"
                      >
                        {state === 'loading' ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : state === 'playing' ? (
                          <Pause className="h-2.5 w-2.5" />
                        ) : (
                          <Play className="h-2.5 w-2.5 translate-x-px" />
                        )}
                      </button>
                      <span className="min-w-0 flex-1">
                        {/* The user's own name for the sound leads; the engine's
                            name for it follows, dimmer. */}
                        <span className="block truncate text-[11px] text-text-primary" title={first}>
                          {personal ? (
                            <span className="text-accent">{personal}</span>
                          ) : (
                            run.stem
                          )}
                          {run.takes > 1 && (
                            <span className="ml-1 text-[10px] text-text-secondary">
                              {t('soundLocker.row.takes', '{{count}} takes', { count: run.takes })}
                            </span>
                          )}
                        </span>
                        {winner && (
                          <span className="block truncate text-[10px] text-amber-300/90">
                            {t('soundLocker.row.overriddenBy', 'Overridden by {{winner}}', {
                              winner: winner.modName,
                            })}{' '}
                            <button
                              type="button"
                              onClick={() => onOpenInInstalled(winner.modId)}
                              className="underline cursor-pointer"
                            >
                              {t('soundLocker.row.openWinner', 'open')}
                            </button>
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
