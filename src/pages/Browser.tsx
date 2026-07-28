// In-app web browser: reach the mod ecosystem without leaving Grimoire.
//
// Everything renders inside a <webview>, which is an out-of-process guest with
// its own session partition. The guest's security settings are NOT trusted from
// here: `will-attach-webview` in the main process strips the preload, forces
// sandbox/contextIsolation, pins the partition and rejects any non-http(s) src.
// This file only drives navigation; it cannot widen the guest's privileges.
//
// Deliberately not a full browser. No tabs, no downloads (the main process
// hands those to the real browser), no extensions. It is a shortcut to the
// handful of sites that matter while modding.

import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, Globe, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/appStore';
import { EmptyState } from '../components/common/PageComponents';
import Tx from '../components/translation/Tx';

/** Shortcut destinations. These are a deliberately small set of useful and
 *  community-loved Deadlock stops, rather than a general bookmark manager. */
const SHORTCUTS: { label: string; url: string }[] = [
    { label: 'GameBanana', url: 'https://gamebanana.com/games/20948' },
    { label: 'Deadlock Forge', url: 'https://deadlockforge.net/' },
    { label: 'Deadlock Wiki', url: 'https://deadlocked.wiki/' },
    { label: 'deadlock-api', url: 'https://deadlock-api.com/' },
    { label: 'Deadlock.io', url: 'https://deadlock.io/' },
    { label: 'Deadlocker', url: 'https://www.deadlocker.gg/' },
    { label: 'r/DeadlockTheGame', url: 'https://www.reddit.com/r/DeadlockTheGame/' },
    { label: 'Deadlock Daily (memes)', url: 'https://www.deadlockdaily.com/' },
    { label: 'Goonlock (18+)', url: 'https://goonlock.com/' },
];

const HOME_URL = SHORTCUTS[0].url;

/** Accept what a user would actually type. Bare hosts get https://, and
 *  anything that is not http(s) is refused here as well as in the main process
 *  (defence in depth: this is the friendly error, that one is the real gate). */
function normalizeUrl(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

/** Minimal shape of the Electron <webview> element we drive. Typed locally
 *  rather than pulling in Electron's renderer types, which would drag the whole
 *  electron package into the renderer's type graph for four methods. */
interface WebviewEl extends HTMLElement {
    src: string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    reload(): void;
    stop(): void;
    getURL(): string;
}

export default function Browser() {
    const { t } = useTranslation();
    const settings = useAppStore((s) => s.settings);
    const ref = useRef<WebviewEl | null>(null);

    const [address, setAddress] = useState(HOME_URL);
    const [current, setCurrent] = useState(HOME_URL);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [canBack, setCanBack] = useState(false);
    const [canForward, setCanForward] = useState(false);

    const go = useCallback((url: string) => {
        const normalized = normalizeUrl(url);
        if (!normalized) {
            setFailure(
                t('browser.badUrl', 'That does not look like a web address. Try gamebanana.com.')
            );
            return;
        }
        setFailure(null);
        setAddress(normalized);
        setCurrent(normalized);
        if (ref.current) ref.current.src = normalized;
    }, [t]);

    // The <webview> lifecycle is event-driven and imperative, so nav state is
    // synced from the guest rather than assumed from what we asked for: a page
    // can redirect, and the address bar should show where we ended up.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const syncNav = () => {
            setCanBack(el.canGoBack());
            setCanForward(el.canGoForward());
            const url = el.getURL();
            if (url && url !== 'about:blank') {
                setCurrent(url);
                setAddress(url);
            }
        };
        const onStart = () => {
            setLoading(true);
            setFailure(null);
        };
        const onStop = () => {
            setLoading(false);
            syncNav();
        };
        const onFail = (e: Event) => {
            // -3 is ERR_ABORTED, which fires on ordinary user-cancelled or
            // redirected loads. Surfacing it as an error would cry wolf.
            const detail = e as Event & { errorCode?: number; errorDescription?: string };
            if (detail.errorCode === -3) return;
            setLoading(false);
            setFailure(detail.errorDescription || t('browser.loadFailed', 'Page failed to load.'));
        };

        el.addEventListener('did-start-loading', onStart);
        el.addEventListener('did-stop-loading', onStop);
        el.addEventListener('did-navigate', syncNav);
        el.addEventListener('did-navigate-in-page', syncNav);
        el.addEventListener('did-fail-load', onFail);
        return () => {
            el.removeEventListener('did-start-loading', onStart);
            el.removeEventListener('did-stop-loading', onStop);
            el.removeEventListener('did-navigate', syncNav);
            el.removeEventListener('did-navigate-in-page', syncNav);
            el.removeEventListener('did-fail-load', onFail);
        };
    }, [t]);

    if (!settings?.experimentalBrowser) {
        return (
            <EmptyState
                icon={Globe}
                title={<Tx k="browser.disabled.title" fallback="Browser is off" />}
                description={
                    <Tx
                        k="browser.disabled.description"
                        fallback="Enable the in-app browser in Settings to use this page."
                    />
                }
            />
        );
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => ref.current?.goBack()}
                    disabled={!canBack}
                    title={t('browser.back', 'Back')}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-bg-tertiary text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                >
                    <ArrowLeft size={15} />
                </button>
                <button
                    type="button"
                    onClick={() => ref.current?.goForward()}
                    disabled={!canForward}
                    title={t('browser.forward', 'Forward')}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-bg-tertiary text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                >
                    <ArrowRight size={15} />
                </button>
                <button
                    type="button"
                    onClick={() => (loading ? ref.current?.stop() : ref.current?.reload())}
                    title={loading ? t('browser.stop', 'Stop') : t('browser.reload', 'Reload')}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-bg-tertiary text-text-secondary transition-colors hover:text-text-primary"
                >
                    {loading ? <X size={15} /> : <RotateCw size={15} />}
                </button>
                <button
                    type="button"
                    onClick={() => go(HOME_URL)}
                    title={t('browser.home', 'Home')}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-bg-tertiary text-text-secondary transition-colors hover:text-text-primary"
                >
                    <Home size={15} />
                </button>

                <form
                    className="relative min-w-[220px] flex-1"
                    onSubmit={(e) => {
                        e.preventDefault();
                        go(address);
                    }}
                >
                    <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        spellCheck={false}
                        placeholder={t('browser.addressPlaceholder', 'Enter a web address')}
                        className="w-full rounded-sm border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
                    />
                </form>

                <button
                    type="button"
                    onClick={() => window.open(current, '_blank')}
                    title={t('browser.openExternal', 'Open in your browser')}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border bg-bg-tertiary px-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                    <ExternalLink size={14} />
                    <Tx k="browser.openExternalLabel" fallback="Open externally" />
                </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {SHORTCUTS.map((s) => (
                    <button
                        key={s.url}
                        type="button"
                        onClick={() => go(s.url)}
                        className="rounded-sm border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {failure && (
                <p className="rounded-sm border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-secondary">
                    {failure}
                </p>
            )}

            <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-border bg-bg-secondary">
                {/* `webview` is an Electron built-in element, not a React one, so
                    it is created via createElement with lowercase attributes.
                    partition matches the one the main process pins. */}
                {createElement('webview', {
                    ref,
                    src: HOME_URL,
                    partition: 'persist:grimoire-browser',
                    style: { width: '100%', height: '100%', display: 'flex' },
                })}
            </div>
        </div>
    );
}
