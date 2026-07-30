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
 * The embedded browser cannot load extensions, so a user who runs uBlock in
 * their real browser is LESS protected inside Grimoire than outside it, purely
 * because they came in through the app. That asymmetry is the whole reason this
 * exists. Blocking is domain-level and on by default; the custom list is the
 * escape hatch, since a short built-in set is not a real filter list.
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
                {t('settings.browser.blockListError', 'Custom list failed to load: ')}
                {stats.error}
              </span>
            ) : (
              t('settings.browser.blockStats', {
                defaultValue: '{{domains}} domains blocked, {{blocked}} requests stopped this session',
                domains: stats?.domains ?? 0,
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
              fallback="Any hosts file or plain list of domains, one per line. The built-in list is deliberately small; point this at a real filter list for full coverage."
            />
          </p>
        </>
      )}
    </div>
  );
}
