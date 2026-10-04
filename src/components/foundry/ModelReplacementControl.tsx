import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/ui';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { foundrySelectModelReplacement } from '../../lib/api';
import type { ModelReplacementSelection } from '../../types/modelReplacement';
import type { FoundryStagedEdit, ModelStagedEdit } from './buildTray';
import ModelAssetPreview from './ModelAssetPreview';

export default function ModelReplacementControl({ entryPath, onStage }: { entryPath: string; onStage: (edit: FoundryStagedEdit) => void }) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<ModelReplacementSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async () => {
    setBusy(true); setError(null);
    try { const result = await foundrySelectModelReplacement(entryPath); if (result) setSelection(result); }
    catch (failure) { setSelection(null); setError(String(failure)); }
    finally { setBusy(false); }
  };
  const stage = () => {
    if (!selection) return;
    const edit: ModelStagedEdit = { id: `model:${entryPath}`, kind: 'model', title: entryPath.split('/').pop()!,
      affectedFiles: selection.review.entries, precedence: 0, request: selection.review };
    onStage(edit); setSelection(null);
  };
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-text-secondary">{t('foundry.models.replacement.help')}</p>
    <Button variant="secondary" size="sm" isLoading={busy} disabled={busy} onClick={() => void choose()}>{t('foundry.models.replacement.choose')}</Button>
    {error && <p role="alert" className="break-all text-sm text-state-danger">{error}</p>}
    {selection && <>
      <div className="h-80 overflow-hidden rounded-sm bg-bg-sunken"><ErrorBoundary fallback={<p>{t('foundry.models.previewFailed')}</p>}><ModelAssetPreview url={selection.preview.url} /></ErrorBoundary></div>
      <p className="text-xs text-text-secondary">{t('foundry.models.replacement.dependencies')}</p>
      <ul className="max-h-40 overflow-auto space-y-1 text-xs text-text-secondary">{selection.review.dependencies.map(dependency => <li key={dependency.path} className="break-all">{dependency.path}: {t(`foundry.models.replacement.${dependency.source}`)}</li>)}</ul>
      <p className="text-xs text-text-secondary">{t('foundry.models.replacement.writeSet', { count: selection.review.entries.length })}</p>
      <ul className="max-h-40 overflow-auto space-y-1 font-mono text-xs text-text-secondary">{selection.review.entries.map(path => <li key={path} className="break-all">{path}</li>)}</ul>
      <Button size="sm" disabled={busy} onClick={stage}>{t('foundry.models.replacement.stage')}</Button>
    </>}
  </div>;
}
