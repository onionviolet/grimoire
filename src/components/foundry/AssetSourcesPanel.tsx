import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Minus,
  Wand2,
} from 'lucide-react';
import { foundryAuditionSourceClip, foundryInspectAssetSources } from '../../lib/api';
import { computeSourceGating } from './sourceGating';
import { useAppStore } from '../../stores/appStore';
import { showToast } from '../../stores/toastStore';
import type {
  FoundryAssetSource,
  FoundryAssetSourceProvenance,
  FoundryAssetSourcesInspection,
} from '../../types/foundry';

interface AssetSourcesPanelProps {
  paths: string[];
  /** Optional surface labels for exact paths, for example portrait variants. */
  pathLabels?: Readonly<Record<string, string>>;
  /** Offered when the caller can mint a replacement for these exact paths (the
   *  sound rows open their swap panel). Omitted elsewhere, so the panel never
   *  advertises an action it cannot actually run. */
  onCreateReplacement?: () => void;
  /** Shuffle-pool membership, keyed by the caller's own (uncompiled) clip path.
   *  Present only while a pool editor is open. */
  poolTargets?: ReadonlySet<string>;
  onTogglePoolTarget?: (clipPath: string) => void;
  /** Maps a normalized `.vsnd_c` entry back to the caller's source clip path, so
   *  pool membership is keyed on the same string the pool editor uses. */
  poolTargetForEntry?: (entry: string) => string | null;
}

// Static map rather than a template literal, matching FoundryBuildTray: the key
// set stays greppable for the i18n gate, and a provenance the backend adds later
// cannot build a missing key at runtime.
const PROVENANCE_LABEL_KEYS: Record<FoundryAssetSourceProvenance, string> = {
  Downloaded: 'foundry.sources.provenance.downloaded',
  Imported: 'foundry.sources.provenance.imported',
  Forged: 'foundry.sources.provenance.forged',
  'Third-party': 'foundry.sources.provenance.thirdParty',
};

/** Separates the mod id from the entry path in the play-state token. A NUL was
 *  used here originally, which made the whole file read as binary to grep and
 *  ripgrep, so every code search silently skipped it. Neither an id nor a VPK
 *  entry path can contain a newline. */
const TOKEN_SEPARATOR = '\n';

/** On-demand to keep catalog grids inexpensive: a VPK-directory scan occurs
 * only for the card a player explicitly asks to inspect.
 *
 * Every action here goes through the normal mod store or hands control back to
 * the caller. The panel never writes a VPK and never reorders anything.
 *
 * An unreadable VPK narrows what is known, and the gate is scoped to match: a
 * listed source stays toggleable (its own directory was read), while creating a
 * replacement stays blocked (the winner of the new path is the ambiguous part).
 * See `sourceGating.ts`.
 */
export default function AssetSourcesPanel({
  paths,
  pathLabels,
  onCreateReplacement,
  poolTargets,
  onTogglePoolTarget,
  poolTargetForEntry,
}: AssetSourcesPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toggleMod = useAppStore((state) => state.toggleMod);
  const [result, setResult] = useState<FoundryAssetSourcesInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyModId, setBusyModId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const inspect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await foundryInspectAssetSources(paths));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [paths]);

  // An unreadable VPK makes the ownership picture incomplete, but not every
  // action depends on the missing part. See `sourceGating.ts` for the split.
  const gating = useMemo(() => computeSourceGating(result), [result]);
  const replacementBlockReason = gating.replacementBlocked
    ? t('sourceBlocking.replacementBlocked')
    : null;

  const audition = useCallback(async (source: FoundryAssetSource, entry: string) => {
    const token = `${source.modId}${TOKEN_SEPARATOR}${entry}`;
    audioRef.current?.pause();
    if (playing === token) {
      setPlaying(null);
      return;
    }
    setPlaying(token);
    try {
      const url = await foundryAuditionSourceClip(source.modId, entry);
      if (!url) {
        setPlaying(null);
        showToast(t('foundry.sources.auditionFailed', { mod: source.modName, entry }), { tone: 'error' });
        return;
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => setPlaying((current) => (current === token ? null : current));
      await audio.play();
    } catch (cause) {
      setPlaying(null);
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error' });
    }
  }, [playing, t]);

  const setEnabled = useCallback(async (source: FoundryAssetSource) => {
    // Installed is the only enabled-state authority, so this is the very same
    // store action the Installed list and Locker call. Precedence is untouched.
    setBusyModId(source.modId);
    try {
      const ok = await toggleMod(source.modId);
      if (!ok) {
        showToast(
          source.enabled
            ? t('foundry.sources.disableFailed', { mod: source.modName })
            : t('foundry.sources.enableFailed', { mod: source.modName }),
          { tone: 'error' }
        );
        return;
      }
      await inspect();
    } finally {
      setBusyModId(null);
    }
  }, [toggleMod, inspect, t]);

  const winnerNames = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.winners).map(([path, modId]) => ({
      path,
      name: modId ? result.sources.find((source) => source.modId === modId)?.modName ?? modId : null,
    }));
  }, [result]);

  return (
    <div className="mt-1 border-t border-border/60 pt-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void inspect()}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-60"
          title={t('foundry.sources.inspectHint')}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : result ? <RefreshCw size={12} /> : <Search size={12} />}
          {result ? t('foundry.sources.reinspect') : t('foundry.sources.inspect')}
        </button>
      </div>
      {loading && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-text-secondary" aria-live="polite">
          {t('foundry.sources.inspecting', 'Inspecting installed sources; actions will be available when this finishes.')}
        </p>
      )}
      {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}
      {result && (
        <div className="mt-1 space-y-1 text-[10px] text-text-secondary">
          {winnerNames.map(({ path, name }) =>
            name ? (
              <p key={path} className="truncate" title={path}>{pathLabels?.[path] ? `${pathLabels[path]}: ` : ''}{t('foundry.sources.winner', { name })}</p>
            ) : null
          )}
          {gating.incomplete && (
            <div className="rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-1 text-amber-300">
              <p className="flex items-start gap-1">
                <AlertTriangle size={11} className="mt-px shrink-0" />
                <span>
                  <span className="font-medium">{t('sourceBlocking.incompleteTitle')}</span>
                  {': '}
                  {t('sourceBlocking.incomplete', {
                    count: gating.unreadable.length,
                    mods: gating.unreadableNames,
                  })}
                </span>
              </p>
              <p className="mt-0.5 pl-4">{t('sourceBlocking.toggleAllowed')}</p>
              <button
                type="button"
                onClick={() => setShowWhy((open) => !open)}
                className="mt-0.5 ml-4 flex items-center gap-0.5 rounded-sm underline-offset-2 hover:underline"
              >
                {showWhy ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {showWhy ? t('sourceBlocking.whyHide') : t('sourceBlocking.why')}
              </button>
              {showWhy && (
                <div className="mt-1 space-y-1 pl-4">
                  {/* State the uncertainty precisely. Enablement is known without
                      parsing; contents are not knowable at all from a file that
                      will not open, so neither is guessed at here. */}
                  {gating.enabledUnreadable.length > 0 ? (
                    <p>
                      {t('sourceBlocking.uncertaintyEnabled', { count: gating.enabledUnreadable.length })}
                      {gating.disabledUnreadable.length > 0
                        ? ` ${t('sourceBlocking.disabledAlso', { count: gating.disabledUnreadable.length })}`
                        : ''}
                    </p>
                  ) : (
                    <p>{t('sourceBlocking.uncertaintyDisabledOnly', { count: gating.disabledUnreadable.length })}</p>
                  )}
                  <p>{t('sourceBlocking.replacementBlocked')}</p>
                  {gating.unreadable.map((mod) => (
                    <div key={mod.modId} className="flex flex-wrap items-center gap-1">
                      <span className="truncate text-text-primary" title={mod.modName}>{mod.modName}</span>
                      <span>
                        {/* Lane A's detected-file-type report lands here: it is
                            optional, so this reads honestly before and after. */}
                        {mod.detectedType
                          ? t('sourceBlocking.detectedType', { type: mod.detectedType })
                          : t('sourceBlocking.detectedTypeUnknown')}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/?focusMod=${encodeURIComponent(mod.modId)}`)}
                        title={t('sourceBlocking.openMod', { mod: mod.modName })}
                        className="flex items-center gap-1 rounded-sm border border-amber-400/40 px-1.5 py-0.5 hover:text-amber-200"
                      >
                        <ExternalLink size={10} />
                        {t('sourceBlocking.openModShort')}
                      </button>
                    </div>
                  ))}
                  <p>{t('sourceBlocking.fixHint')}</p>
                </div>
              )}
            </div>
          )}
          {result.sources.length === 0 ? (
            <p>{t('foundry.sources.none')}</p>
          ) : (
            result.sources.map((source) => (
              <div key={source.modId} className="rounded-sm bg-bg-tertiary px-1.5 py-1">
                <div className="flex gap-1">
                  <span className={source.enabled ? 'text-accent' : 'text-text-secondary'}>
                    {source.enabled ? t('foundry.sources.enabled') : t('foundry.sources.disabled')}
                  </span>
                  <span className="truncate text-text-primary" title={source.modName}>{source.modName}</span>
                </div>
                <p>
                  {[
                    t('foundry.sources.meta', {
                      provenance: t(PROVENANCE_LABEL_KEYS[source.provenance], source.provenance),
                      priority: source.priority,
                    }),
                    ...(source.wins.length ? [t('foundry.sources.isWinner')] : []),
                    ...(source.managed ? [] : [t('foundry.sources.unmanaged')]),
                  ].join(' Â· ')}
                </p>
                <p className="truncate" title={source.entries.join(', ')}>{source.entries.join(', ')}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {source.auditionable.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => void audition(source, entry)}
                      title={t('foundry.sources.auditionHint', { mod: source.modName, entry })}
                      className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
                    >
                      {playing === `${source.modId}${TOKEN_SEPARATOR}${entry}` ? <Pause size={10} /> : <Play size={10} />}
                      {entry.split('/').pop()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate(`/?focusMod=${encodeURIComponent(source.modId)}`)}
                    title={t('foundry.sources.openInInstalledHint')}
                    className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
                  >
                    <ExternalLink size={10} />
                    {t('foundry.sources.openInInstalled')}
                  </button>
                  <button
                    type="button"
                    // Deliberately not gated on the unreadable set: this source's
                    // identity is known, and the mod store owns enabled state.
                    disabled={gating.toggleBlocked || busyModId === source.modId}
                    onClick={() => void setEnabled(source)}
                    title={
                      source.enabled
                        ? t('foundry.sources.disableHint', { mod: source.modName })
                        : t('foundry.sources.enableHint', { mod: source.modName })
                    }
                    className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyModId === source.modId ? <Loader2 size={10} className="animate-spin" /> : <Power size={10} />}
                    {source.enabled ? t('foundry.sources.disable') : t('foundry.sources.enable')}
                  </button>
                </div>
                {onTogglePoolTarget && poolTargetForEntry && source.auditionable.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {source.auditionable.map((entry) => {
                      const target = poolTargetForEntry(entry);
                      if (!target) return null;
                      const included = poolTargets?.has(target) ?? false;
                      const clip = entry.split('/').pop() ?? entry;
                      return (
                        <button
                          key={`pool-${entry}`}
                          type="button"
                          onClick={() => onTogglePoolTarget(target)}
                          title={included ? t('foundry.sources.poolRemoveHint') : t('foundry.sources.poolAddHint')}
                          className={`flex items-center gap-1 rounded-sm border px-1.5 py-0.5 ${included ? 'border-accent/50 bg-accent/15 text-accent' : 'border-border hover:text-text-primary'}`}
                        >
                          {included ? <Minus size={10} /> : <Plus size={10} />}
                          {included ? t('foundry.sources.poolRemove', { clip }) : t('foundry.sources.poolAdd', { clip })}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
          {onCreateReplacement && (
            <button
              type="button"
              disabled={gating.replacementBlocked}
              onClick={onCreateReplacement}
              title={replacementBlockReason ?? t('foundry.sources.createReplacementHint')}
              className="flex w-full items-center justify-center gap-1 rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-1 text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 size={11} />
              {t('foundry.sources.createReplacement')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
