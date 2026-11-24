import { FilterDivider } from '../../common/FilteredContent';
import { useEffect, useState } from 'react';
import { Download, ExternalLink, SlidersHorizontal, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../stores/appStore';
import { Button, Card, Toggle } from '../../common/ui';
import Tx from '../../translation/Tx';
import type { AppSettings } from '../../../types/mod';
import type { ForgeBridgeStatus } from '../../../types/electron';
import { IGNORE_OVERLAP_SETTING_ID } from '../settingsHighlight';
import { getActiveDeadlockPath } from '../../../lib/appSettings';
import DisabledVpkCompression from '../DisabledVpkCompression';

// General preferences, mod installation and updates, and external integrations.
export default function PreferencesSection() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const { t } = useTranslation();
  const [forgeStatus, setForgeStatus] = useState<ForgeBridgeStatus | null>(null);

  const update = async (patch: Partial<AppSettings>) => {
    if (settings) {
      await saveSettings({ ...settings, ...patch });
    }
  };

  // Reflect whether the bridge actually came up. The port is picked at bind
  // time from a small range, so showing it is the only way a user can tell
  // which one to expect, and it confirms the toggle really took effect.
  const forgeEnabled = settings?.forgeLocalInstallEnabled ?? false;
  const gamePath = settings ? getActiveDeadlockPath(settings) : undefined;
  useEffect(() => {
    if (!forgeEnabled) return;
    let cancelled = false;
    const refresh = () => {
      void window.electronAPI.getForgeBridgeStatus().then(status => {
        if (!cancelled) setForgeStatus(status);
      }, () => { if (!cancelled) setForgeStatus(null); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [forgeEnabled]);

  return (
    <>
      <Card id="settings-preferences-settings-sections-preferences-card" title={<Tx k="settings.sections.preferences" fallback="Preferences" />} icon={SlidersHorizontal}>
        <div className="space-y-6">
          <Toggle id="settings-preferences-taskbar-game-indicator-toggle"
            checked={settings?.taskbarGameIndicatorEnabled ?? false}
            disabled={window.electronAPI.platform !== 'win32'}
            onChange={(checked) => update({ taskbarGameIndicatorEnabled: checked })}
            label={t('settings.preferences.taskbarGameIndicator')}
            description={t('settings.toggles.taskbarGameIndicator')}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-expandLocker-toggle"
            checked={settings?.lockerCardsExpandedByDefault ?? false}
            onChange={(checked) => update({ lockerCardsExpandedByDefault: checked })}
            label={<Tx k="settings.preferences.expandLocker" fallback="Expand Locker cards by default" />}
            description={<Tx k="settings.toggles.expandLocker" fallback="Start Locker list view with hero cards expanded." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-groupClickOpensDetails-toggle"
            checked={settings?.installedGroupClickOpensDetails ?? false}
            onChange={(checked) => update({ installedGroupClickOpensDetails: checked })}
            label={t('settings.preferences.groupClickOpensDetails')}
            description={t('settings.toggles.groupClickOpensDetails')}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-confirmProfileUpdate-toggle"
            checked={settings?.confirmProfileUpdate ?? true}
            onChange={(checked) => update({ confirmProfileUpdate: checked })}
            label={<Tx k="settings.preferences.confirmProfileUpdate" fallback="Confirm before updating a profile" />}
            description={<Tx k="settings.toggles.confirmProfileUpdate" fallback="Confirm before overwriting a profile's saved mods. Off overwrites immediately." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-promptOptionalRequirements-toggle"
            checked={settings?.promptOptionalRequirements ?? false}
            onChange={(checked) => update({ promptOptionalRequirements: checked })}
            label={t('settings.preferences.promptOptionalRequirements')}
            description={t('settings.toggles.promptOptionalRequirements')}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-cycleTagFilters-toggle"
            checked={settings?.cycleTagFilters ?? false}
            onChange={(checked) => update({ cycleTagFilters: checked })}
            label={t('settings.preferences.cycleTagFilters')}
            description={t('settings.toggles.cycleTagFilters')}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id={IGNORE_OVERLAP_SETTING_ID}
            checked={settings?.ignoreConflictsByDefault ?? false}
            onChange={(checked) => update({ ignoreConflictsByDefault: checked })}
            label={<Tx k="settings.preferences.ignoreOverlap" fallback="Ignore overlap by default" />}
            description={<Tx k="settings.toggles.ignoreOverlap" fallback="Hide every overlap from the Overlap page. Off shows them." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-keepModBackups-toggle"
            checked={settings?.keepModBackups ?? false}
            onChange={(checked) => update({ keepModBackups: checked })}
            label={<Tx k="settings.preferences.keepModBackups" fallback="Keep removed mod files for 24 hours" />}
            description={<Tx k="settings.toggles.keepModBackups" fallback="Back up updated, replaced, and deleted mod files. Restore them as disabled files from a mod's Backups menu. Backups older than 24 hours are removed at startup. Turning this off stops new backups." />}
          />
        </div>
      </Card>

      <Card id="settings-preferences-settings-sections-installationAndUpdates-card" title={t('settings.sections.installationAndUpdates')} icon={Download}>
        <div className="space-y-6">
          <Toggle id="settings-preferences-settings-preferences-switchVariants-toggle"
            checked={settings?.autoDisableSiblingVariants ?? true}
            onChange={(checked) => update({ autoDisableSiblingVariants: checked })}
            label={<Tx k="settings.preferences.switchVariants" fallback="Switch variants instead of stacking them" />}
            description={<Tx k="settings.toggles.switchVariants" fallback="Installing a new variant disables the old one. Off keeps both active. Updates always replace the old file." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-enableAfterDownload-toggle"
            checked={settings?.autoEnableDownloads ?? false}
            onChange={(checked) => update({ autoEnableDownloads: checked })}
            label={<Tx k="settings.preferences.enableAfterDownload" fallback="Enable mods after download" />}
            description={<Tx k="settings.toggles.enableAfterDownload" fallback="Enable mods as soon as they finish downloading. Stays disabled if no slot is free." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-autoMatchRemainingFiles-toggle"
            checked={settings?.autoMatchRemainingFiles ?? true}
            onChange={(checked) => update({ autoMatchRemainingFiles: checked })}
            label={<Tx k="settings.preferences.autoMatchRemainingFiles" fallback="Match remaining update files automatically" />}
            description={<Tx k="settings.toggles.autoMatchRemainingFiles" fallback="After matching names and descriptions, pair one unmatched installed file with one remaining new upload. This can replace a different variant. Turn off to choose these replacements yourself." />}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-skipModReplacementConfirmation-toggle"
            checked={settings?.skipModReplacementConfirmation ?? false}
            onChange={(checked) => update({ skipModReplacementConfirmation: checked })}
            label={t('settings.preferences.skipModReplacementConfirmation')}
            description={t('settings.toggles.skipModReplacementConfirmation')}
          />

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-swapManualReplacementActions-toggle"
            checked={settings?.swapManualReplacementActions ?? true}
            onChange={(checked) => update({ swapManualReplacementActions: checked })}
            label={t('settings.preferences.swapManualReplacementActions')}
            description={t('settings.toggles.swapManualReplacementActions')}
          />
          {window.electronAPI.platform === 'win32' && gamePath && (
            <>
              <FilterDivider className="h-px bg-hl/5" />
              <DisabledVpkCompression key={gamePath} gamePath={gamePath} />
            </>
          )}
        </div>
      </Card>

      <Card id="settings-preferences-settings-sections-integrations-card" title={t('settings.sections.integrations')} icon={Wrench}>
        <div className="space-y-6">
          <Toggle id="settings-preferences-forge-settings-toggleLabel-toggle"
            checked={forgeEnabled}
            onChange={(checked) => update({ forgeLocalInstallEnabled: checked })}
            label={<Tx k="forge.settings.toggleLabel" fallback="Allow DeadlockForge 1-click installs" />}
            description={<Tx
              k="forge.settings.description"
              fallback="Let deadlockforge.net send freshly forged mods straight to Grimoire, so you do not have to download and move the file yourself. Grimoire listens only on your own machine, accepts requests only from deadlockforge.net, and always asks before installing anything."
            />}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={ExternalLink}
              onClick={() => window.open('https://deadlockforge.net/texture/', '_blank')}>
              {t('forge.settings.openTextureForge')}
            </Button>
            {forgeEnabled && forgeStatus && <span role="status" className="text-xs text-text-secondary">
              {forgeStatus.listening && forgeStatus.port !== null
                ? t(forgeStatus.receivedForgeProbe ? 'forge.settings.probeReceived' : 'forge.settings.waitingForForge', { port: forgeStatus.port })
                : t('forge.settings.notListening')}
            </span>}
          </div>

          <FilterDivider className="h-px bg-hl/5" />

          <Toggle id="settings-preferences-settings-preferences-discordRpc-toggle"
            checked={settings?.discordRpcEnabled ?? false}
            onChange={(checked) => update({ discordRpcEnabled: checked })}
            label={<Tx k="settings.preferences.discordRpc" fallback="Discord Rich Presence" />}
            description={<Tx k="settings.toggles.discordRpc" fallback="Show your current Grimoire activity on your Discord profile. Talks only to your local Discord app and sends nothing to Grimoire." />}
          />
        </div>
      </Card>
    </>
  );
}
