import { CheckSquare, Hammer, Layers3, RefreshCw, Square, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoundryStagedEdit } from './buildTray';
import { normalizeOutputName, reviewStagedEdits } from './buildTray';
import type { FoundryForgeRequest } from '../../types/foundry';
import type { FoundryStagedSoundEdit } from './soundStagedEdit';
import type { VisualStagedEdit } from './visualEdits';

interface FoundryBuildTrayProps {
  edits: readonly FoundryStagedEdit[];
  outputName: string;
  onOutputNameChange: (name: string) => void;
  onForge: (request: FoundryForgeRequest) => Promise<void>;
}

function isSoundEdit(edit: FoundryStagedEdit): edit is FoundryStagedSoundEdit {
  return edit.kind === 'sound' && 'request' in edit;
}

function isTextureEdit(edit: FoundryStagedEdit): edit is VisualStagedEdit {
  return edit.kind === 'texture' && 'source' in edit;
}

/**
 * The only place bulk selection exists. Catalogue checkboxes intentionally do
 * not exist: users first stage authored edits, then deliberately select exactly
 * what is going into this named VPK and inspect its complete write-set.
 */
export default function FoundryBuildTray({ edits, outputName, onOutputNameChange, onForge }: FoundryBuildTrayProps) {
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
  const forge = async () => {
    if (!review.selected.length || forging) return;
    const collisionWinners = review.collisions.map(({ file, winner }) => ({ file, editId: winner.id }));
    if (!window.confirm(`Forge one VPK named “${normalizeOutputName(outputName)}”?\n\nThis contains ${review.writeSet.length} exact path${review.writeSet.length === 1 ? '' : 's'}${collisionWinners.length ? ` and ${collisionWinners.length} reviewed collision winner${collisionWinners.length === 1 ? '' : 's'}` : ''}. Cancelling the save dialog changes nothing in Installed.`)) return;
    setForging(true);
    try {
      await onForge({
        name: normalizeOutputName(outputName),
        edits: review.selected.map((edit) => {
          if (isSoundEdit(edit)) return { id: edit.id, kind: 'sound' as const, precedence: edit.precedence, request: edit.request };
          if (isTextureEdit(edit)) return { id: edit.id, kind: 'texture' as const, precedence: edit.precedence, request: edit.source };
          throw new Error(`Unsupported staged edit: ${edit.kind}`);
        }),
        confirmation: {
          writeSet: review.writeSet.map((file) => file.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()),
          collisionWinners: collisionWinners.map((winner) => ({ ...winner, file: winner.file.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase() })),
        },
      });
    } finally { setForging(false); }
  };
  return (
    <aside className="w-72 shrink-0 border-l border-border bg-bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Layers3 size={16} /> {t('foundry.buildTray.title')}</div>
      <p className="mt-1 text-xs text-text-secondary">{t('foundry.buildTray.description')}</p>
      <label className="mt-4 block text-xs text-text-secondary">
        {t('foundry.buildTray.outputName')}
        <input value={outputName} onChange={(event) => onOutputNameChange(event.target.value)} placeholder={t('foundry.buildTray.defaultName')} className="mt-1 w-full rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary" />
      </label>
      <p className="mt-1 text-[11px] text-text-secondary">{t('foundry.buildTray.willCreate', { name: normalizeOutputName(outputName) })}</p>
      <div className="mt-4 space-y-2 text-xs text-text-secondary">
        <div className="flex items-center justify-between"><p>{t('foundry.buildTray.summary', { edits: review.selected.length, files: review.writeSet.length })}</p>{edits.length > 0 && <button type="button" onClick={toggleAll} className="text-accent hover:underline">{allSelected ? 'Clear selection' : 'Select all'}</button>}</div>
        {edits.length === 0 ? <p className="rounded-sm border border-dashed border-border p-2">{t('foundry.buildTray.empty')}</p> : edits.map((edit) => <label key={edit.id} className="flex cursor-pointer gap-2 rounded-sm border border-border p-2 hover:bg-bg-tertiary"><input type="checkbox" checked={effectiveSelection.has(edit.id)} onChange={() => toggle(edit.id)} className="sr-only" /><span className="mt-0.5 text-accent">{effectiveSelection.has(edit.id) ? <CheckSquare size={14} /> : <Square size={14} />}</span><span><strong className="text-text-primary">{edit.title}</strong><br />{t('foundry.buildTray.editSummary', { files: edit.affectedFiles.length, precedence: edit.precedence })}</span></label>)}
      </div>
      {review.collisions.length > 0 && <div className="mt-4 rounded-sm border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-text-secondary"><strong className="text-text-primary">{t('foundry.buildTray.collisions', { count: review.collisions.length })}</strong>{review.collisions.map((collision) => <p key={collision.file} className="mt-1 break-all">{t('foundry.buildTray.collisionWinner', { file: collision.file, winner: collision.winner.title })}</p>)}</div>}
      {review.writeSet.length > 0 && <details className="mt-3 text-xs text-text-secondary"><summary className="cursor-pointer text-text-primary">Final write-set ({review.writeSet.length})</summary><ul className="mt-1 max-h-32 overflow-auto break-all pl-4">{review.writeSet.map((file) => <li key={file}>{file}</li>)}</ul><p className="mt-2">Forge confirmation must show these paths, collision winners, and the selected load precedence. Cancelling leaves installed mods and staged sources unchanged.</p></details>}
      <button type="button" onClick={() => void forge()} disabled={!review.selected.length || forging} className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"><Hammer size={15} />{forging ? 'Forging…' : 'Confirm & forge VPK'}</button>
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-text-secondary"><p><RefreshCw size={12} className="mr-1 inline" />{t('foundry.buildTray.rebuild')}</p><p className="mt-1"><Undo2 size={12} className="mr-1 inline" />{t('foundry.buildTray.unmerge')}</p></div>
    </aside>
  );
}
