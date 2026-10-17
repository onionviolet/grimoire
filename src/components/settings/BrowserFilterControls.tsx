import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, X, RotateCw, Download } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { Button, Toggle } from '../common/ui';
import Tx from '../translation/Tx';
import { useBrowserFilterStats } from '../browser/useBrowserFilterStats';
import type { BrowserFilterUpdateReview } from '../../types/browserFilter';


/**
 * Ad/tracker blocking for the in-app browser.
 *
 * Electron can load some unpacked extensions, but not uBlock Origin: the full
 * extension needs extension APIs Electron does not implement, and uBO Lite
 * (MV3) is built entirely on declarativeNetRequest, which Electron does not
 * implement at all. So a user who runs uBlock in their real browser would
 * otherwise be LESS protected inside Grimoire than outside it. That asymmetry
 * is the whole reason this exists. The Ghostery engine is uBO/EasyList
 * compatible, so the app bundles real filter lists (EasyList, EasyPrivacy, uBO
 * filters) at build time and ships them with every release; the custom list is
 * the escape hatch for anything extra.
 *
 * Permission denial (camera, mic, location, notifications) is not exposed here
 * on purpose: it is a floor, not a preference, and there is no UI in an embedded
 * frame in which a user could sensibly evaluate such a prompt.
 */
export default function BrowserFilterControls() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const stats = useBrowserFilterStats();
  const [review, setReview] = useState<BrowserFilterUpdateReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocking = settings?.browserBlockTrackers !== false;
  const listPath = settings?.browserBlockListPath ?? '';
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  };

  const pickList = async () => {
    const chosen = await window.electronAPI.showOpenDialog({
      title: t('settings.browser.blockListChoose', 'Choose a blocklist file'),
    });
    if (chosen && settings) await saveSettings({ ...settings, browserBlockListPath: chosen });
  };

  return (
    <div className="space-y-3 rounded-sm border border-border bg-bg-tertiary/50 p-3">
      <Toggle
        checked={blocking}
        onChange={(checked) => settings && saveSettings({ ...settings, browserBlockTrackers: checked })}
        label={<Tx k="settings.browser.blockTrackers" fallback="Block ads and trackers" />}
        description={
          <Tx
            k="settings.browser.blockTrackersDetail"
            fallback="Cancels requests to known ad and tracker domains inside the in-app browser. The page still loads; the ad request never leaves your machine."
          />
        }
      />

      <p role="status" className="text-xs text-text-secondary">
        {t('settings.browser.engineStatus', { status: t(({ off: 'settings.browser.status.off', loading: 'settings.browser.status.loading', active: 'settings.browser.status.active', fallback: 'settings.browser.status.fallback', error: 'settings.browser.status.error' })[stats?.status ?? 'loading']) })}
      </p>
      {stats?.list && <p className="text-xs text-text-secondary">
        {t('settings.browser.listVersion', { revision: stats.list.revision.slice(0, 12), date: stats.list.fetchedAt ? new Date(stats.list.fetchedAt).toLocaleDateString() : t('settings.browser.unknownDate') })}
      </p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Download} disabled={busy} isLoading={busy}
          onClick={() => void perform(async () => setReview(await window.electronAPI.browser.checkFilterUpdate()))}>
          <Tx k="settings.browser.checkUpdate" />
        </Button>
        {listPath && <Button variant="secondary" size="sm" icon={RotateCw} disabled={busy}
          onClick={() => void perform(() => window.electronAPI.browser.reloadFilter())}><Tx k="settings.browser.reloadList" /></Button>}
      </div>
      {review && <div className="space-y-2 rounded-sm border border-border p-3 text-xs text-text-secondary">
        <p>{t('settings.browser.updateReview', { revision: review.revision.slice(0, 12), network: review.networkFilters, cosmetic: review.cosmeticFilters, current: review.currentFilters })}</p>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void perform(async () => {
          await window.electronAPI.browser.applyFilterUpdate(review.reviewId); setReview(null);
        })}><Tx k="settings.browser.applyUpdate" /></Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setReview(null)}><Tx k="settings.browser.dismissUpdate" /></Button>
      </div>}
      {error && <p role="alert" className="text-xs text-state-warning">{error}</p>}
      {blocking && stats && listPath && <p className="text-xs text-text-secondary">
        {t('settings.browser.customReport', { accepted: stats.custom.accepted, rejected: stats.custom.rejected, lines: stats.custom.rejectedLines.join(', ') })}
      </p>}
      {!!stats?.exceptions.length && <div className="space-y-2 text-xs text-text-secondary">
        <p><Tx k="settings.browser.exceptions" /></p>
        {stats.exceptions.map(site => <div key={site} className="flex flex-wrap items-center gap-2">
          <span className="break-all">{site}</span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => settings && void perform(async () => {
            await saveSettings({ ...settings, browserFilterExceptions: stats.exceptions.filter(value => value !== site) });
            await window.electronAPI.browser.reloadFilter();
          })}><Tx k="settings.browser.removeException" /></Button>
        </div>)}
      </div>}
      <p className="text-xs text-text-secondary"><Tx k="settings.browser.reloadPages" /></p>
      {blocking && (
        <>
          <p className="text-xs text-text-secondary">
            {stats?.error ? (
              <span className="text-state-warning">
                {t('settings.browser.blockListError', 'Filter lists failed to load: ')}
                {stats.error}
              </span>
            ) : (
              t('settings.browser.blockStats', {
                defaultValue: '{{filters}} filter rules active, {{blocked}} requests stopped this session',
                filters: stats?.filters ?? 0,
                blocked: stats?.blocked ?? 0,
              })
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={pickList} variant="secondary" icon={FolderOpen}>
              <Tx k="settings.browser.blockListChoose" fallback="Choose a blocklist file" />
            </Button>
            {listPath && (
              <Button
                onClick={() => settings && saveSettings({ ...settings, browserBlockListPath: '' })}
                variant="secondary"
                icon={X}
              >
                <Tx k="settings.browser.blockListClear" fallback="Use built-in list only" />
              </Button>
            )}
          </div>
          {listPath && <p className="break-all font-mono text-2xs text-text-secondary">{listPath}</p>}
          <p className="text-2xs text-text-secondary/70">
            <Tx
              k="settings.browser.blockListHint"
              fallback="Hosts files and supported uBlock Origin / EasyList rules are accepted. Updates are checked only when you ask."
            />
          </p>
        </>
      )}
    </div>
  );
}
