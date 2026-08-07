import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Check, Copy, FileText, Github, Heart, LifeBuoy } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { buildDiagnosticReport } from '../../../lib/api';
import { Button, Card } from '../../common/ui';
import { Textarea } from '../../common/forms';
import Tx from '../../translation/Tx';

// Every outward link this section can offer, split by who it actually belongs
// to. The Ko-fi jar came with the project and still points at the original
// author's tip jar, so nothing here may imply the fork is the beneficiary.
// See issue #20.
const UPSTREAM_REPO = 'https://github.com/Slush97/grimoire';
const UPSTREAM_SITE = 'https://grimoiremods.com';
const FORK_REPO = 'https://github.com/onionviolet/grimoire';
const FORK_LICENSE = 'https://github.com/onionviolet/grimoire/blob/main/LICENSE';

// Where to reach us, plus the sanitized diagnostic report users paste into a
// GitHub issue.
export default function SupportSection() {
  const { t } = useTranslation();
  const { settings, saveSettings } = useAppStore();

  const [bugDescription, setBugDescription] = useState('');
  const [bugReportText, setBugReportText] = useState<string | null>(null);
  const [isBuildingReport, setIsBuildingReport] = useState(false);
  const [bugReportError, setBugReportError] = useState<string | null>(null);
  const [bugCopyState, setBugCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [includeFullLog, setIncludeFullLog] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // So a user can tell from the app itself which project and which build they
  // are running, without going to GitHub to work it out.
  useEffect(() => {
    window.electronAPI.updater.getVersion().then(setAppVersion);
  }, []);

  const handleGenerateBugReport = async () => {
    setIsBuildingReport(true);
    setBugReportError(null);
    setBugCopyState('idle');
    try {
      const text = await buildDiagnosticReport(bugDescription, { includeFullLog });
      setBugReportText(text);
    } catch (err) {
      setBugReportError(t('settings.support.reportBuildFailed', { error: String(err) }));
    } finally {
      setIsBuildingReport(false);
    }
  };

  const handleCopyBugReport = async () => {
    if (!bugReportText) return;
    try {
      await navigator.clipboard.writeText(bugReportText);
      setBugCopyState('copied');
      window.setTimeout(() => setBugCopyState('idle'), 2000);
    } catch {
      setBugCopyState('failed');
    }
  };

  // Prefill the GitHub "new issue" URL with the user's description as the
  // title and a stub body that tells them to paste the diagnostic. We can't
  // jam the full sanitized report into the URL (GitHub caps issue-create
  // URLs around 8 KB and our log tail is up to 256 KB), so the contract is:
  // "copy the report, then click the button, then paste."
  const githubIssueUrl = useMemo(() => {
    const firstLine = bugDescription.split('\n').find((l) => l.trim().length > 0) ?? '';
    const title = firstLine.trim().slice(0, 100) || t('settings.support.bugReportTitle');
    const body = [
      bugDescription.trim() || '<!-- describe what happened -->',
      '',
      '---',
      '',
      'Diagnostic report (copied from Grimoire → Settings → Share a bug report):',
      '',
      '```',
      'paste the report here',
      '```',
    ].join('\n');
    const q = `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    return `${FORK_REPO}/issues/new${q}`;
  }, [bugDescription, t]);

  return (
    <Card title={<Tx k="settings.sections.support" fallback="Support" />} icon={LifeBuoy}>
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <Tx k="settings.support.aboutTitle" fallback="About Grimoire" />
          </h4>
          <p className="text-sm text-text-secondary">
            <Tx
              k="settings.support.forkStatement"
              fallback="Grimoire was created by Slush97. This is onionviolet's independent fork: a separate build with its own features and releases, not affiliated with or endorsed by the original project. Both are MIT licensed."
            />
          </p>
          <p className="text-xs text-text-secondary/80">
            {appVersion
              ? t('settings.support.runningFork', { version: appVersion })
              : t('settings.support.runningForkNoVersion')}
            {' '}
            {t('settings.support.engineCredit')}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <a
              href={UPSTREAM_REPO}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              <Tx k="settings.support.originalProject" fallback="Original project by Slush97" />
            </a>
            <a
              href={UPSTREAM_SITE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              <Tx k="settings.support.originalSite" fallback="grimoiremods.com" />
            </a>
            <a
              href={FORK_REPO}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              <Tx k="settings.support.forkRepo" fallback="This fork on GitHub" />
            </a>
            <a
              href={FORK_LICENSE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              <Tx k="settings.support.license" fallback="MIT license" />
            </a>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">
            <Tx
              k="settings.support.forkChannels"
              fallback="Found a bug or have a feature request? File it on this fork's GitHub."
            />
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={`${FORK_REPO}/issues`}
              target="_blank"
              rel="noreferrer noopener"
              title={t('settings.support.githubIssuesTitle')}
              className="inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium border border-border bg-bg-tertiary/40 text-text-primary hover:bg-bg-tertiary/70 hover:border-text-secondary/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/60 whitespace-nowrap"
            >
              <Github className="w-4 h-4" aria-hidden="true" />
              <Tx k="settings.support.githubIssues" fallback="GitHub Issues" />
            </a>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Bug className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              <Tx k="settings.support.shareBugReport" fallback="Share a bug report" />
            </h4>
            <p className="text-xs text-text-secondary mt-1">
              <Tx
                k="settings.support.bugReportShareDescription"
                fallback="Describe what went wrong, generate a sanitized report, then paste it into a GitHub issue. The report bundles app and OS info plus the tail of your log; home paths, Steam IDs, bearer tokens, and emails are stripped before it leaves the app."
              />
            </p>
          </div>

          <Textarea
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder={t('settings.support.bugPlaceholder')}
            rows={3}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              onClick={handleGenerateBugReport}
              isLoading={isBuildingReport}
              size="sm"
              variant="secondary"
              icon={FileText}
            >
              {bugReportText ? (
                <Tx k="settings.support.regenerateReport" fallback="Regenerate report" />
              ) : (
                <Tx k="settings.support.generateReport" fallback="Generate report" />
              )}
            </Button>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFullLog}
                onChange={(e) => setIncludeFullLog(e.target.checked)}
                className="h-3.5 w-3.5 rounded-sm border border-white/20 bg-bg-tertiary accent-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <Tx
                k="settings.support.includeFullLog"
                fallback="Include full log (up to 5 MB; Discord auto-attaches as a file)"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings?.verboseModTrace ?? false}
                onChange={(e) => settings && saveSettings({ ...settings, verboseModTrace: e.target.checked })}
                className="h-3.5 w-3.5 rounded-sm border border-white/20 bg-bg-tertiary accent-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <Tx
                k="settings.support.verboseModTrace"
                fallback="Verbose mod logging (traces enable/disable/scan to the log; turn off when done)"
              />
            </label>
          </div>

          {bugReportError && (
            <p className="text-xs text-state-danger break-all">{bugReportError}</p>
          )}

          {bugReportText && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-[11px] text-text-secondary/70">
                <Tx
                  k="settings.support.reviewBeforeSharing"
                  fallback="Review before sharing. Nothing is sent automatically."
                />
              </p>
              <textarea
                value={bugReportText}
                readOnly
                rows={10}
                className="w-full px-3 py-2 text-[11px] font-mono leading-relaxed bg-bg-tertiary/60 border border-white/5 rounded-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleCopyBugReport}
                  size="sm"
                  icon={bugCopyState === 'copied' ? Check : Copy}
                >
                  {bugCopyState === 'copied'
                    ? <Tx k="common.status.copied" fallback="Copied" />
                    : bugCopyState === 'failed'
                      ? <Tx k="settings.support.copyFailed" fallback="Copy failed: select and Ctrl+C" />
                      : <Tx k="settings.support.copyReport" fallback="Copy report" />}
                </Button>
                <a
                  href={githubIssueUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium border border-border bg-bg-tertiary/40 text-text-primary hover:bg-bg-tertiary/70 hover:border-text-secondary/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/60"
                >
                  <Github className="w-4 h-4" aria-hidden="true" />
                  <Tx k="settings.support.openGithubIssue" fallback="Open GitHub issue" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
