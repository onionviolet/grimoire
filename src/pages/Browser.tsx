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

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, Globe, X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { EmptyState } from '../components/common/PageComponents';
import Tx from '../components/translation/Tx';
import { getGameBananaImportHandoff } from '../lib/browserImportHandoff';
import { BROWSER_DESTINATIONS, destinationForUrl, HOME_DESTINATION_URL } from '../lib/browserCatalog';
import { onBrowserToolDownload, resolveToolDownload, setActiveBrowserDestination } from '../lib/browserToolDownload';
import { useConfirm } from '../components/common/confirmContext';
import { showToast } from '../stores/toastStore';

/** The origin to push alongside a destination's kind (Pattern 3): recomputed
 *  from the guest's live URL on every nav event, never assumed from what was
 *  last clicked. Null for an unparseable URL. */
function originOf(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

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
    const navigate = useNavigate();
    const confirm = useConfirm();
    const settings = useAppStore((s) => s.settings);
    const ref = useRef<WebviewEl | null>(null);

    const [address, setAddress] = useState(HOME_DESTINATION_URL);
    const [current, setCurrent] = useState(HOME_DESTINATION_URL);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [refusal, setRefusal] = useState<string | null>(null);
    const [canBack, setCanBack] = useState(false);
    const [canForward, setCanForward] = useState(false);
    const handoff = useMemo(() => getGameBananaImportHandoff(current), [current]);
    // Keep browser shortcuts consistent with the Browse content preference.
    // "Blur" leaves the optional adult destination visible; "hide" removes it.
    const visibleShortcuts = useMemo(
        () => BROWSER_DESTINATIONS.filter((shortcut) => !shortcut.nsfw || settings?.browseNsfwContentMode !== 'hide'),
        [settings?.browseNsfwContentMode],
    );

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
                // Recomputed from the guest's own current URL on every nav
                // event (not "last shortcut clicked"): a tool page redirecting
                // in-page must revoke the capture grant just as reliably as
                // clicking a different shortcut would (RESEARCH Pattern 3).
                setActiveBrowserDestination(destinationForUrl(url)?.kind ?? null, originOf(url));
                // A stale refusal must not follow the user to another page.
                setRefusal(null);
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

        // The webview's initial `src` is the home destination; push its kind
        // before the first `did-navigate` fires so a download attempted
        // before that first event still resolves against the right grant.
        setActiveBrowserDestination(
            destinationForUrl(HOME_DESTINATION_URL)?.kind ?? null,
            originOf(HOME_DESTINATION_URL)
        );

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
            // Leaving the page revokes the grant: nothing captured after this
            // point belongs to a destination the user can still see.
            setActiveBrowserDestination(null, null);
        };
    }, [t]);

    // Tool-download disclosure round trip (D-08/D-09/D-10). This effect owns
    // 'ready' (confirm-then-install), 'refused' (danger-tone banner) and
    // 'failed' (toast); 'started' and 'replaced' are plan 06-02.
    useEffect(() => {
        return onBrowserToolDownload((event) => {
            if (event.status === 'ready') {
                setRefusal(null);
                const displayName = event.name ?? t('browser.toolDownload.fallbackName', 'Browser download');
                void (async () => {
                    const accepted = await confirm({
                        title: <Tx k="browser.toolDownload.title" fallback="Add this download to your mod library?" />,
                        message: (
                            <Tx
                                k="browser.toolDownload.message"
                                fallback='Will add to your mod library as "{{name}}".'
                                values={{ name: displayName }}
                            />
                        ),
                        confirmLabel: <Tx k="browser.toolDownload.confirm" fallback="Add to library" />,
                        cancelLabel: <Tx k="browser.toolDownload.cancel" fallback="Discard" />,
                        variant: 'primary',
                    });
                    await resolveToolDownload(event.id, accepted);
                })();
            } else if (event.status === 'refused') {
                // D-10: a refusal is loud and visible, never a silent drop.
                // The reason is main-process English, rendered verbatim after
                // a translated prefix; never shown as a confirm dialog.
                const prefix = t('browser.toolDownload.refusedPrefix', 'Not added: ');
                setRefusal(`${prefix}${event.reason ?? ''}`);
            } else if (event.status === 'failed') {
                setRefusal(null);
                showToast(
                    t('browser.toolDownload.interrupted', 'The download did not finish. Nothing was added.'),
                    { tone: 'error' }
                );
            }
        });
    }, [confirm, t]);

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
                    onClick={() => go(HOME_DESTINATION_URL)}
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
                {visibleShortcuts.map((s) => (
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

            {refusal && (
                <p className="rounded-sm border border-state-danger/40 bg-state-danger/10 px-3 py-2 text-xs text-state-danger">
                    {refusal}
                </p>
            )}

            {handoff && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-secondary">
                    <span><Tx k="browser.importHandoff.note" fallback="This GameBanana item can be reviewed and installed from Grimoire." /></span>
                    <button
                        type="button"
                        onClick={() => navigate(handoff.route)}
                        className="flex items-center gap-1.5 rounded-sm border border-accent/40 bg-bg-tertiary px-2 py-1 text-xs text-text-primary transition-colors hover:border-accent/70"
                    >
                        <Download size={13} />
                        <Tx k="browser.importHandoff.action" fallback="Review in Browse" />
                    </button>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-border bg-bg-secondary">
                {/* `webview` is an Electron built-in element, not a React one, so
                    it is created via createElement with lowercase attributes.
                    partition matches the one the main process pins. */}
                {createElement('webview', {
                    ref,
                    src: HOME_DESTINATION_URL,
                    partition: 'persist:grimoire-browser',
                    style: { width: '100%', height: '100%', display: 'flex' },
                })}
            </div>
        </div>
    );
}
