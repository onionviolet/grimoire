import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Beaker, FolderOpen, RefreshCw, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { Button, Card, Toggle } from '../common/ui';
import Tx from '../translation/Tx';
import type { EngineInfo } from '../../types/foundry';

/**
 * Fork-build controls. Only meaningful in a locally built Grimoire, so the card
 * renders nothing on stock installs rather than showing dead switches: the
 * engine override and the patch flags both describe things a stock build does
 * not have.
 */
export default function ForkBuildCard() {
  const { settings, saveSettings } = useAppStore();
  const [isFork, setIsFork] = useState(false);

  useEffect(() => {
    window.electronAPI.updater
      .getInstallSource()
      .then((source) => setIsFork(source === 'fork'))
      .catch(() => setIsFork(false));
  }, []);

  if (!isFork) return null;

  return (
    <Card
      title={<Tx k="settings.sections.forkBuild" fallback="Custom build" />}
      description={<Tx k="settings.forkBuild.description" fallback="This build carries patches that are not in the official release. Switch them off to compare against stock behaviour without rebuilding." />}
      icon={Beaker}
    >
      <div className="space-y-4">
        <EngineSwitcher />

        <div className="h-px bg-white/5" />

        <Toggle
          checked={settings?.forkGlobalSounds !== false}
          onChange={(checked) => settings && saveSettings({ ...settings, forkGlobalSounds: checked })}
          label={<Tx k="settings.fork.globalSounds" fallback="Global sounds tab" />}
          description={<Tx k="settings.fork.globalSoundsDetail" fallback="Browse and swap UI, music, ambience, NPC and shop-item sounds, not just hero ones." />}
        />

        <Toggle
          checked={settings?.forkPoolCycling !== false}
          onChange={(checked) => settings && saveSettings({ ...settings, forkPoolCycling: checked })}
          label={<Tx k="settings.fork.poolCycling" fallback="Cycle randomizer pools" />}
          description={<Tx k="settings.fork.poolCyclingDetail" fallback="Auditioning an event with several clips walks the whole pool instead of replaying the first one." />}
        />
      </div>
    </Card>
  );
}

/**
 * Engine switcher: point this build at a different `vpkmerge` binary.
 *
 * The engine is a sidecar process, so swapping it needs no rebuild of the app,
 * but until `settings.vpkmergeBinaryPath` existed a PACKAGED build had no way
 * to use anything but the binary shipped inside it ($VPKMERGE_BINARY and the
 * sibling-build probe are both gated on !app.isPackaged).
 *
 * The reported version comes from running the resolved binary through the same
 * resolver the real calls use, not from re-deriving the path here. Anything
 * else could report one engine while a mod was built by another, which defeats
 * the point of being able to switch.
 */
function EngineSwitcher() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [busy, setBusy] = useState(false);

  // Async, and only ever sets state from the promise callbacks, so the effect
  // itself never calls setState synchronously (react-hooks/set-state-in-effect).
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setInfo(await window.electronAPI.foundry.engineInfo());
    } catch {
      setInfo(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const overridePath = settings?.vpkmergeBinaryPath;
  useEffect(() => {
    void refresh();
  }, [refresh, overridePath]);

  const pick = async () => {
    // showOpenDialog returns the chosen path (or null), not Electron's raw
    // result object. The engine is extensionless on macOS/Linux, so a filter is
    // only useful on Windows; elsewhere it would hide the very file wanted.
    const chosen = await window.electronAPI.showOpenDialog(
      navigator.userAgent.includes('Windows')
        ? { title: t('settings.fork.engineChoose', 'Choose binary'), filters: [{ name: 'vpkmerge', extensions: ['exe'] }] }
        : { title: t('settings.fork.engineChoose', 'Choose binary') }
    );
    if (chosen && settings) await saveSettings({ ...settings, vpkmergeBinaryPath: chosen });
  };

  const clear = async () => {
    if (settings) await saveSettings({ ...settings, vpkmergeBinaryPath: '' });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">
        <Tx k="settings.fork.engine" fallback="Engine (vpkmerge)" />
      </p>
      <p className="text-xs text-text-secondary">
        <Tx
          k="settings.fork.engineDetail"
          fallback="The sidecar that reads your game files and builds mods. Point this at a locally built binary to test engine changes without repackaging the app."
        />
      </p>

      <div className="rounded-sm border border-border bg-bg-tertiary p-3 text-xs">
        {busy ? (
          <span className="text-text-secondary">
            <Tx k="settings.fork.engineChecking" fallback="Checking engine..." />
          </span>
        ) : info?.error ? (
          <span className="text-warning">{info.error}</span>
        ) : (
          <>
            <div className="text-text-primary">
              {info?.version ?? t('settings.fork.engineUnknown', 'Unknown version')}
            </div>
            <div className="mt-1 break-all font-mono text-text-secondary">{info?.path ?? '-'}</div>
            <div className="mt-1 text-text-secondary">
              {info?.bundled
                ? t('settings.fork.engineBundled', 'Bundled with this build')
                : t('settings.fork.engineCustom', 'Custom path (overrides the bundled engine)')}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={pick} variant="secondary" icon={FolderOpen}>
          <Tx k="settings.fork.engineChoose" fallback="Choose binary" />
        </Button>
        {settings?.vpkmergeBinaryPath ? (
          <Button onClick={clear} variant="secondary" icon={X}>
            <Tx k="settings.fork.engineReset" fallback="Use bundled" />
          </Button>
        ) : null}
        <Button onClick={() => void refresh()} variant="secondary" icon={RefreshCw}>
          <Tx k="settings.fork.engineRecheck" fallback="Re-check" />
        </Button>
      </div>
    </div>
  );
}
