// Third-party pages use the main-process-hardened guest partition.
// Control and download contracts live in docs/browser-scope-boundary.md.
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, Globe, X, Download, Star, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { EmptyState, PageLayout } from '../components/common/PageComponents';
import { Button, IconButton } from '../components/common/ui';
import { Input } from '../components/common/forms';
import { BrowserReaderControls } from '../components/browser/BrowserReaderControls';
import { useBrowserNavigation } from '../components/browser/useBrowserNavigation';
import { BookmarkBar, BookmarkEditor, BookmarkManager } from '../components/browser/BrowserBookmarks';
import { bookmarkUrl, readBrowserBookmarks, writeBrowserBookmarks, type BrowserBookmark } from '../lib/browserBookmarks';
import { readPref, writePref } from '../lib/uiPrefs';
import Tx from '../components/translation/Tx';
import { BrowserBlockerControl } from '../components/browser/BrowserBlockerControl';
import { getGameBananaImportHandoff } from '../lib/browserImportHandoff';
import {
    BROWSER_DESTINATIONS, groupDestinationsByKind, HOME_DESTINATION_URL,
    visibleDestinations, type BrowserDestinationKind,
} from '../lib/browserCatalog';
import { useBrowserToolDownloadStore } from '../stores/browserToolDownloadStore';

const GROUP_LABEL_KEYS: Record<BrowserDestinationKind, string> = {
    'mod-host': 'browser.catalog.groups.modHost',
    tool: 'browser.catalog.groups.tool',
    reference: 'browser.catalog.groups.reference',
    'community-feed': 'browser.catalog.groups.communityFeed',
};

export default function Browser() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const settings = useAppStore((s) => s.settings);
    const { ref, address, setAddress, current, loading, ready, canBack, canForward, failure, go } =
        useBrowserNavigation(!!settings?.experimentalBrowser);
    const addressInput = useRef<HTMLInputElement>(null);
    const [bookmarks, setBookmarks] = useState(readBrowserBookmarks);
    const [showBar, setShowBar] = useState(() => readPref('browserBookmarkBar'));
    const [manager, setManager] = useState(false);
    const [editor, setEditor] = useState<{ bookmark: BrowserBookmark; existing: boolean }>();
    const currentUrl = bookmarkUrl(current);
    const saved = bookmarks.find(bookmark => bookmark.url === currentUrl);
    const canBookmark = ready && !loading && !failure && !!currentUrl;
    const editCurrent = useCallback(() => {
        if (!canBookmark || !currentUrl || editor || manager) return;
        let title = '';
        try { title = ref.current?.getTitle()?.trim() ?? ''; } catch { /* The guest may have detached. */ }
        setEditor({ bookmark: saved ?? { url: currentUrl, title: title.slice(0, 250) || new URL(currentUrl).hostname, folder: '', onBar: true }, existing: !!saved });
    }, [canBookmark, currentUrl, editor, manager, ref, saved]);
    const focusAddress = useCallback(() => {
        if (editor || manager) return;
        addressInput.current?.focus();
        addressInput.current?.select();
    }, [editor, manager]);
    const changeBarVisibility = useCallback((visible: boolean) => {
        setShowBar(visible);
        writePref('browserBookmarkBar', visible);
    }, []);
    useEffect(() => {
        if (!settings?.experimentalBrowser) return;
        const runShortcut = (shortcut: 'address' | 'bookmark' | 'bar') => {
            if (shortcut === 'address') focusAddress();
            if (shortcut === 'bookmark') editCurrent();
            if (shortcut === 'bar') changeBarVisibility(!showBar);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.repeat) return;
            const key = event.key.toLowerCase();
            const shortcut = event.shiftKey ? key === 'b' ? 'bar' : null
                : key === 'l' ? 'address' : key === 'd' ? 'bookmark' : null;
            if (!shortcut) return;
            event.preventDefault();
            runShortcut(shortcut);
        };
        const unsubscribe = window.electronAPI?.browser?.onShortcut?.(runShortcut);
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); unsubscribe?.(); };
    }, [settings?.experimentalBrowser, focusAddress, editCurrent, changeBarVisibility, showBar]);
    const storeBookmarks = (next: BrowserBookmark[]) => {
        try { writeBrowserBookmarks(next); } catch { return false; }
        setBookmarks(next);
        setEditor(undefined);
        return true;
    };
    const refusal = useBrowserToolDownloadStore((s) => s.refusal);
    const handoff = useMemo(() => getGameBananaImportHandoff(current), [current]);
    const groups = useMemo(
        () => groupDestinationsByKind(visibleDestinations(BROWSER_DESTINATIONS, settings?.nsfwContentMode)),
        [settings?.nsfwContentMode],
    );

    if (!settings?.experimentalBrowser) {
        return (
            <PageLayout>
                <EmptyState icon={Globe} title={<Tx k="browser.disabled.title" />}
                    description={<Tx k="browser.disabled.description" />} />
            </PageLayout>
        );
    }

    return (
        <PageLayout variant="fill" className="gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <IconButton icon={ArrowLeft} label={t('browser.back')} disabled={!ready || !canBack}
                    onClick={() => ref.current?.goBack()} />
                <IconButton icon={ArrowRight} label={t('browser.forward')} disabled={!ready || !canForward}
                    onClick={() => ref.current?.goForward()} />
                <IconButton icon={loading ? X : RotateCw} label={loading ? t('browser.stop') : t('browser.reload')}
                    disabled={!ready} onClick={event => loading ? ref.current?.stop() : event.shiftKey ? ref.current?.reloadIgnoringCache() : ref.current?.reload()} />
                <IconButton icon={Home} label={t('browser.home')} onClick={() => go(HOME_DESTINATION_URL)} />
                <form className="min-w-0 basis-48 flex-1" onSubmit={event => {
                    event.preventDefault(); go(address);
                }}>
                    <Input ref={addressInput} inputSize="sm" value={address} onChange={event => setAddress(event.target.value)}
                        spellCheck={false} aria-label={t('browser.addressPlaceholder')}
                        placeholder={t('browser.addressPlaceholder')} />
                </form>
                <IconButton icon={Star} label={saved ? t('browser.bookmarks.edit') : t('browser.bookmarks.add')}
                    aria-keyshortcuts="Control+D Meta+D" aria-pressed={!!saved} disabled={!canBookmark}
                    className={saved ? 'text-accent [&>svg]:fill-current' : ''} onClick={editCurrent} />
                <IconButton icon={BookOpen} label={t('browser.bookmarks.manage')} onClick={() => setManager(true)} />
                <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => window.open(current, '_blank')}
                    title={t('browser.openExternal')}>
                    <Tx k="browser.openExternalLabel" />
                </Button>
            </div>

            {showBar && <BookmarkBar bookmarks={bookmarks} onOpen={go} />}
            {manager && <BookmarkManager bookmarks={bookmarks} showBar={showBar}
                onShowBar={changeBarVisibility}
                onOpen={url => { go(url); setManager(false); }}
                onEdit={bookmark => setEditor({ bookmark, existing: true })} onClose={() => setManager(false)} />}
            {editor && <BookmarkEditor initial={editor.bookmark} existing={editor.existing} bookmarks={bookmarks}
                onClose={() => setEditor(undefined)}
                onSave={bookmark => storeBookmarks(editor.existing
                    ? bookmarks.map(previous => previous.url === editor.bookmark.url ? bookmark : previous)
                    : [...bookmarks, bookmark])}
                onRemove={() => storeBookmarks(bookmarks.filter(bookmark => bookmark.url !== editor.bookmark.url))} />}

            <BrowserBlockerControl url={current} reload={() => ref.current?.reloadIgnoringCache()} />
            <BrowserReaderControls guest={ref} ready={ready}>
                <details className="min-w-0 flex-1">
                    <summary className="w-fit cursor-pointer rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        <Tx k="browser.catalog.toggle" />
                    </summary>
                    <div className="mt-3 flex max-h-48 flex-col gap-3 overflow-y-auto p-1">
                        {groups.map(group => (
                            <div key={group.kind} className="flex flex-col gap-1">
                                <h3 className="text-xs font-medium text-text-secondary"><Tx k={GROUP_LABEL_KEYS[group.kind]} /></h3>
                                <div className="flex flex-wrap gap-1">
                                    {group.entries.map(destination => (
                                        <Button key={destination.url} variant="ghost" size="sm" onClick={() => go(destination.url)}>
                                            {destination.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            </BrowserReaderControls>

            {failure && (
                <p role="alert" className="shrink-0 rounded-sm border border-state-warning/40 bg-state-warning/10 px-3 py-2 text-xs text-text-secondary">
                    {failure.kind === 'address' ? t('browser.badUrl') : t('browser.loadFailed')}
                    {failure.detail && <span className="ml-2">{failure.detail}</span>}
                </p>
            )}
            {refusal && (
                <p role="alert" className="shrink-0 rounded-sm border border-state-danger/40 bg-state-danger/10 px-3 py-2 text-xs text-state-danger">{refusal}</p>
            )}
            {handoff && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-secondary">
                    <span><Tx k="browser.importHandoff.note" /></span>
                    <Button variant="secondary" size="sm" icon={Download} onClick={() => navigate(handoff.route)}>
                        <Tx k="browser.importHandoff.action" />
                    </Button>
                </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-border bg-bg-secondary">
                {createElement('webview', {
                    ref, src: HOME_DESTINATION_URL, partition: 'persist:grimoire-browser',
                    style: { width: '100%', height: '100%', display: 'flex' },
                })}
            </div>
        </PageLayout>
    );
}
