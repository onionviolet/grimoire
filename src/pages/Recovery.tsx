import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { buildDiagnosticReport, scanInstallationHealth } from '../lib/api';
import type { InstallationHealthReport } from '../types/recovery';
import { PageLayout, PageHeader, EmptyState, LoadingState, SectionHeader } from '../components/common/PageComponents';
import { Button } from '../components/common/ui';
import { Textarea } from '../components/common/forms';
import HealthIssues from '../components/recovery/HealthIssues';

export default function Recovery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [health, setHealth] = useState<InstallationHealthReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [description, setDescription] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const scan = async () => {
    setScanning(true);
    setScanError(false);
    setReport(null);
    setReportError(false);
    setCopyState('idle');
    try {
      setHealth(await scanInstallationHealth());
    } catch {
      setHealth(null);
      setScanError(true);
    } finally {
      setScanning(false);
    }
  };
  const buildReport = async () => {
    setBuilding(true);
    setReportError(false);
    setReport(null);
    setCopyState('idle');
    try {
      // The existing main-process builder sanitizes both this snapshot and the log.
      const context = health ? `${description}\n\nInstallation health:\n${JSON.stringify(health, null, 2)}` : description;
      setReport(await buildDiagnosticReport(context));
    } catch {
      setReportError(true);
    } finally {
      setBuilding(false);
    }
  };
  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader title={t('recovery.title')} description={t('recovery.description')}
        action={<Button icon={RefreshCw} isLoading={scanning} disabled={scanning || building} onClick={scan}>{health ? t('recovery.refresh') : t('recovery.scan')}</Button>} />
      <p className="text-sm text-text-secondary">{t('recovery.readOnly')}</p>
      {scanning ? <LoadingState label={t('recovery.scanning')} />
        : scanError ? <EmptyState icon={AlertTriangle} variant="error" title={t('recovery.scanFailed')} description={t('recovery.scanFailedHelp')} />
        : !health ? <EmptyState icon={ShieldCheck} title={t('recovery.startTitle')} description={t('recovery.startDescription')} />
        : health.pathState === 'unset' ? <EmptyState icon={AlertTriangle} title={t('recovery.noPath')} description={t('recovery.noPathDescription')}
          action={<Button variant="secondary" onClick={() => navigate('/settings/game')}>{t('recovery.openSettings')}</Button>} />
        : <section className="space-y-4" aria-live="polite">
          <SectionHeader>{t('recovery.results')}</SectionHeader>
          <div className="text-sm text-text-secondary space-y-2">
            <p>{t('recovery.scannedAt', { time: new Date(health.scannedAt).toLocaleString() })}</p>
            {health.gamePath && <p className="font-mono text-xs break-all">{health.gamePath}</p>}
            {health.pathState === 'ready' && <>
              <p>{t('recovery.modsChecked', health.mods)}</p>
              {health.disk && <p>{t('recovery.diskFree', { free: (health.disk.freeBytes / 1024 ** 3).toFixed(1), total: (health.disk.totalBytes / 1024 ** 3).toFixed(1) })}</p>}
            </>}
          </div>
          {health.issues.length ? <HealthIssues issues={health.issues} />
            : <EmptyState icon={ShieldCheck} title={t('recovery.noIssues')} description={t('recovery.noIssuesDescription')} />}
          <p className="text-xs text-text-tertiary">{t('recovery.scope')}</p>
        </section>}
      <section className="space-y-3 rounded-sm border border-border bg-bg-secondary p-4">
        <SectionHeader>{t('recovery.diagnosticsTitle')}</SectionHeader>
        <p className="text-sm text-text-secondary">{t('recovery.diagnosticsDescription')}</p>
        <label className="block text-sm text-text-secondary" htmlFor="recovery-description">{t('recovery.whatHappened')}</label>
        <Textarea id="recovery-description" disabled={building} value={description} onChange={(event) => { setDescription(event.target.value); setReport(null); }} rows={3} />
        <Button variant="secondary" isLoading={building} disabled={building || scanning} onClick={buildReport}>{t('recovery.buildReport')}</Button>
        {reportError && <p role="alert" className="text-sm text-state-danger">{t('recovery.reportFailed')}</p>}
        {report && <>
          <label className="block text-sm text-text-secondary" htmlFor="recovery-report">{t('recovery.reviewReport')}</label>
          <Textarea id="recovery-report" value={report} readOnly rows={14} className="font-mono text-xs" />
          <Button variant="secondary" icon={Copy} onClick={copyReport}>{t('recovery.copyReport')}</Button>
          <span role="status" className={`ml-3 text-xs ${copyState === 'failed' ? 'text-state-danger' : 'text-text-secondary'}`}>
            {copyState === 'copied' ? t('recovery.copied') : copyState === 'failed' ? t('recovery.copyFailed') : null}
          </span>
        </>}
      </section>
    </PageLayout>
  );
}
