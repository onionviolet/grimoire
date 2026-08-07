import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { X, Download, ArrowDownCircle, RefreshCw, Sparkles, AlertTriangle, Package, Github } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Button } from './common/ui';
import { Modal } from './common/Modal';

type InstallSource = 'managed' | 'appimage' | 'standard' | 'fork';

// Duplicated rather than hoisted to a shared constants module: this repo has
// no shared app-constants file, and SupportSection.tsx's own FORK_REPO is
// local to that file too. Inventing a shared module for two call sites is a
// larger change than this decision warrants. See docs/fork-maintenance.md.
const FORK_ISSUES = 'https://github.com/onionviolet/grimoire/issues';

interface UpdateInfo {
    version: string;
    releaseDate?: string;
    releaseNotes?: string | { version: string; note: string | null }[] | null;
}

interface UpdateStatus {
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    error: string | null;
    progress: number;
    updateInfo: UpdateInfo | null;
}

interface Props {
    onClose: () => void;
}

export default function UpdateModal({ onClose }: Props) {
    const { t } = useTranslation();
    const [appVersion, setAppVersion] = useState('');
    const [status, setStatus] = useState<UpdateStatus | null>(null);
    const [checkedOnce, setCheckedOnce] = useState(false);
    const [installSource, setInstallSource] = useState<InstallSource>('standard');

    useEffect(() => {
        window.electronAPI.updater.getVersion().then(setAppVersion);
        window.electronAPI.updater.getStatus().then(setStatus);
        window.electronAPI.updater.getInstallSource().then(setInstallSource);
        const unsub = window.electronAPI.updater.onStatus((s) => {
            setStatus(s);
            if (!s.checking) setCheckedOnce(true);
        });
        return unsub;
    }, []);

    const handleCheck = async () => {
        setCheckedOnce(false);
        try {
            await window.electronAPI.updater.checkForUpdates();
        } catch (err) {
            console.error('Update check failed:', err);
        }
    };

    const handleDownload = async () => {
        try {
            await window.electronAPI.updater.downloadUpdate();
        } catch (err) {
            console.error('Update download failed:', err);
        }
    };

    const handleInstall = () => {
        window.electronAPI.updater.installUpdate();
    };

    const releaseNotes = status?.updateInfo?.releaseNotes;
    const hasNotes = Array.isArray(releaseNotes) ? releaseNotes.length > 0 : Boolean(releaseNotes);

    return (
        <Modal
            onClose={onClose}
            labelledBy="update-modal-title"
            size="lg"
            panelClassName="max-h-[85vh] flex flex-col overflow-hidden"
        >
                <div className="flex items-start justify-between p-6 border-b border-white/10">
                    <div className="min-w-0">
                        <h2 id="update-modal-title" className="text-xl font-bold text-text-primary">
                            {status?.downloaded
                                ? t('updateModal.titleReady', { version: status.updateInfo?.version })
                                : status?.available
                                    ? t('updateModal.titleAvailable', { version: status.updateInfo?.version })
                                    : t('updateModal.appUpdates')}
                        </h2>
                        <p className="text-sm text-text-secondary mt-1">
                            <Trans
                                i18nKey="updateModal.youReOn"
                                values={{ version: appVersion || '...' }}
                                components={{ ver: <span className="font-mono text-text-primary" /> }}
                            />
                            {status?.updateInfo?.releaseDate && status.available && (
                                <> {t('updateModal.releasedOn', { date: new Date(status.updateInfo.releaseDate).toLocaleDateString() })}</>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-text-secondary hover:text-text-primary flex-shrink-0"
                        aria-label={t('common.actions.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {installSource === 'fork' && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-tertiary border border-white/10 mb-4">
                            <Package className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent" />
                            <div className="text-sm text-text-secondary space-y-2">
                                <p className="text-text-primary font-medium">
                                    {t('updateModal.forkBuild', 'Custom build')}
                                </p>
                                <p>
                                    {t(
                                        'updateModal.forkBuildDetail',
                                        'This fork checks the Onionviolet Grimoire release channel. Updates stay on this fork and will not install an official Grimoire release.'
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                    {installSource === 'managed' && (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-tertiary border border-white/10 mb-4">
                            <Package className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent" />
                            <div className="text-sm text-text-secondary space-y-2">
                                <p className="text-text-primary font-medium">{t('updateModal.managedByPackageManager')}</p>
                                <p>
                                    <Trans
                                        i18nKey="updateModal.managedDistroTools"
                                        components={{
                                            arch: <code className="font-mono text-text-primary" />,
                                            apt: <code className="font-mono text-text-primary" />,
                                        }}
                                    />
                                </p>
                                <p>
                                    <Trans
                                        i18nKey="updateModal.managedAptRepo"
                                        components={{
                                            deb: <code className="font-mono text-text-primary" />,
                                            url: <code className="font-mono text-text-primary" />,
                                        }}
                                    />
                                </p>
                            </div>
                        </div>
                    )}

                    {status?.error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{status.error}</span>
                        </div>
                    )}

                    {status?.downloading && (
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                                <span>{t('updateModal.downloadingUpdate')}</span>
                                <span className="tabular-nums">{Math.round(status.progress)}%</span>
                            </div>
                            <div className="w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-accent h-full rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${status.progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {status?.downloaded && !status.downloading && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-state-success/10 border border-state-success/30 text-state-success text-sm mb-4">
                            <Sparkles className="w-4 h-4 flex-shrink-0" />
                            <span>{t('updateModal.downloadComplete')}</span>
                        </div>
                    )}

                    {!status?.available && !status?.downloaded && !status?.checking && checkedOnce && !status?.error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-state-success/10 border border-state-success/30 text-state-success text-sm mb-4">
                            <Sparkles className="w-4 h-4 flex-shrink-0" />
                            <span>{t('updateModal.latestVersion')}</span>
                        </div>
                    )}

                    {hasNotes ? (
                        <>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                                {t('updateModal.whatsNew')}
                                {Array.isArray(releaseNotes) && releaseNotes.length > 1 && (
                                    <span className="ml-2 normal-case tracking-normal text-text-secondary/70">
                                        {t('updateModal.releasesCount', { count: releaseNotes.length })}
                                    </span>
                                )}
                            </h3>
                            {typeof releaseNotes === 'string' ? (
                                <div
                                    className="release-notes"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(releaseNotes) }}
                                />
                            ) : (
                                <div className="space-y-5 divide-y divide-white/5">
                                    {(releaseNotes as { version: string; note: string | null }[]).map((note, idx) => (
                                        <div key={`${note.version}-${idx}`} className={idx > 0 ? 'pt-5' : ''}>
                                            <h4 className="font-semibold text-accent mb-2">v{note.version}</h4>
                                            {note.note ? (
                                                <div
                                                    className="release-notes"
                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.note) }}
                                                />
                                            ) : (
                                                <p className="text-xs text-text-secondary italic">{t('updateModal.noReleaseNotesForThisVersion')}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : installSource !== 'managed' && !status?.available && !status?.checking && (
                        <p className="text-sm text-text-secondary">
                            {t('updateModal.deliveredViaGithub')}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 p-6 border-t border-white/10">
                    <a
                        href={FORK_ISSUES}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={t('settings.support.githubIssuesTitle')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-border bg-bg-tertiary/40 text-text-primary hover:bg-bg-tertiary/70 hover:border-text-secondary/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/60 whitespace-nowrap"
                    >
                        <Github className="w-4 h-4" aria-hidden="true" />
                        {t('settings.support.githubIssues')}
                    </a>
                    <div className="flex items-center gap-3">
                        <Button onClick={onClose} variant="secondary">
                            {t('common.actions.close')}
                        </Button>
                        {installSource === 'managed' ? null : status?.downloaded ? (
                            <Button onClick={handleInstall} icon={ArrowDownCircle}>
                                {t('settings.updates.installRestart')}
                            </Button>
                        ) : status?.available && !status.downloading ? (
                            <Button onClick={handleDownload} icon={Download}>
                                {t('settings.updates.downloadUpdate')}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleCheck}
                                disabled={status?.checking || status?.downloading}
                                isLoading={status?.checking}
                                icon={RefreshCw}
                            >
                                {status?.checking ? t('common.status.checking') : t('settings.updates.checkForUpdates')}
                            </Button>
                        )}
                    </div>
                </div>
        </Modal>
    );
}
