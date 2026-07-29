import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ChevronDown, ExternalLink, Loader2, Pencil, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { showToast } from '../../stores/toastStore';
import {
  foundryCheckAudioPaths,
  foundryInspectAssetSources,
  foundrySoundAnnotationKey,
  foundrySwapSound,
} from '../../lib/api';
import { SoundImportEditor, type SoundImportEdits } from './SoundImportEditor';
import {
  describeSoundTuning,
  formatGain,
  formatTrimWindow,
  soundSeedFromTuning,
  soundTuningBadges,
  type SoundTuningState,
} from './soundTuning';
import type { FoundryAssetSourcesInspection, SoundAnnotation } from '../../types/foundry';
import type { Mod } from '../../types/mod';

/**
 * The sound-specific half of `My changes`. A sound swap records clip-to-audio
 * assignments and shares annotations with the Sound browser, so it keeps a
 * richer panel than the generic asset one; the surrounding row chrome (enable,
 * rename, delete) lives in `MyChanges` so there is only one copy of it.
 */

/** Catalog rows name the source `.vsnd`; a VPK carries the compiled `.vsnd_c`. */
function compiledSoundEntry(path: string): string {
  return path.replace(/\\/g, '/').replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');
}

/** The exact paths this change claims to own, from its recorded assignments.
 *  Labels and hero names are never used: only normalized entry paths. */
function writeSetFor(mod: Mod): string[] {
  const recorded = mod.soundSwap?.reforge;
  const clips = recorded?.assignments.map((assignment) => assignment.clipPath)
    ?? recorded?.clipPaths
    ?? [];
  return [...new Set(clips.map(compiledSoundEntry))];
}

/** Per-change detail: who actually wins each recorded clip path right now, a
 *  jump to the conflicting owner, the personal annotation for the event, and a
 *  re-forge from the recorded assignments. */
export function SoundChangeDetails({
  mod,
  annotations,
  onSaveAnnotation,
  onOpenInInstalled,
}: {
  mod: Mod;
  annotations: Record<string, SoundAnnotation>;
  onSaveAnnotation: (key: string, name: string, note: string) => Promise<void>;
  onOpenInInstalled: (modId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [inspection, setInspection] = useState<FoundryAssetSourcesInspection | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [reforging, setReforging] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [retuneOpen, setRetuneOpen] = useState(false);

  const recorded = mod.soundSwap?.reforge;
  const tuning = useMemo(() => describeSoundTuning(mod), [mod]);
  const writeSet = useMemo(() => writeSetFor(mod), [mod]);
  const annotationKey = foundrySoundAnnotationKey(
    mod.soundSwap?.event ?? '',
    recorded?.assignments[0]?.clipPath ?? recorded?.clipPaths?.[0] ?? ''
  );
  const annotation = annotations[annotationKey];

  const inspect = useCallback(async () => {
    if (!writeSet.length) return;
    setInspecting(true);
    setInspectError(null);
    try {
      setInspection(await foundryInspectAssetSources(writeSet));
    } catch (cause) {
      setInspection(null);
      setInspectError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInspecting(false);
    }
  }, [writeSet]);

  useEffect(() => {
    if (expanded && !inspection && !inspectError && writeSet.length) void inspect();
  }, [expanded, inspection, inspectError, writeSet.length, inspect]);

  // Winner truth for this change: every recorded path whose runtime winner is
  // some other VPK, with that VPK named so it can be opened directly.
  const losses = useMemo(() => {
    if (!inspection) return [];
    return Object.entries(inspection.winners)
      .filter(([, winnerId]) => winnerId !== null && winnerId !== mod.id)
      .map(([path, winnerId]) => ({
        path,
        winnerId: winnerId as string,
        winnerName: inspection.sources.find((source) => source.modId === winnerId)?.modName ?? winnerId!,
      }));
  }, [inspection, mod.id]);

  /** Rebuild this change from what was recorded. `options.edits` retunes the
   *  trim/gain instead of reproducing the recorded ones, and `options.audioPath`
   *  swaps the donor the user re-opened in the workbench (normally the same
   *  file). Everything else - targets, pool mode, seed, loop - is reused, which
   *  is the whole point: a retune is not a re-authoring. */
  const reforge = useCallback(async (options?: { edits?: SoundImportEdits; audioPath?: string; retuned?: boolean }) => {
    if (!recorded || reforging) return;
    setReforging(true);
    try {
      const donorPath = options?.audioPath ?? recorded.audioPath;
      const assignments = recorded.assignments.map((assignment) => ({
        ...assignment,
        audioPath: assignment.audioPath === recorded.audioPath ? donorPath : assignment.audioPath,
      }));
      const wanted = [...new Set([donorPath, ...assignments.map((a) => a.audioPath)])];
      const present = new Set(await foundryCheckAudioPaths(wanted));
      const missing = wanted.filter((path) => !present.has(path));
      if (missing.length) {
        showToast(
          t('foundry.myChanges.reforgeMissing', {
            count: missing.length,
            files: missing.map((path) => path.split(/[\\/]/).pop()).join(', '),
          }),
          { tone: 'error', duration: 9000 }
        );
        return;
      }
      const preflight = await foundryInspectAssetSources(writeSet);
      if (preflight.unreadableMods.length) {
        showToast(
          t('foundry.myChanges.reforgeUnreadable', {
            mods: preflight.unreadableMods.map((entry) => entry.modName).join(', '),
          }),
          { tone: 'error', duration: 9000 }
        );
        return;
      }
      // The rebuild is a new managed mod, exactly like the original forge. The
      // existing one is left alone: removing it is the user's call in Installed.
      const others = preflight.sources.filter((source) => source.modId !== mod.id && source.enabled);
      if (others.length && !window.confirm(
        t('foundry.myChanges.reforgeConflict', { mods: others.map((source) => source.modName).join(', ') })
      )) return;
      await foundrySwapSound({
        heroCodename: mod.soundSwap!.heroCodename,
        heroName: recorded.heroName,
        soundeventsEntry: recorded.soundeventsEntry,
        event: recorded.event,
        clipPaths: recorded.clipPaths,
        audioPath: donorPath,
        assignments,
        poolMode: mod.soundSwap!.poolMode,
        poolSeed: mod.soundSwap!.poolSeed,
        name: options?.retuned
          ? t('soundTools.retune.rebuiltName', { name: mod.name })
          : t('foundry.myChanges.reforgedName', { name: mod.name }),
        loop: mod.soundSwap!.loop,
        trimStartMs: options?.edits ? options.edits.trimStartMs : recorded.trimStartMs,
        trimEndMs: options?.edits ? options.edits.trimEndMs : recorded.trimEndMs,
        gainDb: options?.edits ? options.edits.gainDb : recorded.gainDb,
      });
      await useAppStore.getState().loadMods({ silent: true });
      setInspection(null);
      setRetuneOpen(false);
      showToast(t('foundry.myChanges.reforgeDone', { name: mod.name }), { tone: 'success', duration: 6000 });
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error', duration: 8000 });
    } finally {
      setReforging(false);
    }
  }, [recorded, reforging, writeSet, mod, t]);

  return (
    <div className="mt-1.5 text-[11px] text-text-secondary">
      {/* Row level, deliberately outside the disclosure: the workbench state is
          what the row was missing, so it must not need a click to read. */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-text-primary"
        >
          <ChevronDown size={11} className={expanded ? '' : '-rotate-90'} />
          {writeSet.length
            ? `${t('foundry.myChanges.eventDetails')} · ${t('foundry.myChanges.recordedPaths', { count: writeSet.length })}`
            : t('foundry.myChanges.eventDetails')}
        </button>
        <SoundTuningBadges state={tuning} />
        <button
          type="button"
          disabled={!tuning.retunable || reforging}
          aria-expanded={retuneOpen}
          onClick={() => setRetuneOpen((value) => !value)}
          title={tuning.retunable ? t('soundTools.retune.hint') : t('soundTools.retune.unavailable')}
          className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SlidersHorizontal size={10} /> {t('soundTools.retune.button')}
        </button>
      </div>
      {retuneOpen && recorded && (
        <SoundRetunePanel
          state={tuning}
          audioPath={recorded.audioPath}
          targetClipPath={recorded.assignments[0]?.clipPath ?? recorded.clipPaths?.[0] ?? null}
          busy={reforging}
          onCancel={() => setRetuneOpen(false)}
          onApply={(edits, donorPath) => void reforge({ edits, audioPath: donorPath, retuned: true })}
        />
      )}
      {expanded && (
        <div className="mt-1 space-y-1.5 rounded-sm border border-border bg-bg-tertiary/40 p-2">
          {writeSet.length === 0 ? (
            <p>{t('foundry.myChanges.noWriteSet')}</p>
          ) : inspecting ? (
            <p className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {t('foundry.myChanges.resolving')}</p>
          ) : inspectError ? (
            <p className="flex items-start gap-1 text-danger">
              <AlertTriangle size={11} className="mt-px shrink-0" />
              <span>{inspectError} <button type="button" onClick={() => { setInspectError(null); void inspect(); }} className="underline">{t('foundry.myChanges.tryAgain')}</button></span>
            </p>
          ) : inspection ? (
            <>
              {inspection.unreadableMods.length > 0 && (
                <p className="flex items-start gap-1 text-danger">
                  <AlertTriangle size={11} className="mt-px shrink-0" />
                  <span>{t('foundry.myChanges.incompleteInspection', { mods: inspection.unreadableMods.map((entry) => entry.modName).join(', ') })}</span>
                </p>
              )}
              {losses.length === 0 ? (
                <p className="text-text-primary">{mod.enabled ? t('foundry.myChanges.winsAll') : t('foundry.myChanges.disabledInactive')}</p>
              ) : (
                losses.map((loss) => (
                  <div key={loss.path} className="flex flex-wrap items-center gap-1">
                    <span className="truncate text-danger" title={loss.path}>{t('foundry.myChanges.overriddenAt', { path: loss.path })}</span>
                    <span>{t('foundry.myChanges.overriddenBy', { winner: loss.winnerName })}</span>
                    <button type="button" onClick={() => onOpenInInstalled(loss.winnerId)} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                      <ExternalLink size={10} /> {t('foundry.myChanges.openWinner')}
                    </button>
                  </div>
                ))
              )}
              <button type="button" onClick={() => void inspect()} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                <RefreshCw size={10} /> {t('foundry.myChanges.recheck')}
              </button>
            </>
          ) : null}

          <div className="flex flex-wrap gap-1 border-t border-border/60 pt-1.5">
            <button
              type="button"
              onClick={() => setAnnotationOpen((value) => !value)}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
            >
              <Pencil size={10} /> {annotation ? t('foundry.myChanges.editAnnotation') : t('foundry.myChanges.addAnnotation')}
            </button>
            <button
              type="button"
              disabled={!recorded || reforging}
              onClick={() => void reforge()}
              title={recorded ? t('foundry.myChanges.reforgeHint') : t('foundry.myChanges.reforgeUnavailable')}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reforging ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} {t('foundry.myChanges.reforge')}
            </button>
          </div>
          {recorded && (
            <div className="max-h-24 space-y-0.5 overflow-auto">
              {recorded.assignments.map((assignment) => (
                <p key={assignment.clipPath} className="truncate" title={`${compiledSoundEntry(assignment.clipPath)} <- ${assignment.audioPath}`}>
                  {compiledSoundEntry(assignment.clipPath)} &lt;- {assignment.audioPath.split(/[\\/]/).pop()}
                </p>
              ))}
            </div>
          )}
          {annotationOpen && (
            <AnnotationEditor
              annotation={annotation}
              onSave={async (name, note) => {
                await onSaveAnnotation(annotationKey, name, note);
                setAnnotationOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** The recorded workbench state, rendered as small badges on the change row.
 *  Reads what `soundTuning` derived; it never recomputes anything. */
function SoundTuningBadges({ state }: { state: SoundTuningState }) {
  const { t } = useTranslation();
  const badges = soundTuningBadges(state);
  if (!badges.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1" title={t('soundTools.badge.title')}>
      {badges.map((badge) => {
        const label =
          badge.kind === 'trim' ? t('soundTools.badge.trim', { window: badge.value })
          : badge.kind === 'gain' ? t('soundTools.badge.gain', { gain: badge.value })
          : badge.kind === 'loop' ? (badge.value === 'on' ? t('soundTools.badge.loopOn') : t('soundTools.badge.loopOff'))
          : badge.kind === 'untouched' ? t('soundTools.badge.untouched')
          : t('soundTools.badge.legacy');
        const tuned = badge.kind === 'trim' || badge.kind === 'gain' || badge.kind === 'loop';
        return (
          <span
            key={badge.kind}
            className={`rounded-sm border px-1.5 py-0.5 ${tuned ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-secondary'}`}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}

/** One-line "what is recorded" / "what you just authored", from the same pure
 *  formatters the badges use. */
function tuningSummary(state: SoundTuningState, fallback: string): string {
  const parts = [formatTrimWindow(state), formatGain(state)].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : fallback;
}

/**
 * Retune an existing change: the same `SoundImportEditor` the Swap panel opens,
 * pointed at this change's recorded donor and clip target, with everything else
 * (targets, pool mode, seed, loop, name) reused from what was recorded.
 *
 * The editor draws its waveform from decoded bytes in the renderer, and the
 * renderer cannot read an arbitrary path off disk under `webSecurity`, so the
 * user re-opens the file here. That is one file pick, not a re-authoring: the
 * write set is already decided.
 */
function SoundRetunePanel({
  state,
  audioPath,
  targetClipPath,
  busy,
  onCancel,
  onApply,
}: {
  state: SoundTuningState;
  /** The donor recorded on the change. Checked for existence, not read. */
  audioPath: string;
  targetClipPath: string | null;
  busy: boolean;
  onCancel: () => void;
  onApply: (edits: SoundImportEdits, donorPath: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [present, setPresent] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [edits, setEdits] = useState<SoundImportEdits>({});

  const fileName = audioPath.split(/[\\/]/).pop() ?? audioPath;

  /** What the editor opens on: the recorded window, gain, and loop mode. The
   *  editor fits it to whatever the user actually decodes, so a window recorded
   *  against a longer file cannot produce an invalid selection. */
  const seed = useMemo(() => soundSeedFromTuning(state), [state]);

  useEffect(() => {
    let cancelled = false;
    void foundryCheckAudioPaths([audioPath])
      .then((found) => { if (!cancelled) setPresent(found.includes(audioPath)); })
      .catch(() => { if (!cancelled) setPresent(null); });
    return () => { cancelled = true; };
  }, [audioPath]);

  const accept = useCallback((picked: File | undefined | null) => {
    if (!picked) return;
    const path = window.electronAPI.getDroppedFilePath(picked);
    if (!path) {
      showToast(t('soundTools.retune.pathRejected'), { tone: 'error' });
      return;
    }
    setFile(picked);
    setPickedPath(path);
    setEdits({});
  }, [t]);

  // The pending state reuses the same shape the badges read, so "recorded" and
  // "new" are formatted by exactly one set of rules.
  const pending: SoundTuningState = {
    ...state,
    trimStartMs: edits.trimStartMs !== undefined && edits.trimStartMs > 0 ? edits.trimStartMs : undefined,
    trimEndMs: edits.trimEndMs !== undefined && edits.trimEndMs > 0 ? edits.trimEndMs : undefined,
    gainDb: edits.gainDb !== undefined && edits.gainDb !== 0 ? edits.gainDb : undefined,
  };

  return (
    <div className="mt-1 space-y-1.5 rounded-sm border border-accent/30 bg-bg-tertiary/40 p-2">
      <p className="text-text-primary">{t('soundTools.retune.title')}</p>
      <p>{t('soundTools.retune.intro')}</p>
      <p>{t('soundTools.retune.recorded', { summary: tuningSummary(state, t('soundTools.summary.none')) })}</p>
      {present === false && (
        <p className="flex items-start gap-1 text-danger">
          <AlertTriangle size={11} className="mt-px shrink-0" />
          <span>{t('soundTools.retune.missing', { path: audioPath })}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-border px-2 py-2 hover:border-accent/50 hover:text-text-primary"
      >
        <Upload size={11} />
        {file ? t('soundTools.retune.picked', { file: file.name }) : t('soundTools.retune.load', { file: fileName })}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus"
        className="hidden"
        onChange={(event) => { accept(event.target.files?.[0]); event.target.value = ''; }}
      />
      <p>{t('soundTools.retune.loadNote')}</p>
      {pickedPath && pickedPath !== audioPath && (
        <p className="text-text-primary">{t('soundTools.retune.differentDonor', { file: pickedPath.split(/[\\/]/).pop() })}</p>
      )}
      {/* The same editor the Swap panel opens. Not a fork, not a copy. */}
      {file && (
        <SoundImportEditor
          file={file}
          targetClipPath={targetClipPath}
          onChange={setEdits}
          initialEdits={seed}
        />
      )}
      {file && (
        <p>{t('soundTools.retune.pending', { summary: tuningSummary(pending, t('soundTools.summary.none')) })}</p>
      )}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!file || !pickedPath || busy}
          onClick={() => { if (pickedPath) onApply(edits, pickedPath); }}
          className="flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {t('soundTools.retune.apply')}
        </button>
        <button type="button" onClick={onCancel} className="rounded-sm border border-border px-2 py-1 hover:text-text-primary">
          {t('soundTools.retune.cancel')}
        </button>
      </div>
      <p>{t('soundTools.retune.rebuildNote')}</p>
    </div>
  );
}

function AnnotationEditor({
  annotation,
  onSave,
}: {
  annotation?: SoundAnnotation;
  onSave: (name: string, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(annotation?.name ?? '');
  const [note, setNote] = useState(annotation?.note ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1 rounded-sm border border-border bg-bg-secondary p-2">
      <p className="text-text-secondary">{t('foundry.myChanges.annotationNote')}</p>
      <input aria-label={t('foundry.myChanges.myLabel')} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('foundry.myChanges.myLabelPlaceholder')} className="w-full rounded-sm border border-border bg-bg-primary px-2 py-1 text-text-primary" />
      <textarea aria-label={t('foundry.myChanges.myNote')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder={t('foundry.myChanges.myNotePlaceholder')} className="w-full resize-y rounded-sm border border-border bg-bg-primary px-2 py-1 text-text-primary" />
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); try { await onSave(name, note); } finally { setBusy(false); } }}
        className="flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-bg-primary disabled:opacity-40"
      >
        <Check size={11} /> {t('foundry.myChanges.save')}
      </button>
    </div>
  );
}
