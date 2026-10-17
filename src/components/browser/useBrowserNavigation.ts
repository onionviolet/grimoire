import { useCallback, useEffect, useRef, useState } from 'react';
import { destinationForUrl, HOME_DESTINATION_URL } from '../../lib/browserCatalog';
import { setActiveBrowserDestination } from '../../lib/browserToolDownload';
import { useBrowserToolDownloadStore } from '../../stores/browserToolDownloadStore';
import type { BrowserWebview } from './webview';

function normalizeUrl(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(candidate);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

export function useBrowserNavigation(enabled: boolean) {
    const ref = useRef<BrowserWebview | null>(null);
    const [address, setAddress] = useState(HOME_DESTINATION_URL);
    const [current, setCurrent] = useState(HOME_DESTINATION_URL);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [canBack, setCanBack] = useState(false);
    const [canForward, setCanForward] = useState(false);
    const [failure, setFailure] = useState<{ kind: 'address' | 'load'; detail?: string } | null>(null);
    const setRefusal = useBrowserToolDownloadStore((s) => s.setRefusal);

    const go = useCallback((input: string) => {
        const url = normalizeUrl(input);
        if (!url) {
            setFailure({ kind: 'address' });
            return;
        }
        setFailure(null);
        setAddress(url);
        // Until the guest commits navigation, it cannot retain the previous
        // tool site's capture grant or claim the requested page loaded.
        setActiveBrowserDestination(null, null, null);
        if (ref.current) ref.current.src = url;
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!enabled || !el) return;
        let guestReady = false;

        const syncNav = (event?: Event) => {
            const detail = event as (Event & { url?: string; isMainFrame?: boolean }) | undefined;
            if (detail?.isMainFrame === false) return;
            const url = detail?.url || (guestReady ? el.getURL() : '');
            if (guestReady) {
                setCanBack(el.canGoBack());
                setCanForward(el.canGoForward());
            }
            if (url && /^https?:\/\//i.test(url)) {
                setCurrent(url);
                setAddress(url);
                const destination = destinationForUrl(url);
                setActiveBrowserDestination(destination?.kind ?? null, new URL(url).origin, destination?.label ?? null);
                setRefusal(null);
            }
        };
        const onReady = () => {
            guestReady = true;
            setReady(true);
            syncNav();
        };
        const onStart = () => { setLoading(true); setFailure(null); };
        const onNavigationStart = (event: Event) => {
            const detail = event as Event & { isMainFrame?: boolean; isInPlace?: boolean };
            if (detail.isMainFrame !== false && !detail.isInPlace) {
                setActiveBrowserDestination(null, null, null);
            }
        };
        const onStop = () => { setLoading(false); syncNav(); };
        const onFail = (event: Event) => {
            const detail = event as Event & { errorCode?: number; errorDescription?: string; isMainFrame?: boolean };
            // User cancellation and blocked embedded frames do not mean the
            // top-level page failed. Ad blocking commonly causes the latter.
            if (detail.errorCode === -3 || detail.isMainFrame === false) return;
            setLoading(false);
            setFailure({ kind: 'load', detail: detail.errorDescription });
        };
        const listeners: [string, (event: Event) => void][] = [
            ['dom-ready', onReady], ['did-start-loading', onStart],
            ['did-start-navigation', onNavigationStart], ['did-stop-loading', onStop],
            ['did-navigate', syncNav], ['did-navigate-in-page', syncNav], ['did-fail-load', onFail],
        ];
        for (const [name, listener] of listeners) el.addEventListener(name, listener);
        return () => {
            for (const [name, listener] of listeners) el.removeEventListener(name, listener);
            setReady(false);
            setCanBack(false);
            setCanForward(false);
            setLoading(false);
            setActiveBrowserDestination(null, null, null);
        };
        // Bind when async settings mount the guest. Translation changes must
        // not tear down the live destination grant or reset guest readiness.
    }, [enabled, setRefusal]);

    return { ref, address, setAddress, current, loading, ready, canBack, canForward, failure, go };
}
