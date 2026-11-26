import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../common/ui';
import { foundryAddStockVfx, foundryExportStockVfx, foundryReviewStockVfx } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import type { StockVfxReview } from '../../types/peerTools';

export default function StockVfxTool() {
  const { t } = useTranslation();
  const [review, setReview] = useState<StockVfxReview | null>(null);
  const [busy, setBusy] = useState<'review' | 'export' | 'add' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const select = async () => {
    setBusy('review');
    setError(null);
    try {
      const next = await foundryReviewStockVfx();
      if (next) { setReview(next); setExported(null); setAdded(false); }
    } catch (err) {
      setReview(null);
      setExported(null);
      setError(String(err));
    } finally { setBusy(null); }
  };
  const makeOverlay = async (selection: StockVfxReview, action: 'add' | 'export') => {
    setBusy(action);
    setError(null);
    setExported(null);
    try {
      if (action === 'add') {
        await foundryAddStockVfx(selection.sourcePath, selection.reviewToken, t('foundry.stockVfx.overlayName', { hero: selection.codename }));
        setAdded(true);
        void useAppStore.getState().loadMods({ silent: true });
      } else {
        const result = await foundryExportStockVfx(selection.sourcePath, selection.reviewToken);
        if (result.exported) setExported(result.path ?? '');
      }
    } catch (err) { setError(String(err)); }
    finally { setBusy(null); }
  };
  const canBuild = Boolean(review?.entries.length);
  return <Card title={t('foundry.subtools.stockVfx')} description={t('foundry.stockVfx.description')} accentEdge="none">
    <div className="space-y-3">
      <Button variant="secondary" disabled={busy !== null} isLoading={busy === 'review'} onClick={() => void select()}>
        {t('foundry.stockVfx.select')}
      </Button>
      {review && <>
        <p className="break-all text-sm text-text-primary">{review.sourcePath.split(/[\\/]/).pop()} · {review.codename}</p>
        <p className="text-sm text-text-secondary">{t('foundry.stockVfx.scope')}</p>
        {(review.missingStock.length > 0 || review.outsideLayer.length > 0 ||
          review.affectedDependencies.length > 0 || review.missingDependencies.length > 0) &&
          <p className="text-sm text-state-warning">{t('foundry.stockVfx.partial')}</p>}
        {([
          ['entries', t('foundry.stockVfx.entries', { count: review.entries.length })],
          ['missingStock', t('foundry.stockVfx.missingStock')],
          ['outsideLayer', t('foundry.stockVfx.outsideLayer')],
          ['missingDependencies', t('foundry.stockVfx.missingDependencies')],
          ['affectedDependencies', t('foundry.stockVfx.affectedDependencies')],
        ] as const).map(([key, label]) => review[key].length > 0 && <details key={key} className="text-sm text-text-secondary">
          <summary className="cursor-pointer">{label}</summary>
          <ul className="mt-2 max-h-48 overflow-auto font-mono text-xs">
            {review[key].map(path => <li key={path} className="break-all">{path}</li>)}
          </ul>
        </details>)}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy !== null || !canBuild || added} isLoading={busy === 'add'}
            onClick={() => void makeOverlay(review, 'add')}>{t('foundry.stockVfx.add')}</Button>
          <Button variant="secondary" disabled={busy !== null || !canBuild} isLoading={busy === 'export'}
            onClick={() => void makeOverlay(review, 'export')}>{t('foundry.stockVfx.export')}</Button>
        </div>
        {added && <p role="status" className="text-sm text-text-secondary">{t('foundry.stockVfx.added')}</p>}
      </>}
      {exported !== null && <p role="status" className="break-all text-sm text-text-secondary">
        {t('foundry.stockVfx.exported', { path: exported })}
      </p>}
      {error && <p role="alert" className="break-words text-sm text-state-danger">{t('foundry.peerToolFailed', { error })}</p>}
    </div>
  </Card>;
}
