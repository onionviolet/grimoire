import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../common/ui';
import { ConfirmModal } from '../common/PageComponents';
import { getInterruptedProfileRecovery, recoverInterruptedProfileRecovery, reviewSetupCompatibility, getModIsolationSession, startModIsolation,
  applyModIsolationTrial, recordModIsolationResult, finishModIsolation } from '../../lib/api';
import type { InterruptedRecovery } from '../../types/profileRecovery';
import type { CompatibilityReview, ModIsolationSession } from '../../types/recovery';

export default function RecoveryTools() {
  const { t } = useTranslation();
  const [interrupted, setInterrupted] = useState<InterruptedRecovery | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityReview | null>(null);
  const [session, setSession] = useState<ModIsolationSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState<'trial' | 'restore' | 'interrupted' | null>(null);
  const refresh = async () => {
    const [journal, isolation] = await Promise.all([getInterruptedProfileRecovery(), getModIsolationSession()]);
    setInterrupted(journal); setSession(isolation);
  };
  useEffect(() => { void refresh().catch(() => setError(true)); }, []);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await action(); await refresh(); setConfirm(null); }
    catch { setError(true); await refresh().catch(() => {}); }
    finally { setBusy(false); }
  };
  const apply = () => {
    if (confirm === 'interrupted' && interrupted) return run(() => recoverInterruptedProfileRecovery(interrupted.reviewToken));
    if (confirm === 'trial' && session) return run(() => applyModIsolationTrial(session.reviewToken));
    if (confirm === 'restore' && session) return run(() => finishModIsolation(session.restoreReviewToken ?? session.reviewToken));
  };
  const testing = session?.phase === 'testing' || session?.phase === 'baseline-testing';
  const ready = session?.phase === 'ready' || session?.phase === 'baseline-ready';
  const testNames = session?.candidates.filter(mod => session.phase === 'complete' || session.testIds.includes(mod.id)).map(mod => mod.name) ?? [];
  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-state-danger">{t('recovery.tools.failed')}</p>}
    {interrupted && <Card title={t('recovery.tools.interruptedTitle')} accentEdge="none">
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t('recovery.tools.interruptedDescription', { count: interrupted.fileCount })}</p>
        {!interrupted.canRecover && <p role="alert" className="text-sm text-state-warning">{t('recovery.tools.interruptedChanged')}</p>}
        <Button variant="secondary" disabled={busy || !interrupted.canRecover} onClick={() => setConfirm('interrupted')}>{t('recovery.tools.recoverInterrupted')}</Button>
      </div>
    </Card>}
    <Card title={t('recovery.tools.compatibilityTitle')} description={t('recovery.tools.compatibilityDescription')} accentEdge="none"
      action={<Button variant="ghost" disabled={busy} onClick={() => void run(async () => setCompatibility(await reviewSetupCompatibility()))}>{t('recovery.tools.reviewCompatibility')}</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t('recovery.tools.compatibilityScope')}</p>
        {compatibility && <>
          <p className="text-xs text-text-tertiary">{t('recovery.scannedAt', { time: new Date(compatibility.reviewedAt).toLocaleString() })}</p>
          <ul className="space-y-3">
            {compatibility.mods.map(mod => <li key={mod.id} className="text-sm">
              <p className="text-text-primary break-words">{mod.name}</p>
              <p className="text-text-secondary">{mod.status === 'unreadable' ? t('recovery.tools.unreadable') : mod.status === 'review'
                ? t('recovery.tools.missingPaths', { count: mod.missingCount, total: mod.sensitiveCount }) : t('recovery.tools.noMissingPaths', { count: mod.sensitiveCount })}</p>
              {!!mod.missingPaths.length && <details className="mt-2"><summary className="cursor-pointer text-text-secondary">{t('recovery.tools.showPaths')}</summary>
                <ul className="mt-2 space-y-1 font-mono text-xs text-text-tertiary">{mod.missingPaths.map(path => <li className="break-all" key={path}>{path}</li>)}</ul>
              </details>}
            </li>)}
          </ul>
        </>}
      </div>
    </Card>
    <Card title={t('recovery.tools.isolationTitle')} description={t('recovery.tools.isolationDescription')} accentEdge="none">
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{t('recovery.tools.isolationScope')}</p>
        {session?.strategy === 'delta' && <p className="text-xs text-text-secondary">{t('recovery.tools.deltaScope')}</p>}
        {!session ? <Button variant="secondary" disabled={busy || !!interrupted} onClick={() => void run(startModIsolation)}>{t('recovery.tools.startIsolation')}</Button>
          : <>
            <p role="status" className="text-sm text-text-primary">{session.phase === 'baseline-ready' ? t('recovery.tools.baselineReady')
              : session.phase === 'baseline-testing' ? t('recovery.tools.baselineTesting')
              : session.phase === 'ready' ? session.trialKind === 'original' ? t('recovery.tools.originalReady') : t('recovery.tools.trialReady', { count: session.testIds.length, remaining: session.candidates.length })
              : session.phase === 'testing' ? t('recovery.tools.trialTesting')
              : session.phase === 'complete' ? session.interactingSet ? t('recovery.tools.interacting', { names: session.candidates.map(mod => mod.name).join(', ') }) : t('recovery.tools.candidate', { name: session.candidates[0]?.name }) : t('recovery.tools.inconclusive')}</p>
            {!!testNames.length && <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">{testNames.map((name, index) => <li key={index}>{name}</li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              {ready && <Button variant="secondary" disabled={busy || !!interrupted} onClick={() => setConfirm('trial')}>{t('recovery.tools.applyTrial')}</Button>}
              {testing && <>
                <Button variant="secondary" disabled={busy || !!interrupted} onClick={() => void run(() => recordModIsolationResult(session.reviewToken, 'works'))}>{t('recovery.tools.works')}</Button>
                <Button variant="secondary" disabled={busy || !!interrupted} onClick={() => void run(() => recordModIsolationResult(session.reviewToken, 'crashes'))}>{t('recovery.tools.crashes')}</Button>
              </>}
              <Button variant="ghost" disabled={busy} onClick={() => void run(refresh)}>{t('recovery.tools.refreshReview')}</Button>
              <Button variant="secondary" disabled={busy || !!interrupted} onClick={() => setConfirm('restore')}>{t('recovery.tools.restoreOriginal')}</Button>
            </div>
          </>}
      </div>
    </Card>
    <ConfirmModal isOpen={!!confirm} title={t('recovery.tools.confirmTitle')}
      message={confirm === 'trial' ? t('recovery.tools.confirmTrial') : confirm === 'interrupted' ? t('recovery.tools.confirmInterrupted') : t('recovery.tools.confirmRestore')}
      confirmLabel={t('recovery.tools.confirm')} cancelLabel={t('profiles.recovery.cancel')} busy={busy}
      onConfirm={() => void apply()} onCancel={() => { if (!busy) setConfirm(null); }} />
  </div>;
}
