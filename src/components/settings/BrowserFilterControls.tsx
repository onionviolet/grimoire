import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { Button, Toggle } from '../common/ui';
import Tx from '../translation/Tx';
import type { BrowserFilterStats } from '../../types/foundry';


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
  const [stats, setStats] = useState<BrowserFilterStats | null>(null);

  const blocking = settings?.browserBlockTrackers !== false;
  const listPath = settings?.browserBlockListPath ?? '';

  // Re-read after any change to the toggle or the list, because the main
  // process rebuilds the set on save and the entry count is the only feedback
  // that a custom list actually loaded.
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.browser
      .filterStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStats(null));
    return () => {
      cancelled = true;
    };
  }, [blocking, listPath]);

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

      {blocking && (
        <>
          <p className="text-xs text-text-secondary">
            {stats?.error ? (
              <span className="text-warning">
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
          {listPath && <p className="break-all font-mono text-[11px] text-text-secondary">{listPath}</p>}
          <p className="text-[11px] text-text-secondary/70">
            <Tx
              k="settings.browser.blockListHint"
              fallback="Any hosts file, plain domain list, or uBlock Origin / EasyList filter list, one entry per line. The app bundles real filter lists and refreshes them with each release."
            />
          </p>
        </>
      )}
    </div>
  );
}
