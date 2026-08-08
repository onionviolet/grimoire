// In-app web browser: reach the mod ecosystem without leaving Grimoire.
//
// Everything renders inside a <webview>, which is an out-of-process guest with
// its own session partition. The guest's security settings are NOT trusted from
// here: `will-attach-webview` in the main process strips the preload, forces
// sandbox/contextIsolation, pins the partition and rejects any non-http(s) src.
// This file only drives navigation; it cannot widen the guest's privileges.
//
// Deliberately not a full browser. The bounded control set (what exists, what
// doesn't, and why) is recorded in docs/browser-scope-boundary.md; that
// document is the record, this comment is only a pointer to it.

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, Globe, X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { EmptyState } from '../components/common/PageComponents';
import Tx from '../components/translation/Tx';
import { getGameBananaImportHandoff } from '../lib/browserImportHandoff';
import {
    BROWSER_DESTINATIONS,
    destinationForUrl,
    groupDestinationsByKind,
    HOME_DESTINATION_URL,
    visibleDestinations,
    type BrowserDestinationKind,
} from '../lib/browserCatalog';
import { setActiveBrowserDestination } from '../lib/browserToolDownload';
import { useBrowserToolDownloadStore } from '../stores/browserToolDownloadStore';

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

/** i18n key + English fallback for each kind group's header (06-UI-SPEC.md
 *  Copywriting Contract). `KIND_ORDER` decides render order; this only
 *  decides what a kind is called. */
const GROUP_LABEL_KEYS: Record<BrowserDestinationKind, { key: string; fallback: string }> = {
    'mod-host': { key: 'browser.catalog.groups.modHost', fallback: 'Mod hosts' },
    tool: { key: 'browser.catalog.groups.tool', fallback: 'Tools' },
    reference: { key: 'browser.catalog.groups.reference', fallback: 'Reference' },
    'community-feed': { key: 'browser.catalog.groups.communityFeed', fallback: 'Community' },
};

export default function Browser() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const settings = useAppStore((s) => s.settings);
    const ref = useRef<WebviewEl | null>(null);

    const [address, setAddress] = useState(HOME_DESTINATION_URL);
    const [current, setCurrent] = useState(HOME_DESTINATION_URL);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const refusal = useBrowserToolDownloadStore((s) => s.refusal);
    const setRefusal = useBrowserToolDownloadStore((s) => s.setRefusal);
    const [canBack, setCanBack] = useState(false);
    const [canForward, setCanForward] = useState(false);
    const handoff = useMemo(() => getGameBananaImportHandoff(current), [current]);
    // Keep browser shortcuts consistent with the Browse content preference
    // ("blur" leaves the optional adult destination visible, "hide" removes
    // it), then bucket the survivors by declared kind (D-04) so the UI can
    // render Mod hosts, Tools, Reference and Community as separate rows.
    const groups = useMemo(
        () => groupDestinationsByKind(visibleDestinations(BROWSER_DESTINATIONS, settings?.browseNsfwContentMode)),
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
                const destination = destinationForUrl(url);
                setActiveBrowserDestination(destination?.kind ?? null, originOf(url), destination?.label ?? null);
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
        const homeDestination = destinationForUrl(HOME_DESTINATION_URL);
        setActiveBrowserDestination(
            homeDestination?.kind ?? null,
            originOf(HOME_DESTINATION_URL),
            homeDestination?.label ?? null
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
            setActiveBrowserDestination(null, null, null);
        };
    }, [t, setRefusal]);

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
        <div className="flex h-full flex-col gap-6">
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

            <div className="flex flex-col gap-4">
                {groups.map((group) => {
                    const { key, fallback } = GROUP_LABEL_KEYS[group.kind];
                    return (
                        <div key={group.kind} className="flex flex-col gap-2">
                            {/* Not the shared SectionHeader primitive: it renders
                                text-sm/font-medium (weight 500), and 06-UI-SPEC.md
                                declares this phase's label role at 12px/weight 600
                                (text-xs font-semibold), a third weight SectionHeader
                                does not offer. Kept local rather than widening the
                                shared primitive for one page. */}
                            <h3
                                className={`text-xs font-semibold uppercase tracking-wider ${
                                    group.kind === 'tool' ? 'text-accent' : 'text-text-secondary'
                                }`}
                            >
                                <Tx k={key} fallback={fallback} />
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {group.entries.map((s) => (
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
                        </div>
                    );
                })}
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
