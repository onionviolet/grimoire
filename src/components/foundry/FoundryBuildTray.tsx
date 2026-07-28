import { Layers3, RefreshCw, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FoundryStagedEdit } from './buildTray';
import { affectedFileCount, analyzeStagedEdits, normalizeOutputName } from './buildTray';

interface FoundryBuildTrayProps {
  edits: readonly FoundryStagedEdit[];
  outputName: string;
  onOutputNameChange: (name: string) => void;
}

/**
 * Read-only pre-build review. It intentionally has no build button until every
 * Foundry authoring flow hands us an input file and the main-process build IPC
 * can atomically mint one tracked VPK. This keeps opening Foundry non-mutating.
 */
export default function FoundryBuildTray({ edits, outputName, onOutputNameChange }: FoundryBuildTrayProps) {
  const { t } = useTranslation();
  const collisions = analyzeStagedEdits(edits);
  const files = affectedFileCount(edits);
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
        <p>{t('foundry.buildTray.summary', { edits: edits.length, files })}</p>
        {edits.length === 0 ? <p className="rounded-sm border border-dashed border-border p-2">{t('foundry.buildTray.empty')}</p> : edits.map((edit) => <div key={edit.id} className="rounded-sm border border-border p-2"><strong className="text-text-primary">{edit.title}</strong><br />{t('foundry.buildTray.editSummary', { files: edit.affectedFiles.length, precedence: edit.precedence })}</div>)}
      </div>
      {collisions.length > 0 && <div className="mt-4 rounded-sm border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-text-secondary"><strong className="text-text-primary">{t('foundry.buildTray.collisions', { count: collisions.length })}</strong>{collisions.map((collision) => <p key={collision.file} className="mt-1 break-all">{t('foundry.buildTray.collisionWinner', { file: collision.file, winner: collision.winner.title })}</p>)}</div>}
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-text-secondary"><p><RefreshCw size={12} className="mr-1 inline" />{t('foundry.buildTray.rebuild')}</p><p className="mt-1"><Undo2 size={12} className="mr-1 inline" />{t('foundry.buildTray.unmerge')}</p></div>
    </aside>
  );
}
