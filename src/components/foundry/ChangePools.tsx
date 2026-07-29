import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Power,
  RefreshCw,
  Shuffle,
  Volume2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { foundryInspectAssetSources } from '../../lib/api';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';
import {
  buildFoundryPoolView,
  poolShuffleToggle,
  resolvePoolWinners,
  type FoundryPoolCard,
  type FoundryPoolMember,
  type FoundryPoolWinners,
} from './poolView';
import type { FoundryChangeEntry } from './changeList';
import type { Mod } from '../../types/mod';

export interface FoundryPoolListProps {
  /** The whole installed list: pools are global truth. */
  mods: readonly Mod[];
  /** The change rows currently visible in `My changes`. */
  changes: readonly FoundryChangeEntry[];
  included: ReadonlySet<string>;
  onToggleShuffleKey: (key: string) => void;
  onToggleMod: (modId: string) => void;
  onOpenInInstalled: (modId: string) => void;
  /** Lane D slot: render a thumbnail or an audition button for one member.
   *  Left undefined here, so the pool view stays free of asset loading. */
  renderMemberPreview?: (member: FoundryPoolMember) => ReactNode;
}

/**
 * Pool-first rendering of `My changes`. The flat list answers "where is my
 * thing"; this answers "which of these alternatives is the game going to load".
 *
 * Every grouping decision comes from `groupFoundryShufflePools` through
 * `buildFoundryPoolView`, and every winner comes from the same
 * `foundryInspectAssetSources` call the flat list already makes. This view owns
 * no ownership rule of its own, and it never changes enabled state directly:
 * the toggles call the same store actions Installed and the Locker call.
 */
export default function FoundryPoolList({
  mods,
  changes,
  included,
  onToggleShuffleKey,
  onToggleMod,
  onOpenInInstalled,
  renderMemberPreview,
}: FoundryPoolListProps) {
  const { t } = useTranslation();
  const [showSingles, setShowSingles] = useState(false);

  const view = useMemo(
    () => buildFoundryPoolView({ mods, changes, included }),
    [mods, changes, included],
  );
  const contended = view.pools.filter((pool) => !pool.single);
  const singles = view.pools.filter((pool) => pool.single);

  if (view.pools.length === 0 && view.unpooled.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">
        {t('poolView.empty', 'No pools to show. A pool appears when a change records the exact game paths it writes.')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {contended.length === 0 && (
        <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">
          {t('poolView.noContention', 'Nothing here contends with anything else yet. Every change writes paths no other change writes.')}
        </p>
      )}

      {contended.map((pool) => (
        <PoolCard
          key={pool.id}
          pool={pool}
          onToggleShuffleKey={onToggleShuffleKey}
          onToggleMod={onToggleMod}
          onOpenInInstalled={onOpenInInstalled}
          renderMemberPreview={renderMemberPreview}
        />
      ))}

      {/* A pool of one has nothing to decide, so it is collapsed by default
          rather than padding the view with cards that offer no choice. */}
      {singles.length > 0 && (
        <div className="rounded-sm border border-border">
          <button
            type="button"
            onClick={() => setShowSingles((value) => !value)}
            aria-expanded={showSingles}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] text-text-secondary hover:text-text-primary"
          >
            <ChevronDown size={11} className={showSingles ? '' : '-rotate-90'} />
            {t('poolView.singlesHidden', 'Changes with no alternatives yet ({{n}})', { n: singles.length })}
          </button>
          {showSingles && (
            <div className="border-t border-border/60">
              {singles.map((pool) => (
                <div key={pool.id} className="border-b border-border/40 px-3 py-2 last:border-b-0">
                  <p className="truncate text-sm text-text-primary">{pool.members[0]?.title}</p>
                  <p className="text-[11px] text-text-secondary">
                    {t('poolView.singleReason', 'Nothing else writes these paths, so there is only one possible outcome. It cannot be shuffled against anything yet.')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not the same thing as a pool of one, and worth saying separately: this
          change never recorded which paths it writes, so Grimoire cannot know
          what it competes with rather than having decided that it competes
          with nothing. */}
      {view.unpooled.length > 0 && (
        <div className="rounded-sm border border-border p-3">
          <p className="text-[11px] font-medium text-text-primary">
            {t('poolView.unpooledHeading', 'Not in any pool')}
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {t('poolView.unpooledReason', 'These changes have no recorded write set, so Grimoire cannot tell what they contend with. Rebuild them to record one.')}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {view.unpooled.map(({ entry }) => (
              <li key={entry.id} className="truncate text-[11px] text-text-secondary">{entry.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PoolCard({
  pool,
  onToggleShuffleKey,
  onToggleMod,
  onOpenInInstalled,
  renderMemberPreview,
}: {
  pool: FoundryPoolCard;
  onToggleShuffleKey: (key: string) => void;
  onToggleMod: (modId: string) => void;
  onOpenInInstalled: (modId: string) => void;
  renderMemberPreview?: (member: FoundryPoolMember) => ReactNode;
}) {
  const { t } = useTranslation();
  const [inspection, setInspection] = useState<FoundryAssetSourcesInspection | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [pathsOpen, setPathsOpen] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);
  const recheck = useCallback(() => setReloadToken((value) => value + 1), []);

  // A monotonic request id rather than a per-effect cancelled flag, so a slow
  // reply for an old path set can never overwrite a newer answer.
  const requestId = useRef(0);
  const inspect = useCallback(async (paths: string[]) => {
    const id = requestId.current + 1;
    requestId.current = id;
    setInspecting(true);
    setInspectError(null);
    setInspection(null);
    try {
      const result = await foundryInspectAssetSources(paths);
      if (requestId.current === id) setInspection(result);
    } catch (cause) {
      if (requestId.current === id) setInspectError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestId.current === id) setInspecting(false);
    }
  }, []);

  // Depend on a joined string rather than the array so a re-render with an
  // equal-but-new array does not re-run the IPC call.
  const entriesKey = pool.entries.join('\n');
  // Resolve on mount, and again whenever the pool's path set changes. The card
  // exists to say who wins, so making the user ask for it would be pointless.
  useEffect(() => {
    void inspect(entriesKey.split('\n').filter(Boolean));
  }, [entriesKey, reloadToken, inspect]);

  const winners = useMemo(() => resolvePoolWinners(pool, inspection), [pool, inspection]);
  const toggle = poolShuffleToggle(pool);

  return (
    <section className="rounded-sm border border-border">
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">
            {t('poolView.cardTitle', '{{n}} alternatives for the same game paths', { n: pool.members.length })}
          </p>
          <p className="truncate text-[11px] text-text-secondary" title={pool.contendedEntries.join(', ')}>
            {t('poolView.sharedPaths', 'Shared: {{paths}}', {
              paths: (pool.contendedEntries.length ? pool.contendedEntries : pool.entries).slice(0, 2).join(', '),
            })}
          </p>
        </div>
        {/* One control for the whole pool, because half a pool is not a
            shuffle: a member left out stays enabled and wins by load order. */}
        <button
          type="button"
          onClick={() => toggle.keys.forEach(onToggleShuffleKey)}
          aria-pressed={pool.allIncluded}
          title={pool.allIncluded
            ? t('poolView.shuffleOffHint', 'Take every member of this pool out of the launch shuffle')
            : t('poolView.shuffleOnHint', 'Put every member of this pool into the launch shuffle. One is picked at launch and the rest are turned off.')}
          className={`flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] ${
            pool.allIncluded
              ? 'border-accent/60 bg-accent/15 text-accent'
              : 'border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          <Shuffle size={12} />
          {pool.allIncluded
            ? t('poolView.shuffleOn', 'Shuffling this pool')
            : t('poolView.shuffleOff', 'Shuffle this pool')}
        </button>
      </header>

      {pool.anyIncluded && !pool.allIncluded && (
        <p className="flex items-start gap-1.5 border-b border-border/60 px-3 py-1.5 text-[11px] text-text-secondary">
          <AlertTriangle size={11} className="mt-px shrink-0 text-accent" />
          <span>{t('poolView.partialPool', 'Only some members are in the pool. Opting one in already makes the whole pool exclusive at launch, so add the rest to make the choice explicit.')}</span>
        </p>
      )}

      <div>
        {pool.members.map((member) => (
          <PoolMemberCell
            key={member.key}
            member={member}
            winners={winners}
            inspecting={inspecting}
            onToggleShuffleKey={onToggleShuffleKey}
            onToggleMod={onToggleMod}
            onOpenInInstalled={onOpenInInstalled}
            renderPreview={renderMemberPreview}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-1.5 text-[11px] text-text-secondary">
        {inspecting ? (
          <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {t('poolView.resolving', 'Resolving what wins each path')}</span>
        ) : inspectError ? (
          <span className="flex items-start gap-1 text-danger">
            <AlertTriangle size={11} className="mt-px shrink-0" />
            <span>{inspectError}</span>
          </span>
        ) : null}
        {inspection && inspection.unreadableMods.length > 0 && (
          <span className="flex items-start gap-1 text-danger">
            <AlertTriangle size={11} className="mt-px shrink-0" />
            <span>{t('poolView.incomplete', 'This picture is incomplete: {{mods}} could not be read.', { mods: inspection.unreadableMods.map((mod) => mod.modName).join(', ') })}</span>
          </span>
        )}
        {winners.foreign.length > 0 && (
          <span className="text-danger">
            {t('poolView.foreignWinner', 'A mod outside this pool wins {{n}} of its paths, so shuffling will not change them.', { n: winners.foreign.length })}
          </span>
        )}
        <button type="button" onClick={recheck} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
          <RefreshCw size={10} /> {t('poolView.recheck', 'Re-check')}
        </button>
        <button
          type="button"
          onClick={() => setPathsOpen((value) => !value)}
          aria-expanded={pathsOpen}
          className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
        >
          <ChevronDown size={10} className={pathsOpen ? '' : '-rotate-90'} />
          {t('poolView.showPaths', 'Paths ({{n}})', { n: pool.entries.length })}
        </button>
      </div>
      {pathsOpen && (
        <div className="max-h-32 space-y-0.5 overflow-auto border-t border-border/60 px-3 py-1.5 text-[11px] text-text-secondary">
          {pool.entries.map((path) => (
            <p key={path} className="truncate" title={path}>{path}</p>
          ))}
        </div>
      )}
    </section>
  );
}

export interface PoolMemberCellProps {
  member: FoundryPoolMember;
  winners: FoundryPoolWinners;
  inspecting: boolean;
  onToggleShuffleKey: (key: string) => void;
  onToggleMod: (modId: string) => void;
  onOpenInInstalled: (modId: string) => void;
  /** Lane D extension point: anything returned here renders in the cell's
   *  leading slot, in place of the kind icon. A thumbnail for a visual member,
   *  an audition button for a sound member. */
  renderPreview?: (member: FoundryPoolMember) => ReactNode;
}

/**
 * One alternative inside a pool. Kept as its own component precisely so the
 * alternatives gallery can replace what the leading slot shows without
 * touching pool semantics: the cell knows what the member is and whether it
 * wins, and nothing about how to draw an asset.
 */
export function PoolMemberCell({
  member,
  winners,
  inspecting,
  onToggleShuffleKey,
  onToggleMod,
  onOpenInInstalled,
  renderPreview,
}: PoolMemberCellProps) {
  const { t } = useTranslation();
  const wins = winners.winsByMemberKey.get(member.key) ?? [];
  const Icon = member.kind === 'sound' ? Volume2 : ImageIcon;

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0 ${
      wins.length > 0 ? 'bg-accent/5' : ''
    }`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-bg-tertiary/40">
        {renderPreview?.(member) ?? <Icon size={14} className="text-accent" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${member.matched ? 'text-text-primary' : 'text-text-secondary'}`}>
          {member.title}
        </p>
        <p className="truncate text-[11px] text-text-secondary">
          {[
            member.heroName,
            member.sourceFileName,
            t('poolView.memberPaths', '{{n}} paths', { n: member.entries.length }),
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* The runtime winner, from the shared inspection. Enabled is not the
          same claim: a lower-priority VPK writing the same entry still wins. */}
      {inspecting ? (
        <span className="shrink-0 text-[11px] text-text-secondary">
          <Loader2 size={11} className="animate-spin" />
        </span>
      ) : wins.length > 0 ? (
        <span
          className="flex shrink-0 items-center gap-1 rounded-sm border border-accent/60 bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent"
          title={t('poolView.winsPathsHint', 'Currently wins: {{paths}}', { paths: wins.join(', ') })}
        >
          <Check size={10} /> {t('poolView.winner', 'in game now')}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-secondary">
          {member.enabled
            ? t('poolView.enabledButLosing', 'enabled, overridden')
            : t('poolView.notActive', 'not active')}
        </span>
      )}

      <button
        type="button"
        onClick={() => onToggleShuffleKey(member.key)}
        aria-pressed={member.inShuffle}
        title={member.inShuffle
          ? t('poolView.memberShuffleOn', 'In the launch pool')
          : t('poolView.memberShuffleOff', 'Add just this alternative to the launch pool')}
        className={`shrink-0 rounded-sm border p-1.5 ${
          member.inShuffle ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border text-text-secondary hover:text-text-primary'
        }`}
      >
        <Shuffle size={12} />
      </button>
      <button
        type="button"
        onClick={() => onToggleMod(member.mod.id)}
        title={member.enabled ? t('poolView.disable', 'Disable') : t('poolView.enable', 'Enable')}
        className="shrink-0 rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"
      >
        <Power size={12} />
      </button>
      <button
        type="button"
        onClick={() => onOpenInInstalled(member.mod.id)}
        title={t('poolView.openInInstalled', 'Open in Installed')}
        className="shrink-0 rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"
      >
        <ExternalLink size={12} />
      </button>
    </div>
  );
}
