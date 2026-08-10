import { AlertTriangle, CheckSquare, Hammer, Layers3, Loader2, RefreshCw, Square, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoundryEditKind, FoundryStagedEdit } from './buildTray';
import {
  missingSourceFiles,
  normalizeOutputName,
  reviewStagedEdits,
  isStagedVisualEdit,
  stagedEditSourceFiles,
  toForgeRequest,
  unsupportedStagedEditKind,
} from './buildTray';
import { foundryCheckAudioPaths, foundryPortraitImageNames } from '../../lib/api';
import { portraitImageLabel } from './portraitImageLabel';
import { Modal } from '../common/Modal';
import type { FoundryForgeRequest } from '../../types/foundry';

interface FoundryBuildTrayProps {
  edits: readonly FoundryStagedEdit[];
  outputName: string;
  onOutputNameChange: (name: string) => void;
  onForge: (request: FoundryForgeRequest) => Promise<void>;
  /** Install the same reviewed build into the mod library instead of exporting
   *  it. Optional so a host that only wants the export half can omit it. */
  onInstall?: (request: FoundryForgeRequest) => Promise<void>;
  /** Drop one staged edit. A review the user cannot narrow is not a review. */
  onRemove: (id: string) => void;
  /** Layout override for hosts that dock the tray differently (hero workshop). */
  className?: string;
}

// Static map rather than a template literal so the key set stays greppable for
// the i18n gate, and an unknown kind can never build a missing key at runtime.
const KIND_LABEL_KEYS: Record<FoundryEditKind, string> = {
  sound: 'foundry.buildTray.kind.sound',
  texture: 'foundry.buildTray.kind.texture',
  recolor: 'foundry.buildTray.kind.recolor',
  model: 'foundry.buildTray.kind.model',
};

/**
 * The only place bulk selection exists. Catalogue checkboxes intentionally do
 * not exist: users first stage authored edits, then deliberately select exactly
 * what is going into this named VPK and inspect its complete write-set.
 *
 * Both live authoring flows (sound swaps and visual replacements) land here, so
 * this component owns the last gate before a build: the source-file preflight,
 * the in-app confirmation, and the promise that cancelling changes nothing.
 */
export default function FoundryBuildTray({ edits, outputName, onOutputNameChange, onForge, onInstall, onRemove, className = '' }: FoundryBuildTrayProps) {
  const { t } = useTranslation();
  // `null` means the natural default: every staged edit, including a later
  // addition. Once the user touches selection, it becomes explicit.
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const effectiveSelection = useMemo(() => selectedIds ?? new Set(edits.map((edit) => edit.id)), [edits, selectedIds]);
  const review = useMemo(() => reviewStagedEdits(edits, effectiveSelection), [edits, effectiveSelection]);
  const allSelected = edits.length > 0 && review.selected.length === edits.length;
  const toggle = (id: string) => setSelectedIds((current) => {
    const next = new Set(current ?? edits.map((edit) => edit.id));
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(edits.map((edit) => edit.id)));
  const [forging, setForging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = forging || checking;

  /**
   * Preflight, then ask. A staged edit only records where its audio or PNG
   * lives, so a file moved between staging and forging would otherwise fail
   * partway through the build. `foundry:checkAudioPaths` is a plain
   * still-on-disk stat over a path list (the name is historical), which is
   * exactly what both kinds need. A check that itself fails blocks the forge:
   * an unreadable inspection must never be read as "nothing missing".
   */
  const requestConfirmation = async () => {
    if (!review.selected.length || busy) return;
    setBlocked(null);
    const unsupported = unsupportedStagedEditKind(review.selected);
    if (unsupported) {
      setBlocked(t('foundry.buildTray.unsupportedKind', 'This staged edit cannot be forged yet: {{kind}}', { kind: t(KIND_LABEL_KEYS[unsupported], unsupported) }));
      return;
    }
    const sources = stagedEditSourceFiles(review.selected);
    if (sources.length) {
      setChecking(true);
      let present: string[];
      try {
        present = await foundryCheckAudioPaths(sources);
      } catch (error) {
        setBlocked(t('foundry.buildTray.checkFailed', 'Grimoire could not check the staged source files, so forging is blocked. {{error}}', { error: error instanceof Error ? error.message : String(error) }));
        return;
      } finally {
        setChecking(false);
      }
      const missing = missingSourceFiles(sources, present);
      if (missing.length) {
        // A staged portrait bake is stored under its content hash, so the raw
        // basename here was 64 hex characters and named nothing the user could
        // act on (issue #261). The recorded original filename outlives the image
        // itself, which is exactly the case in hand: the file is gone.
        const labels = await foundryPortraitImageNames().catch(() => ({}) as Record<string, string>);
        const named = missing.map((file) => {
          const base = file.split(/[\\/]/).pop() || file;
          return portraitImageLabel(file, labels[base] ?? null);
        });
        setBlocked(`${t('foundry.buildTray.missingSources', { count: missing.length })} ${t('foundry.buildTray.missingSourceList', 'Missing: {{files}}', { files: named.join(', ') })}`);
        return;
      }
    }
    setConfirming(true);
  };

  /**
   * Both outputs run the identical reviewed request, so the only difference the
   * user is choosing between is where the finished VPK lands: a file they save,
   * or a tracked mod in their library. Failure handling is shared too, so an
   * install that throws leaves the tray exactly as an export that throws does.
   */
  const run = async (output: (request: FoundryForgeRequest) => Promise<void>) => {
    if (!review.selected.length || forging) return;
    setConfirming(false);
    setForging(true);
    try {
      await output(toForgeRequest(outputName, review));
    } catch (error) {
      setBlocked(error instanceof Error ? error.message : String(error));
    } finally {
      setForging(false);
    }
  };

  const finalName = normalizeOutputName(outputName);

  return (
    <aside className={`w-72 shrink-0 border-l border-border bg-bg-secondary/40 p-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Layers3 size={16} /> {t('foundry.buildTray.title')}</div>
      <p className="mt-1 text-xs text-text-secondary">{t('foundry.buildTray.description')}</p>
      <label className="mt-4 block text-xs text-text-secondary">
        {t('foundry.buildTray.outputName')}
        <input value={outputName} onChange={(event) => onOutputNameChange(event.target.value)} placeholder={t('foundry.buildTray.defaultName')} className="mt-1 w-full rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary" />
      </label>
      <p className="mt-1 text-[11px] text-text-secondary">{t('foundry.buildTray.willCreate', { name: finalName })}</p>
      <div className="mt-4 space-y-2 text-xs text-text-secondary">
        <div className="flex items-center justify-between">
          <p>{t('foundry.buildTray.summary', { edits: review.selected.length, files: review.writeSet.length })}</p>
          {edits.length > 0 && (
            <button type="button" onClick={toggleAll} className="text-accent hover:underline">
              {allSelected ? t('foundry.buildTray.clearSelection', 'Clear selection') : t('foundry.buildTray.selectAll', 'Select all')}
            </button>
          )}
        </div>
        {edits.length === 0 ? (
          <p className="rounded-sm border border-dashed border-border p-2">{t('foundry.buildTray.empty')}</p>
        ) : edits.map((edit) => (
          <div key={edit.id} className="flex items-start gap-2 rounded-sm border border-border p-2 hover:bg-bg-tertiary">
            <label className="flex min-w-0 flex-1 cursor-pointer gap-2">
              <input type="checkbox" checked={effectiveSelection.has(edit.id)} onChange={() => toggle(edit.id)} className="sr-only" />
              <span className="mt-0.5 shrink-0 text-accent">{effectiveSelection.has(edit.id) ? <CheckSquare size={14} /> : <Square size={14} />}</span>
              <span className="min-w-0">
                <strong className="text-text-primary">{edit.title}</strong>
                <span className="ml-1 rounded-sm bg-bg-tertiary px-1 text-[10px] uppercase tracking-wide text-text-secondary">{t(KIND_LABEL_KEYS[edit.kind], edit.kind)}</span>
                <br />{t('foundry.buildTray.editSummary', { files: edit.affectedFiles.length, precedence: edit.precedence })}
                {isStagedVisualEdit(edit) && (
                  <span className="block truncate text-[11px] text-text-secondary" title={edit.source.imageLabel ?? portraitImageLabel(edit.source.imagePath, null)}>
                    {edit.source.imageLabel ?? portraitImageLabel(edit.source.imagePath, null)}
                  </span>
                )}
              </span>
            </label>
            <button type="button" onClick={() => onRemove(edit.id)} title={t('foundry.buildTray.remove', 'Remove from tray')} aria-label={t('foundry.buildTray.remove', 'Remove from tray')} className="shrink-0 text-text-secondary transition-colors hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      {review.collisions.length > 0 && <div className="mt-4 rounded-sm border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-text-secondary"><strong className="text-text-primary">{t('foundry.buildTray.collisions', { count: review.collisions.length })}</strong>{review.collisions.map((collision) => <p key={collision.file} className="mt-1 break-all">{t('foundry.buildTray.collisionWinner', { file: collision.file, winner: collision.winner.title })}</p>)}</div>}
      {review.writeSet.length > 0 && (
        <details className="mt-3 text-xs text-text-secondary">
          <summary className="cursor-pointer text-text-primary">{t('foundry.buildTray.writeSet', { count: review.writeSet.length })}</summary>
          <ul className="mt-1 max-h-32 overflow-auto break-all pl-4">{review.writeSet.map((file) => <li key={file}>{file}</li>)}</ul>
          <p className="mt-2">{t('foundry.buildTray.writeSetNote')}</p>
        </details>
      )}
      {blocked && (
        <p role="alert" className="mt-3 flex gap-2 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-text-secondary">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <span className="min-w-0 break-words">{blocked}</span>
        </p>
      )}
      {(!review.selected.length || busy) && (
        <p id="foundry-forge-blocker" className="mt-3 text-xs text-text-secondary" aria-live="polite">
          {busy
            ? t('foundry.buildTray.blockedBusy', 'Forging is running. This will finish in a moment.')
            : t('foundry.buildTray.blockedEmpty', 'Select at least one staged edit to forge.')}
        </p>
      )}
      <button type="button" onClick={() => void requestConfirmation()} disabled={!review.selected.length || busy} aria-describedby={(!review.selected.length || busy) ? 'foundry-forge-blocker' : undefined} className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Hammer size={15} />}
        {forging ? t('foundry.buildTray.forging', 'Forging...') : t('foundry.buildTray.forge', 'Confirm and forge VPK')}
      </button>
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-text-secondary"><p><RefreshCw size={12} className="mr-1 inline" />{t('foundry.buildTray.rebuild')}</p><p className="mt-1"><Undo2 size={12} className="mr-1 inline" />{t('foundry.buildTray.unmerge')}</p></div>
      {confirming && (
        // The confirmation repeats the exact normalized paths and collision
        // winners, not the labels: those paths are the ownership key main
        // re-derives and checks the build against.
        <Modal onClose={() => setConfirming(false)} size="lg" labelledBy="foundry-forge-confirm-title">
          <div className="flex max-h-[80vh] flex-col">
            <div className="border-b border-border p-4">
              <h2 id="foundry-forge-confirm-title" className="text-base font-semibold text-text-primary">{t('foundry.buildTray.confirmTitle', { name: finalName })}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t('foundry.buildTray.confirmBody', { count: review.writeSet.length })}</p>
              {review.collisions.length > 0 && <p className="mt-1 text-sm text-text-secondary">{t('foundry.buildTray.confirmCollisions', { count: review.collisions.length })}</p>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 text-xs text-text-secondary">
              <ul className="space-y-0.5 break-all font-mono">{review.writeSet.map((file) => <li key={file}>{file}</li>)}</ul>
              {review.collisions.length > 0 && (
                <ul className="mt-3 space-y-0.5 break-all border-t border-border pt-3">
                  {review.collisions.map((collision) => <li key={collision.file}>{t('foundry.buildTray.collisionWinner', { file: collision.file, winner: collision.winner.title })}</li>)}
                </ul>
              )}
            </div>
            <div className="border-t border-border p-4">
              <p className="text-xs text-text-secondary">{t('foundry.buildTray.confirmCancelNote')}</p>
              {onInstall && <p className="mt-1 text-xs text-text-secondary">{t('foundry.buildTray.confirmOutputs', 'Export saves a VPK file you manage yourself. Install adds it to your library, where My changes can track and rebuild it.')}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary">{t('foundry.buildTray.cancel', 'Cancel')}</button>
                <button type="button" onClick={() => void run(onForge)} className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary">{t('foundry.buildTray.confirmAction', 'Export VPK')}</button>
                {onInstall && <button type="button" onClick={() => void run(onInstall)} className="rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-white">{t('foundry.buildTray.confirmInstall', 'Install to Grimoire')}</button>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </aside>
  );
}
