import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import Tx from '../components/translation/Tx';
import { onBrowserToolDownload, resolveToolDownload } from './browserToolDownload';
import { useConfirm } from '../components/common/confirmContext';
import { dismissToast, showToast } from '../stores/toastStore';
import { setBrowserToolDownloadRefusal } from '../stores/browserToolDownloadStore';

/**
 * App-scoped tool-download disclosure subscriber (D-08/D-09/D-10), called
 * once from `Layout.tsx`'s component body. This used to be a `Browser.tsx`
 * page-scoped effect; that meant navigating away from `/browser` while a
 * tool's download was in flight tore the subscriber down and silently
 * dropped the confirm dialog, the refusal banner, and the toast, orphaning
 * the temp file (CR-01). Moving the subscription here makes its lifetime the
 * renderer document's lifetime rather than the `/browser` route's mount,
 * mirroring the same reasoning `onOneClickInstall` and `onMultiVpkPick`
 * already apply in `Layout.tsx`.
 *
 * `.tsx` because the confirm request takes `Tx` elements for its title,
 * message, and labels. Lives beside `browserToolDownload.ts` and
 * `browserImportHandoff.ts`, both fork-only browser modules, so this
 * relocation costs the shared `Layout.tsx` exactly two lines.
 */

/** Pure predicate: is `pathname` the Browser page? Strict equality, because
 *  `/browser` has no sub routes and a prefix match would misfire on any
 *  future sibling path. */
export function isBrowserRoute(pathname: string): boolean {
    return pathname === '/browser';
}

export function useBrowserToolDownloadHandoff(): void {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const location = useLocation();

    // The in-flight 'Downloading from...' toast's id, so it can be dismissed
    // the moment a terminal status (ready/refused/failed) arrives for the
    // same download rather than lingering until its own timeout.
    const downloadingToastIdRef = useRef<number | null>(null);
    // Ids evicted by a 'replaced' push while their confirm dialog may still
    // be open. The dialog itself cannot be closed from outside `useConfirm`,
    // so a still-pending answer for a stale id resolves as a no-op instead of
    // calling resolveToolDownload against a file that no longer exists.
    const staleDownloadIdsRef = useRef<Set<string>>(new Set());

    // The live route, read through a ref rather than through the effect's
    // dependency list: resubscribing on every route change would reintroduce
    // a smaller version of the exact bug this file exists to fix (CR-01),
    // since the subscription would tear down and re-establish across a
    // navigation instead of surviving it.
    const pathnameRef = useRef(location.pathname);
    useEffect(() => {
        pathnameRef.current = location.pathname;
    }, [location.pathname]);

    useEffect(() => {
        return onBrowserToolDownload((event) => {
            if (event.status === 'started') {
                if (downloadingToastIdRef.current !== null) dismissToast(downloadingToastIdRef.current);
                downloadingToastIdRef.current = showToast(
                    t('browser.toolDownload.downloading', 'Downloading from {{tool}}...', {
                        tool: event.tool ?? '',
                    }),
                    { tone: 'info', duration: 60000 }
                );
            } else if (event.status === 'ready') {
                if (downloadingToastIdRef.current !== null) {
                    dismissToast(downloadingToastIdRef.current);
                    downloadingToastIdRef.current = null;
                }
                setBrowserToolDownloadRefusal(null);
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
                    // A 'replaced' event may have arrived while this confirm
                    // was still open (the dialog itself cannot be closed from
                    // here, only answered): treat any answer to a superseded
                    // id as a no-op rather than resolving against a file that
                    // is already gone.
                    if (staleDownloadIdsRef.current.delete(event.id)) return;
                    await resolveToolDownload(event.id, accepted);
                })();
            } else if (event.status === 'refused') {
                // D-10: a refusal is loud and visible, never a silent drop.
                // The reason is main-process English, rendered verbatim after
                // a translated prefix; never shown as a confirm dialog.
                if (downloadingToastIdRef.current !== null) {
                    dismissToast(downloadingToastIdRef.current);
                    downloadingToastIdRef.current = null;
                }
                const prefix = t('browser.toolDownload.refusedPrefix', 'Not added: ');
                const sentence = `${prefix}${event.reason ?? ''}`;
                // Routed by the live route: on /browser the banner carries it
                // (no toast), off /browser the toast carries it (banner stays
                // null). This is the UI-SPEC error state row, extended to the
                // case the spec did not have to consider while the subscriber
                // was page scoped.
                if (isBrowserRoute(pathnameRef.current)) {
                    setBrowserToolDownloadRefusal(sentence);
                } else {
                    showToast(sentence, { tone: 'error', duration: 9000 });
                }
            } else if (event.status === 'failed') {
                if (downloadingToastIdRef.current !== null) {
                    dismissToast(downloadingToastIdRef.current);
                    downloadingToastIdRef.current = null;
                }
                setBrowserToolDownloadRefusal(null);
                showToast(
                    t('browser.toolDownload.interrupted', 'The download did not finish. Nothing was added.'),
                    { tone: 'error' }
                );
            } else if (event.status === 'replaced') {
                if (downloadingToastIdRef.current !== null) {
                    dismissToast(downloadingToastIdRef.current);
                    downloadingToastIdRef.current = null;
                }
                showToast(
                    t('browser.toolDownload.replaced', 'Replaced with a newer download from {{tool}}.', {
                        tool: event.tool ?? '',
                    }),
                    { tone: 'info' }
                );
                // The evicted id's confirm dialog (if still open) resolves as
                // a no-op the moment the user answers it; the backend already
                // discarded the entry, so nothing else needs to happen now.
                staleDownloadIdsRef.current.add(event.id);
            }
        });
    }, [confirm, t]);
}
