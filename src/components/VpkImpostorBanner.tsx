import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileWarning, X } from 'lucide-react';
import { Button } from './common/ui';
import { showToast } from '../stores/toastStore';
import { useAppStore } from '../stores/appStore';
import {
  canRepairRow,
  impostorHeadline,
  impostorRowMessage,
  impostorSubhead,
  markRepairFailed,
  markRepaired,
  markRepairing,
  mergeImpostorRows,
  repairToastMessage,
  summarizeImpostors,
  type ImpostorRow,
} from '../lib/vpkImpostorNotice';

// Dismissed for this session only, module-scoped like AppUpdateBanner, so
// navigating between pages does not resurrect a notice the user waved off.
let vpkImpostorBannerDismissed = false;

/**
 * Surfaces the startup VPK impostor reconcile (lane A): installed files whose
 * magic bytes say they are archives, not VPKs, so Deadlock never loaded them.
 *
 * Information, not a gate. It is dismissible, it never blocks the app, and it
 * makes both facts plain: a repair extracts the inner VPK and moves the
 * original archive aside (never deletes), and a file that cannot be repaired
 * is left exactly where it is.
 */
export default function VpkImpostorBanner() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ImpostorRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(vpkImpostorBannerDismissed);
  const loadMods = useAppStore((s) => s.loadMods);

  useEffect(() => {
    // The startup reconcile fires once per run. Reading the cache too covers a
    // remount after the event already went out (the banner is only mounted
    // once, but a dev HMR reload would otherwise lose the report).
    const unsubscribe = window.electronAPI.onVpkImpostorsFound((reports) => {
      setRows((current) => mergeImpostorRows(current, reports));
    });
    window.electronAPI
      .getVpkImpostors()
      .then((reports) => {
        if (reports.length > 0) setRows((current) => mergeImpostorRows(current, reports));
      })
      .catch(() => {});
    return unsubscribe;
  }, []);

  const summary = summarizeImpostors(rows);
  if (dismissed || rows.length === 0 || summary.allResolved) return null;

  const headline = impostorHeadline(summary);
  const subhead = impostorSubhead(summary);

  const repair = async (row: ImpostorRow) => {
    setRows((current) => markRepairing(current, row.modId));
    try {
      const result = await window.electronAPI.repairVpkImpostor(row.modId);
      setRows((current) => markRepaired(current, row.modId, result));
      const toast = repairToastMessage(result);
      showToast(t(toast.key, toast.params), { tone: 'success', duration: 9000 });
      // The slot holds different bytes now, so the mod list must re-read it.
      loadMods({ silent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRows((current) => markRepairFailed(current, row.modId, message));
      showToast(t('vpkImpostors.repairFailedToast', { error: message }), {
        tone: 'error',
        duration: 9000,
      });
    }
  };

  return (
    <div className="px-4 pt-3 sm:px-6">
      <div
        role="status"
        aria-live="polite"
        className="overflow-hidden rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-500/20 text-yellow-300">
            <FileWarning className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text-primary">
              {t(headline.key, headline.params)}
            </div>
            <div className="text-xs text-text-secondary">{t(subhead.key, subhead.params)}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((open) => !open)}
            icon={expanded ? ChevronUp : ChevronDown}
            className="flex-shrink-0"
          >
            {expanded ? t('vpkImpostors.hideDetails') : t('vpkImpostors.showDetails')}
          </Button>
          <button
            type="button"
            onClick={() => {
              vpkImpostorBannerDismissed = true;
              setDismissed(true);
            }}
            aria-label={t('vpkImpostors.dismissTitle')}
            title={t('vpkImpostors.dismissTitle')}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-yellow-500/20 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t('vpkImpostors.title')}
            </div>
            {rows.map((row) => {
              const message = impostorRowMessage(row);
              return (
                <div
                  key={row.modId}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-bg-tertiary px-3 py-2"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {row.status === 'repaired' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">
                      <span className="font-semibold">{row.modName}</span>{' '}
                      <span className="font-mono text-xs text-text-secondary">{row.fileName}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-text-secondary">
                      {t(message.key, message.params)}
                    </div>
                  </div>
                  {canRepairRow(row) && (
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => repair(row)}
                      className="flex-shrink-0"
                    >
                      {row.status === 'failed'
                        ? t('vpkImpostors.retryRepair')
                        : t('vpkImpostors.repair')}
                    </Button>
                  )}
                  {row.status === 'repairing' && (
                    <Button variant="warning" size="sm" isLoading disabled className="flex-shrink-0">
                      {t('vpkImpostors.repairing')}
                    </Button>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-text-secondary">{t('vpkImpostors.neverDeletes')}</p>
            {summary.unrepairable > 0 && (
              <p className="text-xs text-text-secondary">{t('vpkImpostors.notRemoved')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
