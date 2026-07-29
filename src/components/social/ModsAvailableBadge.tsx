import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleHelp, TriangleAlert } from 'lucide-react';
import { resolveModsAvailability, type AvailabilityInput } from './availability';
import { formatAbsoluteDate } from '../../lib/dates';

interface ModsAvailableBadgeProps {
  profile: AvailabilityInput;
  /** GameBanana ids the cron could not fetch. Only the detail response carries
   *  these; when present they are appended to the tooltip so the profile can
   *  name what is gone instead of only counting it. Ids are numbers, so no
   *  extra copy is needed to render them. */
  unavailableModIds?: number[] | null;
  className?: string;
}

/**
 * Upstream availability: how much of this profile GameBanana can still serve,
 * as of the last revalidation pass. This is NOT about the local machine. The
 * companion signal ("mods you do not have installed yet") is MissingModsBadge,
 * and the two are styled apart on purpose: this one is a warning about the
 * profile, that one is a to-do list for the import.
 *
 * The unknown state is load-bearing. A profile the cron has never looked at
 * gets an explicitly neutral "not checked yet" badge rather than a reassuring
 * green one, because we genuinely do not know.
 *
 * The unsupported state renders nothing at all. That is a different situation:
 * the service is not reporting availability whatsoever, so a "not checked yet"
 * badge on every single card would be permanent furniture advertising a check
 * that will never run.
 */
export default function ModsAvailableBadge({
  profile,
  unavailableModIds,
  className = '',
}: ModsAvailableBadgeProps) {
  const { t } = useTranslation();
  const availability = resolveModsAvailability(profile);

  const checkedAt = profile.mods_revalidated_at
    ? formatAbsoluteDate(new Date(profile.mods_revalidated_at * 1000).toISOString())
    : null;

  const base =
    'inline-flex items-center gap-1 text-[11px] leading-tight px-1.5 py-0.5 rounded-sm border';

  if (availability.kind === 'unsupported') return null;

  if (availability.kind === 'unknown') {
    return (
      <span
        className={`${base} border-white/10 bg-white/[0.03] text-text-tertiary ${className}`}
        title={t('discover.card.modsUncheckedHint')}
      >
        <CircleHelp className="w-3 h-3 flex-shrink-0" />
        {t('discover.card.modsUnchecked')}
      </span>
    );
  }

  const baseHint = checkedAt
    ? t('discover.card.modsAvailableHint', { date: checkedAt })
    : undefined;
  const goneList =
    unavailableModIds && unavailableModIds.length > 0
      ? `GameBanana: ${unavailableModIds.map((id) => `#${id}`).join(', ')}`
      : null;
  const hint = [baseHint, goneList].filter(Boolean).join('\n') || undefined;

  if (availability.kind === 'all') {
    return (
      <span
        className={`${base} border-green-500/25 bg-green-500/10 text-green-300 ${className}`}
        title={hint}
      >
        <CircleCheck className="w-3 h-3 flex-shrink-0" />
        {t('discover.card.modsAllAvailable', { total: availability.total })}
      </span>
    );
  }

  return (
    <span
      className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-300 ${className}`}
      title={hint}
    >
      <TriangleAlert className="w-3 h-3 flex-shrink-0" />
      {t('discover.card.modsAvailable', {
        available: availability.available,
        total: availability.total,
      })}
    </span>
  );
}
