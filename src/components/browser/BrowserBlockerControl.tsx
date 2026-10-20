import { useState } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';
import { Button } from '../common/ui';
import { useBrowserFilterStats } from './useBrowserFilterStats';

export function BrowserBlockerControl({ url, reload }: { url: string; reload: () => void }) {
    const { t } = useTranslation();
    const settings = useAppStore(s => s.settings);
    const saveSettings = useAppStore(s => s.saveSettings);
    const stats = useBrowserFilterStats();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    let origin: string | null = null;
    try { const parsed = new URL(url); if (/^https?:$/.test(parsed.protocol)) origin = parsed.origin; } catch { /* Not a page URL. */ }
    const paused = !!origin && !!stats?.exceptions.includes(origin);
    const off = settings?.browserBlockTrackers === false;
    const toggle = async () => {
        if (!origin || !settings) return;
        setBusy(true); setError(null);
        try {
            const previous = stats?.exceptions ?? settings.browserFilterExceptions ?? [];
            await saveSettings({ ...settings, browserFilterExceptions: paused ? previous.filter(site => site !== origin) : [...previous, origin] });
            await window.electronAPI.browser.reloadFilter();
            reload();
        } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
    };
    return (
        <details className="shrink-0">
            <summary className="cursor-pointer rounded-sm px-2 py-1 text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t('browser.blocker.label')} · {t(off ? 'browser.blocker.off' : paused ? 'browser.blocker.paused' : stats?.status === 'active' ? 'browser.blocker.on' : stats?.status === 'fallback' ? 'browser.blocker.fallback' : stats?.status === 'error' ? 'browser.blocker.error' : 'browser.blocker.checking')}
            </summary>
            <div className="mt-2 flex flex-col gap-2 rounded-sm border border-border bg-bg-tertiary p-3 text-xs text-text-secondary">
                <span>{t('browser.blocker.stopped', { count: stats?.blocked ?? 0 })}</span>
                <span className="break-all">{origin}</span>
                <Button variant="secondary" size="sm" icon={paused ? Shield : ShieldOff} disabled={off || !stats || !origin || busy}
                    isLoading={busy} onClick={() => void toggle()}>
                    {t(paused ? 'browser.blocker.resumeSite' : 'browser.blocker.pauseSite')}
                </Button>
                <span>{t('browser.blocker.reloadNote')}</span>
                {(error || stats?.error) && <p role="alert" className="text-state-warning">{error ?? stats?.error}</p>}
            </div>
        </details>
    );
}
