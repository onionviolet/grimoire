import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ChevronDown, ExternalLink, Loader2, Pencil, Power, RefreshCw, Trash2, Volume2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { showToast } from '../../stores/toastStore';
import {
  foundryCheckAudioPaths,
  foundryInspectAssetSources,
  foundrySoundAnnotationKey,
  foundrySoundAnnotations,
  foundrySwapSound,
  saveFoundrySoundAnnotation,
} from '../../lib/api';
import type { FoundryAssetSourcesInspection, SoundAnnotation } from '../../types/foundry';
import type { Mod } from '../../types/mod';

/** Grouping key only. Empty means global scope; the heading translates it at
 *  render time so the group key never depends on the active language. */
function scopeFor(mod: Mod): string {
  return mod.lockerHero?.trim() || mod.soundSwap?.heroCodename || '';
}

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

/**
 * A deliberately thin view over the normal installed-mod store. It does not
 * maintain its own enabled flag: toggling here calls the same action used by
 * the Locker, preventing the two surfaces from drifting apart.
 *
 * The one thing it adds on top of the store is event-level truth: an enabled
 * sound change is not necessarily the sound you hear, because a lower-priority
 * VPK writing the same clip paths wins. That is resolved by inspecting the
 * recorded write set, not by trusting this mod's own enabled flag.
 */
export default function MySoundChanges() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mods = useAppStore((state) => state.mods);
  const toggleMod = useAppStore((state) => state.toggleMod);
  const deleteMod = useAppStore((state) => state.deleteMod);
  const editLocalMod = useAppStore((state) => state.editLocalMod);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<Record<string, string>>({});
  const changes = useMemo(() => mods.filter((mod) => Boolean(mod.soundSwap)), [mods]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Mod[]>();
    for (const mod of changes) {
      const scope = scopeFor(mod);
      grouped.set(scope, [...(grouped.get(scope) ?? []), mod]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [changes]);

  const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
  useEffect(() => {
    let cancelled = false;
    foundrySoundAnnotations()
      .then((entries) => {
        if (!cancelled) setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAnnotation = useCallback(async (key: string, name: string, note: string) => {
    const saved = await saveFoundrySoundAnnotation(key, name, note, []);
    setAnnotations((current) => {
      const next = { ...current };
      if (saved) next[key] = saved.annotation;
      else delete next[key];
      return next;
    });
  }, []);

  if (!changes.length) return <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">{t('foundry.myChanges.empty')}</p>;
  return <div className="space-y-3">
    {groups.map(([scope, entries]) => <section key={scope} className="rounded-sm border border-border">
      <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-text-primary">{scope || t('foundry.myChanges.globalScope')}</h3>
      {entries.map((mod) => {
        const editing = open[mod.id];
        const value = rename[mod.id] ?? mod.name;
        const summary = [
          t('foundry.myChanges.summary', { name: mod.name, audio: mod.soundSwap?.audioFileName, pool: mod.soundSwap?.pool }),
          ...(mod.soundSwap?.poolSeed != null ? [t('foundry.myChanges.seed', { seed: mod.soundSwap.poolSeed })] : []),
        ].join(' · ');
        return <div key={mod.id} className="border-b border-border/60 px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-accent" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-text-primary">{mod.soundSwap?.event}</p><p className="truncate text-[11px] text-text-secondary">{summary}</p></div>
            <span className={`text-[11px] ${mod.enabled ? 'text-green-400' : 'text-text-secondary'}`}>{mod.enabled ? t('foundry.myChanges.enabled') : t('foundry.myChanges.disabled')}</span>
            <button type="button" onClick={() => void toggleMod(mod.id)} title={mod.enabled ? t('foundry.myChanges.disable') : t('foundry.myChanges.enable')} className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"><Power size={13} /></button>
            <button type="button" onClick={() => setOpen((current) => ({ ...current, [mod.id]: !editing }))} title={t('foundry.myChanges.rename')} className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary">{editing ? <ChevronDown size={13} /> : <Pencil size={13} />}</button>
            <button type="button" onClick={() => { if (window.confirm(t('foundry.myChanges.deleteConfirm', { name: mod.name }))) void deleteMod(mod.id); }} title={t('foundry.myChanges.delete')} className="rounded-sm border border-border p-1.5 text-red-300 hover:text-red-200"><Trash2 size={13} /></button>
          </div>
          {editing && <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const name = value.trim(); if (name) void editLocalMod(mod.id, { name }).then(() => setOpen((current) => ({ ...current, [mod.id]: false }))); }}><input aria-label={t('foundry.myChanges.nameLabel')} value={value} onChange={(event) => setRename((current) => ({ ...current, [mod.id]: event.target.value }))} className="min-w-0 flex-1 rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary" /><button className="rounded-sm bg-accent px-2 text-sm text-bg-primary">{t('foundry.myChanges.save')}</button></form>}
          <SoundChangeDetails
            mod={mod}
            annotations={annotations}
            onSaveAnnotation={saveAnnotation}
            onOpenInInstalled={(modId) => navigate(`/?focusMod=${encodeURIComponent(modId)}`)}
          />
        </div>;
      })}
    </section>)}
  </div>;
}

/** Per-change detail: who actually wins each recorded clip path right now, a
 *  jump to the conflicting owner, the personal annotation for the event, and a
 *  re-forge from the recorded assignments. */
function SoundChangeDetails({
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

  const recorded = mod.soundSwap?.reforge;
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

  const reforge = useCallback(async () => {
    if (!recorded || reforging) return;
    setReforging(true);
    try {
      const wanted = [...new Set([recorded.audioPath, ...recorded.assignments.map((a) => a.audioPath)])];
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
        audioPath: recorded.audioPath,
        assignments: recorded.assignments,
        poolMode: mod.soundSwap!.poolMode,
        poolSeed: mod.soundSwap!.poolSeed,
        name: t('foundry.myChanges.reforgedName', { name: mod.name }),
        loop: mod.soundSwap!.loop,
        trimStartMs: recorded.trimStartMs,
        trimEndMs: recorded.trimEndMs,
        gainDb: recorded.gainDb,
      });
      await useAppStore.getState().loadMods({ silent: true });
      setInspection(null);
      showToast(t('foundry.myChanges.reforgeDone', { name: mod.name }), { tone: 'success', duration: 6000 });
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error', duration: 8000 });
    } finally {
      setReforging(false);
    }
  }, [recorded, reforging, writeSet, mod, t]);

  return (
    <div className="mt-1.5 text-[11px] text-text-secondary">
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
