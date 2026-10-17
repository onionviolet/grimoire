import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowDown, ArrowUp, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '../common/ui';
import { Input } from '../common/forms';
import type { BrowserWebview } from './webview';

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function BrowserReaderControls({ guest, ready, children }: {
    guest: RefObject<BrowserWebview | null>;
    ready: boolean;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement | null>(null);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const request = useRef<number | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null);
    const [zoom, setZoom] = useState(1);

    const close = () => {
        request.current = null;
        if (ready) guest.current?.stopFindInPage('clearSelection');
        setResult(null);
        setQuery('');
        setOpen(false);
        trigger.current?.focus();
    };

    const find = (text: string, forward = true, newSession = true) => {
        request.current = null;
        setResult(null);
        if (!ready || !guest.current) return;
        if (!text) {
            guest.current.stopFindInPage('clearSelection');
            return;
        }
        // Electron maps findNext to Chromium's new_session, despite the name.
        request.current = guest.current.findInPage(text, { forward, findNext: newSession });
    };

    useEffect(() => {
        const el = guest.current;
        if (!el) return;
        const onResult = (event: Event) => {
            const detail = event as Event & { result?: { requestId: number; activeMatchOrdinal: number; matches: number } };
            if (detail.result && detail.result.requestId === request.current) setResult(detail.result);
        };
        const onReady = () => setZoom(el.getZoomFactor());
        const onNavigation = (event: Event) => {
            const detail = event as Event & { isMainFrame?: boolean; isInPlace?: boolean };
            if (detail.isMainFrame === false || detail.isInPlace) return;
            request.current = null;
            if (ready) el.stopFindInPage('clearSelection');
            setResult(null);
            setQuery('');
        };
        el.addEventListener('found-in-page', onResult);
        el.addEventListener('dom-ready', onReady);
        el.addEventListener('did-start-navigation', onNavigation);
        return () => {
            el.removeEventListener('found-in-page', onResult);
            el.removeEventListener('dom-ready', onReady);
            el.removeEventListener('did-start-navigation', onNavigation);
            request.current = null;
        };
    }, [guest, ready]);

    useEffect(() => { if (open) input.current?.focus(); }, [open]);

    const changeZoom = (value: number) => {
        if (!ready || !guest.current) return;
        guest.current.setZoomFactor(value);
        setZoom(guest.current.getZoomFactor());
    };

    return (
        <div className="flex shrink-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                {children}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" icon={Search} disabled={!ready}
                        aria-expanded={open} aria-controls="browser-find" onClick={event => {
                            trigger.current = event.currentTarget;
                            if (open) close(); else setOpen(true);
                        }}>
                        {t('browser.find.open')}
                    </Button>
                    <IconButton size="sm" icon={ZoomOut} label={t('browser.zoom.out')} disabled={!ready || zoom <= ZOOM_STEPS[0]}
                        onClick={() => changeZoom([...ZOOM_STEPS].reverse().find(step => step < zoom - 0.001) ?? ZOOM_STEPS[0])} />
                    <Button variant="ghost" size="sm" title={t('browser.zoom.reset')} aria-label={t('browser.zoom.reset')}
                        className="tabular-nums" disabled={!ready} onClick={() => changeZoom(1)}>
                        {t('browser.zoom.value', { percent: Math.round(zoom * 100) })}
                    </Button>
                    <IconButton size="sm" icon={ZoomIn} label={t('browser.zoom.in')} disabled={!ready || zoom >= ZOOM_STEPS.at(-1)!}
                        onClick={() => changeZoom(ZOOM_STEPS.find(step => step > zoom + 0.001) ?? ZOOM_STEPS.at(-1)!)} />
                </div>
            </div>
            {open && (
                <form id="browser-find" className="flex flex-wrap items-center gap-2" onSubmit={event => {
                    event.preventDefault(); find(query, true, false);
                }}>
                    <Input ref={input} inputSize="sm" className="min-w-0 flex-1" value={query}
                        aria-label={t('browser.find.placeholder')} placeholder={t('browser.find.placeholder')}
                        onChange={event => { setQuery(event.target.value); find(event.target.value); }}
                        onKeyDown={event => {
                            if (event.key === 'Escape') { event.preventDefault(); close(); }
                            if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); find(query, false, false); }
                        }} />
                    <span role="status" className="text-xs text-text-secondary tabular-nums">
                        {result ? t('browser.find.matches', { current: result.activeMatchOrdinal, total: result.matches }) : ''}
                    </span>
                    <IconButton size="sm" icon={ArrowUp} label={t('browser.find.previous')} disabled={!query || !ready}
                        onClick={() => find(query, false, false)} />
                    <IconButton size="sm" icon={ArrowDown} label={t('browser.find.next')} disabled={!query || !ready}
                        onClick={() => find(query, true, false)} />
                    <IconButton size="sm" icon={X} label={t('browser.find.close')} onClick={close} />
                </form>
            )}
        </div>
    );
}
