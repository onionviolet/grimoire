import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../common/ui';
import { Textarea } from '../common/forms';
import { foundryReviewModPackage } from '../../lib/api';
import type { ModPackageFinding, ModPackageReview } from '../../types/peerTools';

const FINDING_LABELS = {
  archive: 'foundry.packageReview.findings.archive',
  invalidVpk: 'foundry.packageReview.findings.invalidVpk',
  unsupportedWrapper: 'foundry.packageReview.findings.unsupportedWrapper',
  noVpk: 'foundry.packageReview.findings.noVpk',
  unreadable: 'foundry.packageReview.findings.unreadable',
  missingDependency: 'foundry.packageReview.findings.missingDependency',
  siblingDependency: 'foundry.packageReview.findings.siblingDependency',
  overlap: 'foundry.packageReview.findings.overlap',
  incomplete: 'foundry.packageReview.findings.incomplete',
} as const satisfies Record<ModPackageFinding['kind'], string>;

export default function ModPackageTool() {
  const { t } = useTranslation();
  const [review, setReview] = useState<ModPackageReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const select = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await foundryReviewModPackage();
      if (next) { setReview(next); setCopy('idle'); }
    } catch (err) {
      setReview(null);
      setError(String(err));
    } finally { setBusy(false); }
  };
  const summary = review && t('foundry.packageReview.summary', { packages: review.packages.length, models: review.modelsChecked });
  const findings = review?.findings.map(finding => [
    t(FINDING_LABELS[finding.kind]), finding.file, finding.entry, finding.detail,
  ].filter(Boolean).join(' · ')) ?? [];
  const scope = t('foundry.packageReview.scope');
  const report = review && [review.archive, summary, review.baseFingerprint, ...review.packages,
    ...(findings.length ? findings : [t('foundry.packageReview.clear')]), scope].join('\n');
  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopy('copied');
    } catch { setCopy('failed'); }
  };
  return <Card title={t('foundry.subtools.packageReview')} description={t('foundry.packageReview.description')} accentEdge="none">
    <div className="space-y-3">
      <Button variant="secondary" disabled={busy} isLoading={busy} onClick={() => void select()}>{t('foundry.packageReview.select')}</Button>
      {review && <>
        <p className="break-all text-sm font-medium text-text-primary">{review.archive}</p>
        <p role="status" className="text-sm text-text-secondary">{summary}</p>
        {review.packages.length > 0 && <details className="text-sm text-text-secondary">
          <summary className="cursor-pointer">{t('foundry.packageReview.members')}</summary>
          <ul className="mt-2 max-h-48 overflow-auto font-mono text-xs">
            {review.packages.map(file => <li key={file} className="break-all">{file}</li>)}
          </ul>
        </details>}
        {findings.length > 0
          ? <ul className="max-h-72 space-y-2 overflow-auto text-sm text-text-secondary">
              {findings.map((finding, index) => <li key={index} className="break-words">{finding}</li>)}
            </ul>
          : <p className="text-sm text-text-secondary">{t('foundry.packageReview.clear')}</p>}
        <p className="text-xs text-text-secondary">{scope}</p>
        <Button variant="secondary" onClick={() => void copyReport()}>{t('recovery.copyReport')}</Button>
        {copy !== 'idle' && <p role="status" className="text-sm text-text-secondary">{t(copy === 'copied' ? 'recovery.copied' : 'recovery.copyFailed')}</p>}
        {copy === 'failed' && <Textarea readOnly rows={6} value={report ?? ''} aria-label={t('recovery.reviewReport')} />}
      </>}
      {error && <p role="alert" className="break-words text-sm text-state-danger">{t('foundry.peerToolFailed', { error })}</p>}
    </div>
  </Card>;
}
