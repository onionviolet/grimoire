import { useTranslation } from 'react-i18next';
import type { EmbeddedClipEventMetadata } from '../../types/abilityEvents';

/** Read-only animation metadata, kept separate from unverified cast effects. */
export function AbilityEventDetails({ metadata }: { metadata?: EmbeddedClipEventMetadata | null }) {
  const { t } = useTranslation();
  if (metadata?.status !== 'available') return null;
  return <details className="mt-3 text-xs text-text-secondary">
    <summary className="cursor-pointer text-text-primary">{t('locker.abilityPreview.eventsTitle', { count: metadata.events.length })}</summary>
    <p className="my-2">{t('locker.abilityPreview.eventsHint')}</p>
    {metadata.events.length === 0 ? <p>{t('locker.abilityPreview.noEvents')}</p> : <table className="w-full text-left">
      <thead><tr>
        <th className="py-1 pr-4 font-normal">{t('locker.abilityPreview.eventTime')}</th>
        <th className="py-1 font-normal">{t('locker.abilityPreview.eventName')}</th>
      </tr></thead>
      <tbody>{metadata.events.map((event, index) => <tr key={index}>
        <td className="py-1 pr-4 tabular-nums">{event.timeSeconds === null ? t('locker.abilityPreview.eventTimeUnknown') : t('locker.abilityPreview.eventSeconds', { time: event.timeSeconds.toFixed(3) })}</td>
        <td className="break-all py-1">{event.name}</td>
      </tr>)}</tbody>
    </table>}
  </details>;
}
