import { useTranslation } from 'react-i18next';
import { CircleCheck, Download } from 'lucide-react';
import type { MissingModsSummary } from './availability';

interface MissingModsBadgeProps {
  summary: MissingModsSummary;
  className?: string;
}

/**
 * Local install state: how many of this profile's mods are not on this machine
 * yet. Deliberately framed as neutral information rather than a problem, and
 * styled apart from ModsAvailableBadge: "you do not have this yet" is a normal
 * thing that importing fixes, while "GameBanana no longer has this" is not.
 *
 * Renders nothing when the profile has no GameBanana mods to match against:
 * "0 mods you do not have" out of nothing is noise, not information.
 */
export default function MissingModsBadge({ summary, className = '' }: MissingModsBadgeProps) {
  const { t } = useTranslation();
  if (summary.total === 0) return null;

  const base =
    'inline-flex items-center gap-1 text-[11px] leading-tight px-1.5 py-0.5 rounded-sm border';

  if (summary.missing === 0) {
    return (
      <span className={`${base} border-white/10 bg-white/[0.03] text-text-secondary ${className}`}>
        <CircleCheck className="w-3 h-3 flex-shrink-0" />
        {t('discover.card.haveAll')}
      </span>
    );
  }

  return (
    <span
      className={`${base} border-accent/30 bg-accent/10 text-accent ${className}`}
      title={t('discover.card.missingHint')}
    >
      <Download className="w-3 h-3 flex-shrink-0" />
      {t('discover.card.missing', { count: summary.missing })}
    </span>
  );
}
