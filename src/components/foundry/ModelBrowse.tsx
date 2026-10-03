import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Download, Eye, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { foundryModels, foundryModelPreview, foundryExportModel } from '../../lib/api';
import type { FoundryModelEntry, FoundryModelPreview } from '../../types/foundryModels';
import { Button, Card, ModalHeader } from '../common/ui';
import { EmptyState, LoadingState } from '../common/PageComponents';
import SearchInput from '../common/SearchInput';
import { Modal, ModalBody } from '../common/Modal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { showToast } from '../../stores/toastStore';

const ModelAssetPreview = lazy(() => import('./ModelAssetPreview'));
const PAGE_SIZE = 40;

export default function ModelBrowse() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FoundryModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [selected, setSelected] = useState<FoundryModelEntry | null>(null);
  const [preview, setPreview] = useState<FoundryModelPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let current = true;
    foundryModels().then((models) => { if (current) { setItems(models); setError(null); setLoading(false); } })
      .catch((err) => { if (current) { setError(String(err)); setLoading(false); } });
    return () => { current = false; };
  }, [generation]);
  useEffect(() => {
    if (!selected) return;
    let current = true;
    foundryModelPreview(selected.path).then((result) => { if (current) setPreview(result); })
      .catch((err) => { if (current) setPreviewError(String(err)); });
    return () => { current = false; };
  }, [selected]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => `${item.label} ${item.path}`.toLowerCase().includes(search));
  }, [items, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const refresh = () => { setLoading(true); setPage(0); setGeneration((value) => value + 1); };
  const open = (item: FoundryModelEntry) => { setPreview(null); setPreviewError(null); setSelected(item); };
  const exportModel = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const result = await foundryExportModel(selected.path);
      if (result.exported) showToast(t('foundry.export.saved', { path: result.path }), { tone: 'success' });
    } catch (err) { showToast(String(err), { tone: 'error' }); } finally { setExporting(false); }
  };
  return <div className="space-y-4">
    <p className="text-sm text-text-secondary">{t('foundry.models.description')}</p>
    <div className="flex flex-wrap items-start gap-3">
      <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(0); }}
        placeholder={t('foundry.models.search')} clearLabel={t('foundry.search.clear')}
        scope={t('foundry.models.scope')} summary={t('foundry.models.count', { count: visible.length, total: items.length })} />
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh} disabled={loading}>{t('common.actions.refresh')}</Button>
    </div>
    {loading ? <LoadingState label={t('foundry.models.loading')} /> : error ?
      <EmptyState icon={Box} variant="error" title={t('foundry.models.failed')} description={<span className="break-all">{error}</span>} action={<Button variant="secondary" onClick={refresh}>{t('common.actions.retry')}</Button>} /> :
      visible.length === 0 ? <EmptyState icon={Box} title={t('foundry.models.empty')} description={t('foundry.models.emptyHint')}
        action={query ? <Button variant="secondary" onClick={() => { setQuery(''); setPage(0); }}>{t('foundry.search.clear')}</Button> : undefined} /> : <>
        <div className="space-y-2">
          {visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((item) => <Card key={item.path} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{item.label}</p><code className="block break-all text-xs text-text-secondary">{item.path}</code></div>
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => open(item)}>{t('foundry.models.preview')}</Button>
          </Card>)}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('foundry.models.previous')}</Button>
          <span className="text-xs text-text-secondary">{t('foundry.models.page', { page: currentPage + 1, pages })}</span>
          <Button variant="secondary" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{t('foundry.models.next')}</Button>
        </div>
      </>}
    <Modal open={!!selected} onClose={() => setSelected(null)} size="xl" labelledBy="foundry-model-title">
      <ModalHeader titleId="foundry-model-title" title={selected?.label ?? t('foundry.models.preview')} onClose={() => setSelected(null)}
        actions={<Button variant="secondary" size="sm" icon={Download} onClick={() => void exportModel()} disabled={!preview || exporting} isLoading={exporting}>{t('foundry.models.export')}</Button>} />
      <ModalBody>
        {selected && <><code className="block break-all text-xs text-text-secondary">{selected.path}</code>
          <div className="my-3 h-96 overflow-hidden rounded-sm bg-bg-sunken" aria-label={t('foundry.models.preview')}>
            {previewError ? <EmptyState icon={Box} variant="error" title={t('foundry.models.previewFailed')} description={<span className="break-all">{previewError}</span>} /> : preview ?
              <ErrorBoundary key={preview.url} fallback={<EmptyState icon={Box} variant="error" title={t('foundry.models.previewFailed')} description={t('foundry.models.previewFallback')} />}>
                <Suspense fallback={<LoadingState label={t('foundry.models.preparing')} />}><ModelAssetPreview url={preview.url} /></Suspense>
              </ErrorBoundary> : <LoadingState label={t('foundry.models.preparing')} />}
          </div>
          <p className="text-xs text-text-secondary">{t('foundry.models.previewHint')}</p></>}
      </ModalBody>
    </Modal>
  </div>;
}
