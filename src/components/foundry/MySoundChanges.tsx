import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function scopeFor(mod: Mod): string {
  return mod.lockerHero?.trim() || (mod.soundSwap?.heroCodename ? mod.soundSwap.heroCodename : 'Global sounds');
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

  if (!changes.length) return <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">No Foundry sound changes yet. Forged sound swaps will appear here and follow their normal Installed state.</p>;
  return <div className="space-y-3">
    {groups.map(([scope, entries]) => <section key={scope} className="rounded-sm border border-border">
      <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-text-primary">{scope}</h3>
      {entries.map((mod) => {
        const editing = open[mod.id];
        const value = rename[mod.id] ?? mod.name;
        return <div key={mod.id} className="border-b border-border/60 px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-accent" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-text-primary">{mod.soundSwap?.event}</p><p className="truncate text-[11px] text-text-secondary">{mod.name} · {mod.soundSwap?.audioFileName} · {mod.soundSwap?.pool}{mod.soundSwap?.poolSeed != null ? ` · seed ${mod.soundSwap.poolSeed}` : ''}</p></div>
            <span className={`text-[11px] ${mod.enabled ? 'text-green-400' : 'text-text-secondary'}`}>{mod.enabled ? 'Enabled' : 'Disabled'}</span>
            <button type="button" onClick={() => void toggleMod(mod.id)} title={mod.enabled ? 'Disable' : 'Enable'} className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"><Power size={13} /></button>
            <button type="button" onClick={() => setOpen((current) => ({ ...current, [mod.id]: !editing }))} title="Rename" className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary">{editing ? <ChevronDown size={13} /> : <Pencil size={13} />}</button>
            <button type="button" onClick={() => { if (window.confirm(`Delete ${mod.name}?`)) void deleteMod(mod.id); }} title="Delete" className="rounded-sm border border-border p-1.5 text-red-300 hover:text-red-200"><Trash2 size={13} /></button>
          </div>
          {editing && <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const name = value.trim(); if (name) void editLocalMod(mod.id, { name }).then(() => setOpen((current) => ({ ...current, [mod.id]: false }))); }}><input aria-label="Sound change name" value={value} onChange={(event) => setRename((current) => ({ ...current, [mod.id]: event.target.value }))} className="min-w-0 flex-1 rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary" /><button className="rounded-sm bg-accent px-2 text-sm text-bg-primary">Save</button></form>}
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
          `Cannot re-forge: ${missing.length} recorded audio file${missing.length === 1 ? '' : 's'} moved or was deleted (${missing.map((path) => path.split(/[\\/]/).pop()).join(', ')}). Re-author this change from the Sound browser instead.`,
          { tone: 'error', duration: 9000 }
        );
        return;
      }
      const preflight = await foundryInspectAssetSources(writeSet);
      if (preflight.unreadableMods.length) {
        showToast(
          `Cannot re-forge while ${preflight.unreadableMods.map((entry) => entry.modName).join(', ')} cannot be inspected.`,
          { tone: 'error', duration: 9000 }
        );
        return;
      }
      // The rebuild is a new managed mod, exactly like the original forge. The
      // existing one is left alone: removing it is the user's call in Installed.
      const others = preflight.sources.filter((source) => source.modId !== mod.id && source.enabled);
      if (others.length && !window.confirm(
        `${others.map((source) => source.modName).join(', ')} also write these paths. Re-forge a separate managed replacement anyway?`
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
        name: `${mod.name} (re-forged)`,
        loop: mod.soundSwap!.loop,
        trimStartMs: recorded.trimStartMs,
        trimEndMs: recorded.trimEndMs,
        gainDb: recorded.gainDb,
      });
      await useAppStore.getState().loadMods({ silent: true });
      setInspection(null);
      showToast(`Re-forged "${mod.name}". The original was left untouched.`, { tone: 'success', duration: 6000 });
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error', duration: 8000 });
    } finally {
      setReforging(false);
    }
  }, [recorded, reforging, writeSet, mod]);

  return (
    <div className="mt-1.5 text-[11px] text-text-secondary">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-text-primary"
      >
        <ChevronDown size={11} className={expanded ? '' : '-rotate-90'} />
        Event details{writeSet.length ? ` · ${writeSet.length} recorded path${writeSet.length === 1 ? '' : 's'}` : ''}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1.5 rounded-sm border border-border bg-bg-tertiary/40 p-2">
          {writeSet.length === 0 ? (
            <p>This change predates recorded write sets, so its live winner cannot be resolved and it cannot be re-forged. Re-author it from the Sound browser to gain both.</p>
          ) : inspecting ? (
            <p className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Resolving the active winner...</p>
          ) : inspectError ? (
            <p className="flex items-start gap-1 text-danger">
              <AlertTriangle size={11} className="mt-px shrink-0" />
              <span>{inspectError} <button type="button" onClick={() => { setInspectError(null); void inspect(); }} className="underline">Try again</button></span>
            </p>
          ) : inspection ? (
            <>
              {inspection.unreadableMods.length > 0 && (
                <p className="flex items-start gap-1 text-danger">
                  <AlertTriangle size={11} className="mt-px shrink-0" />
                  <span>{inspection.unreadableMods.map((entry) => entry.modName).join(', ')} could not be inspected, so this picture is incomplete.</span>
                </p>
              )}
              {losses.length === 0 ? (
                <p className="text-text-primary">{mod.enabled ? 'This change wins every path it writes.' : 'Disabled, so nothing here is active.'}</p>
              ) : (
                losses.map((loss) => (
                  <div key={loss.path} className="flex flex-wrap items-center gap-1">
                    <span className="truncate text-danger" title={loss.path}>Overridden at {loss.path}</span>
                    <span>by {loss.winnerName}</span>
                    <button type="button" onClick={() => onOpenInInstalled(loss.winnerId)} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                      <ExternalLink size={10} /> Open the winner
                    </button>
                  </div>
                ))
              )}
              <button type="button" onClick={() => void inspect()} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                <RefreshCw size={10} /> Re-check
              </button>
            </>
          ) : null}

          <div className="flex flex-wrap gap-1 border-t border-border/60 pt-1.5">
            <button
              type="button"
              onClick={() => setAnnotationOpen((value) => !value)}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
            >
              <Pencil size={10} /> {annotation ? 'Edit annotation' : 'Annotate the source sound'}
            </button>
            <button
              type="button"
              disabled={!recorded || reforging}
              onClick={() => void reforge()}
              title={recorded ? 'Rebuild this change from its recorded clip-to-audio assignments' : 'This change has no recorded assignments to rebuild from'}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reforging ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Re-forge
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
  const [name, setName] = useState(annotation?.name ?? '');
  const [note, setNote] = useState(annotation?.note ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1 rounded-sm border border-border bg-bg-secondary p-2">
      <p className="text-text-secondary">Annotations describe the base-game sound, not this mod. They are shared with the Sound browser.</p>
      <input aria-label="My label" value={name} onChange={(event) => setName(event.target.value)} placeholder="My label (optional)" className="w-full rounded-sm border border-border bg-bg-primary px-2 py-1 text-text-primary" />
      <textarea aria-label="My note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="What this sound is, or where you found it" className="w-full resize-y rounded-sm border border-border bg-bg-primary px-2 py-1 text-text-primary" />
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); try { await onSave(name, note); } finally { setBusy(false); } }}
        className="flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-bg-primary disabled:opacity-40"
      >
        <Check size={11} /> Save
      </button>
    </div>
  );
}
