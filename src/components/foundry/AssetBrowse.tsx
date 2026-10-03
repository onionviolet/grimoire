import { useEffect, useMemo, useState } from 'react';
import { Box, Eye, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { foundryAssets, foundryInspectAsset } from '../../lib/api';
import type { AssetInspectionEntry, AssetInspectionKind, AssetInspectionResult } from '../../types/assetInspection';
import { Button, Card, ModalHeader } from '../common/ui';
import { Select } from '../common/forms';
import { EmptyState, LoadingState } from '../common/PageComponents';
import SearchInput from '../common/SearchInput';
import { Modal, ModalBody } from '../common/Modal';
import ParticleAssetPreview from './ParticleAssetPreview';
import { useAppStore } from '../../stores/appStore';
const PAGE_SIZE = 40;
export default function AssetBrowse() {
  const { t } = useTranslation();
  const experimental = useAppStore(state => state.settings?.experimentalAbilityPreview ?? false);
  const [items, setItems] = useState<AssetInspectionEntry[]>([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssetInspectionKind | 'all'>('all');
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssetInspectionEntry | null>(null);
  const [inspection, setInspection] = useState<AssetInspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    foundryAssets().then(result => { if (active) { setItems(result); setLoading(false); setError(null); } })
      .catch(error => { if (active) { setError(String(error)); setLoading(false); } });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    foundryInspectAsset(selected.path).then(result => { if (active) setInspection(result); })
      .catch(error => { if (active) setInspectError(String(error)); });
    return () => { active = false; };
  }, [selected]);
  const visible = useMemo(() => items.filter(item => (kind === 'all' || item.kind === kind)
    && item.path.toLowerCase().includes(query.trim().toLowerCase())), [items, kind, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const retry = () => { setLoading(true); setPage(0); setRefresh(value => value + 1); };
  return <div className="space-y-4">
    <p className="text-sm text-text-secondary">{t('foundry.assets.description')}</p>
    <div className="flex flex-wrap items-start gap-3">
      <SearchInput value={query} onChange={value => { setQuery(value); setPage(0); }} placeholder={t('foundry.assets.search')}
        clearLabel={t('foundry.search.clear')} scope={t('foundry.assets.scope')} summary={t('foundry.assets.count', { count: visible.length, total: items.length })} />
      <Select aria-label={t('foundry.assets.kind')} className="max-w-48" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPage(0); }}>
        <option value="all">{t('foundry.assets.all')}</option><option value="texture">{t('foundry.assets.texture')}</option>
        <option value="material">{t('foundry.assets.material')}</option><option value="particle">{t('foundry.assets.particle')}</option>
      </Select>
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={retry} disabled={loading}>{t('common.actions.refresh')}</Button>
    </div>
    {loading ? <LoadingState label={t('foundry.assets.loading')} /> : error ? <EmptyState icon={Box} variant="error" title={t('foundry.assets.failed')} description={error} action={<Button onClick={retry}>{t('common.actions.retry')}</Button>} /> : visible.length === 0 ?
      <EmptyState icon={Box} title={t('foundry.assets.empty')} description={t('foundry.models.emptyHint')} /> : <>
      <div className="space-y-2">{visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(item => <Card key={item.path} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{item.label}</p><code className="block break-all text-xs text-text-secondary">{item.path}</code></div>
        <Button variant="ghost" size="sm" icon={Eye} onClick={() => { setInspection(null); setInspectError(null); setSelected(item); }}>{t('foundry.assets.inspect')}</Button>
      </Card>)}</div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('foundry.models.previous')}</Button>
        <span className="text-xs text-text-secondary">{t('foundry.models.page', { page: currentPage + 1, pages })}</span>
        <Button variant="secondary" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{t('foundry.models.next')}</Button>
      </div></>}
    <Modal open={!!selected} onClose={() => setSelected(null)} size="xl" labelledBy="foundry-asset-title">
      <ModalHeader titleId="foundry-asset-title" title={selected?.label ?? t('foundry.assets.inspect')} onClose={() => setSelected(null)} />
      <ModalBody><code className="block break-all text-xs text-text-secondary">{selected?.path}</code>
        {inspectError ? <p role="alert" className="mt-3 text-sm text-state-danger">{inspectError}</p> : !inspection ? <LoadingState label={t('foundry.assets.preparing')} /> : <div className="mt-3 space-y-3">
          {inspection.imageUrl && <img src={inspection.imageUrl} alt={selected?.label ?? ''} className="max-h-96 w-full object-contain" />}
          {inspection.entry.kind === 'texture' && !inspection.imageUrl && <p>{t('foundry.assets.noImage')}</p>}
          {inspection.details && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-bg-sunken p-3 text-xs text-text-secondary">{inspection.details}</pre>}
          {inspection.unavailable && <p className="break-all text-sm text-state-warning">{t('foundry.assets.unavailable', { reason: inspection.unavailable })}</p>}
          {inspection.descriptor && <>
            <pre className="max-h-64 overflow-auto rounded-sm bg-bg-sunken p-3 text-xs text-text-secondary">{JSON.stringify(inspection.descriptor, null, 2)}</pre>
            <p className="text-xs text-text-secondary">{t('foundry.assets.spriteHint')}</p>
            {experimental && inspection.textureBaseUrl && <ParticleAssetPreview descriptor={inspection.descriptor} textureBaseUrl={inspection.textureBaseUrl} />}
          </>}
        </div>}
      </ModalBody>
    </Modal>
  </div>;
}
