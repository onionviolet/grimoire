import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NonStandardReport, NonStandardTier } from '../../types/foundry';

const TIER_ORDER: NonStandardTier[] = ['subject-not-live', 'unreferenced-sound', 'naming-signal'];

/** A compact, evidence-first report.  Tier C is visibly separate because it is
 * a path-name hint rather than a conclusion about unused content. */
export default function NonStandardReportView({ report }: { report: NonStandardReport }) {
  const { t } = useTranslation();
  const [showNaming, setShowNaming] = useState(false);
  const groups = useMemo(() => TIER_ORDER.map((tier) => ({
    tier,
    findings: report.findings.filter((finding) => finding.tier === tier),
  })).filter((group) => group.findings.length && (showNaming || group.tier !== 'naming-signal')), [report, showNaming]);

  return <section className="space-y-4 rounded-md border border-border bg-bg-secondary p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{t('foundry.nonStandard.title', 'Non-standard files')}</h2>
        <p className="text-xs text-text-secondary">
          {t('foundry.nonStandard.confirmed', '{{count}} findings backed by roster or live sound references.', { count: report.confirmedCount })}
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={showNaming} onChange={(event) => setShowNaming(event.target.checked)} className="accent-accent" />
        {t('foundry.nonStandard.showNaming', 'Show naming signals')}
      </label>
    </div>
    {groups.map(({ tier, findings }) => <div key={tier} className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {tier === 'subject-not-live'
          ? t('foundry.nonStandard.subject', 'Subject is not live')
          : tier === 'unreferenced-sound'
            ? t('foundry.nonStandard.sound', 'No live sound reference')
            : t('foundry.nonStandard.naming', 'Naming signal only')}
        <span className="ml-2 tabular-nums">{findings.length}</span>
      </h3>
      <ul className="divide-y divide-border rounded-sm border border-border text-xs">
        {findings.map((finding) => <li key={`${finding.tier}:${finding.path}`} className="px-3 py-2">
          <p className="break-all font-mono text-text-primary">{finding.path}</p>
          <p className="mt-0.5 text-text-secondary">{finding.reason}</p>
        </li>)}
      </ul>
    </div>)}
  </section>;
}
