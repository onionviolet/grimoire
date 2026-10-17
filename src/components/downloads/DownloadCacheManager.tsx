import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DownloadCachePreview } from '../../types/downloadCache';
import { Button } from '../common/ui';
import { SectionHeader } from '../common/PageComponents';
import { useConfirm } from '../common/confirmContext';

const size = (bytes: number) => (bytes / 1024 ** 2).toFixed(1);
export default function DownloadCacheManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [preview, setPreview] = useState<DownloadCachePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const review = async () => {
    setBusy(true); setFailed(false); setResult(null);
    try { setPreview(await window.electronAPI.previewDownloadCache()); }
    catch { setPreview(null); setFailed(true); }
    finally { setBusy(false); }
  };
  const clean = async () => {
    if (!preview || busy) return;
    setBusy(true); setFailed(false); setResult(null);
    try {
      const items = preview.items.filter(item => item.removable);
      if (!await confirm({ title: t('downloadCache.confirmTitle'), message: t('downloadCache.confirmDescription'),
        itemsLabel: t('downloadCache.fileCount', { count: items.length }),
        items: items.map(item => t('downloadCache.file', { name: item.name, size: size(item.bytes) })), wrapItems: true,
        confirmLabel: t('downloadCache.clean'), variant: 'danger' })) return;
      const cleaned = await window.electronAPI.cleanDownloadCache(preview.reviewToken);
      setResult(t('downloadCache.cleaned', { count: cleaned.removed, size: size(cleaned.bytesFreed), failed: cleaned.failed }));
      setPreview(await window.electronAPI.previewDownloadCache());
    } catch { setPreview(null); setFailed(true); }
    finally { setBusy(false); }
  };
  return <section className="rounded-sm border border-border bg-bg-secondary p-4">
    <SectionHeader>{t('downloadCache.title')}</SectionHeader>
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">{t('downloadCache.description')}</p>
      <Button variant="secondary" disabled={busy} isLoading={busy} onClick={review}>{t('downloadCache.review')}</Button>
      {failed && <p role="alert" className="text-sm text-state-danger">{t('downloadCache.failed')}</p>}
      {result && <p role="status" className="text-sm text-text-secondary">{result}</p>}
      {preview && <>
        <p className="text-sm text-text-secondary">{t('downloadCache.summary', { count: preview.items.length, size: size(preview.bytes) })}</p>
        <ul className="max-h-64 overflow-y-auto divide-y divide-border">
          {preview.items.map(item => <li key={item.name} className="space-y-1 py-2 text-xs">
            <p className="break-all font-mono text-text-primary">{item.name}</p>
            <p className="text-text-secondary">{t('downloadCache.item', { size: size(item.bytes), reason: t(`downloadCache.reasons.${item.reason}`) })}</p>
          </li>)}
        </ul>
        <Button variant="secondary" disabled={busy || !preview.items.some(item => item.removable)} onClick={() => void clean()}>{t('downloadCache.clean')}</Button>
      </>}
    </div>
  </section>;
}
