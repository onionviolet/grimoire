import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, ModalHeader } from '../common/ui';
import { Modal, ModalBody } from '../common/Modal';
import type { DownloadJob } from '../../types/downloadJobs';

export default function DownloadHistory({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    try { setJobs(await window.electronAPI.getDownloadJobs()); setError(null); }
    catch (failure) { setError(String(failure)); }
  };
  useEffect(() => {
    let active = true;
    const load = () => { void window.electronAPI.getDownloadJobs().then(next => { if (active) setJobs(next); }).catch(failure => { if (active) setError(String(failure)); }); };
    load();
    const unsubscribe = window.electronAPI.onDownloadQueueUpdated(load);
    return () => { active = false; unsubscribe(); };
  }, []);
  const retry = async (job: DownloadJob) => {
    setBusy(job.id); setError(null);
    try { await window.electronAPI.retryDownloadJob(job.id); }
    catch (failure) { setError(String(failure)); }
    finally { setBusy(null); await refresh(); }
  };
  const resumable = jobs.filter(job => ['paused', 'failed'].includes(job.state));
  const content = <div className="space-y-3">
    <p className="text-sm text-text-secondary">{t('downloadHistory.help')}</p>
    {error && <p role="alert" className="break-all text-sm text-state-danger">{error}</p>}
    {[...jobs].reverse().slice(0, 30).map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="min-w-0"><p className="break-all text-sm text-text-primary">{job.args.modName || job.args.fileName}</p>
        <p className="text-xs text-text-secondary">{t(`downloadHistory.states.${job.state}`)}</p>
        {job.error && <p className="break-all text-xs text-state-warning">{job.error}</p>}</div>
      {['paused', 'failed', 'cancelled'].includes(job.state) && <Button variant="secondary" size="sm" disabled={busy !== null} isLoading={busy === job.id} onClick={() => void retry(job)}>{t('downloadHistory.retry')}</Button>}
    </div>)}
    {!jobs.length && <p className="text-sm text-text-secondary">{t('downloadHistory.empty')}</p>}
    <Button variant="ghost" size="sm" onClick={() => void refresh()}>{t('common.actions.refresh')}</Button>
  </div>;
  if (!compact) return <Card title={t('downloadHistory.title')} className="p-4">{content}</Card>;
  if (!resumable.length) return null;
  return <>
    <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t('downloadHistory.pending', { count: resumable.length })}</Button>
    <Modal open={open} onClose={() => setOpen(false)} size="lg" labelledBy="download-history-title">
      <ModalHeader title={t('downloadHistory.title')} titleId="download-history-title" onClose={() => setOpen(false)} />
      <ModalBody>{content}</ModalBody>
    </Modal>
  </>;
}
