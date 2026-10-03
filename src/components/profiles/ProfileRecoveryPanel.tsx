import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listProfileRecoveryPoints, previewProfileRecovery, restoreProfileRecovery } from '../../lib/api';
import type { ProfileRecoveryPreview, ProfileRecoverySummary } from '../../types/profileRecovery';
import { Button, Card } from '../common/ui';
import { ConfirmModal } from '../common/PageComponents';
import { formatAbsoluteDate } from '../../lib/dates';

export default function ProfileRecoveryPanel({ revision, onRestored }: { revision: string; onRestored: () => Promise<void> }) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<ProfileRecoverySummary[]>([]);
  const [preview, setPreview] = useState<ProfileRecoveryPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setPoints(await listProfileRecoveryPoints()); }
    catch { setMessage(t('profiles.recovery.loadFailed')); }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh, revision]);
  const review = async (id: string) => {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    try { setPreview(await previewProfileRecovery(id)); }
    catch { setMessage(t('profiles.recovery.previewFailed')); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!preview?.canRestore || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await restoreProfileRecovery(preview.point.id, preview.reviewToken);
      setPreview(null);
      setMessage(t('profiles.recovery.restored'));
      try { await onRestored(); }
      catch { setMessage(`${t('profiles.recovery.restored')} ${t('profiles.recovery.loadFailed')}`); }
      await refresh();
    } catch (error) {
      setPreview(null);
      setMessage(t('profiles.recovery.restoreFailed', { error: String(error) }));
    } finally { setBusy(false); }
  };
  const reasonLabel = (reason: 'missing' | 'changed' | 'ambiguous') => {
    if (reason === 'missing') return t('profiles.recovery.missing');
    if (reason === 'changed') return t('profiles.recovery.changed');
    return t('profiles.recovery.ambiguous');
  };
  return (
    <Card title={t('profiles.recovery.title')} description={t('profiles.recovery.description')} accentEdge="none"
      action={<Button variant="ghost" disabled={busy} onClick={() => { setMessage(null); void refresh(); }}>{t('profiles.recovery.refresh')}</Button>}>
      <div className="space-y-4">
        {message && <p role="status" className="text-sm text-text-secondary break-words">{message}</p>}
        {!points.length && <p className="text-sm text-text-secondary">{t('profiles.recovery.empty')}</p>}
        <ul className="space-y-3">
          {points.map(point => (
            <li key={point.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="text-text-primary break-words">{point.profileName}</p>
                <p className="text-xs text-text-secondary">{formatAbsoluteDate(point.createdAt)} · {t('profiles.recovery.counts', { enabled: point.enabledCount, total: point.modCount })}</p>
              </div>
              <Button variant="secondary" disabled={busy} onClick={() => void review(point.id)}>{t('profiles.recovery.preview')}</Button>
            </li>
          ))}
        </ul>
        {preview && !preview.canRestore && (
          <div role="alert" className="border border-state-warning/30 rounded-sm p-4 text-sm text-text-secondary space-y-2">
            <p>{t('profiles.recovery.blocked')}</p>
            <ul className="space-y-1">{preview.issues.map((issue, index) => <li key={index}>{issue.name}: {reasonLabel(issue.reason)}</li>)}</ul>
          </div>
        )}
      </div>
      <ConfirmModal isOpen={!!preview?.canRestore} title={t('profiles.recovery.confirmTitle')}
        message={t('profiles.recovery.confirmMessage', { date: preview ? formatAbsoluteDate(preview.point.createdAt) : '', count: preview?.disableCount ?? 0 })}
        confirmLabel={t('profiles.recovery.restore')} cancelLabel={t('profiles.recovery.cancel')}
        busy={busy} onConfirm={() => void restore()} onCancel={() => { if (!busy) setPreview(null); }} />
    </Card>
  );
}
