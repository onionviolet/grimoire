import { useTranslation } from 'react-i18next';
import { CloudOff, ServerCrash, RefreshCw } from 'lucide-react';
import { Button } from '../common/ui';
import { EmptyState } from '../common/PageComponents';
import type { SocialErrorKind } from './socialErrors';

interface SocialStateNoticeProps {
  kind: Exclude<SocialErrorKind, 'other'>;
  onRetry: () => void;
  /** Inline mode: a compact banner instead of a full-height empty state, for
   *  surfaces that already have content on screen (the owner's list, the
   *  detail rail). */
  inline?: boolean;
}

/**
 * Offline and service-busy are different failures and get different copy.
 * Neither is the generic `discover.error.*` banner, which reads as "Grimoire
 * broke" and is exactly the wrong impression: nothing local is affected in
 * either case, and both are worth retrying (one later, one now).
 */
export default function SocialStateNotice({ kind, onRetry, inline = false }: SocialStateNoticeProps) {
  const { t } = useTranslation();

  const offline = kind === 'offline';
  const icon = offline ? CloudOff : ServerCrash;
  const title = offline ? t('discover.offline.title') : t('discover.busy.title');
  const description = offline ? t('discover.offline.description') : t('discover.busy.description');
  const retryLabel = offline ? t('discover.offline.retry') : t('discover.busy.retry');

  if (inline) {
    const Icon = icon;
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-md p-3 flex items-start gap-2.5">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-text-secondary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-text-primary">{title}</div>
          <div className="text-xs text-text-secondary mt-0.5">{description}</div>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    );
  }

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        <Button icon={RefreshCw} onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  );
}
