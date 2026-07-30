import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeKey } from './useEscapeKey';

interface DismissableOptions {
    /** False unsubscribes everything. Pass the open flag. */
    enabled?: boolean;
    /**
     * Elements that count as inside even though they are not descendants of
     * the returned ref: the trigger that opened the surface, and any panel
     * portaled out of it.
     */
    alsoInside?: RefObject<HTMLElement | null>[];
    /**
     * Return focus to whatever had it when the surface opened. Only fires when
     * focus is still inside the surface at close, so dismissing by clicking
     * somewhere else never yanks focus back. Default true.
     */
    restoreFocus?: boolean;
}

/**
 * The dismissal contract a transient surface owes the user, in one place:
 * Escape closes it, a press outside closes it, and closing puts focus back on
 * the control that opened it.
 *
 * Attach the returned ref to the surface's outermost element.
 *
 * Every anchored menu and popover in the app had written the first two by hand
 * and skipped the third, which is the one a keyboard user notices: dismissing a
 * card's action menu dropped focus to the document and left them tabbing from
 * the top of the page.
 *
 * Not for `common/Modal`. A full-screen backdrop can identify an outside press
 * by target identity, which is strictly better than a `contains` test: it
 * ignores a drag that merely *ends* on the backdrop. That lives in
 * `useBackdropDismiss`, and Modal composes it with `useEscapeKey` directly.
 */
export function useDismissable<T extends HTMLElement = HTMLDivElement>(
    onDismiss: () => void,
    { enabled = true, alsoInside, restoreFocus = true }: DismissableOptions = {}
): RefObject<T | null> {
    const ref = useRef<T>(null);
    const dismissRef = useRef(onDismiss);
    // Read at event time rather than captured in the effect, so a caller can
    // build the array inline without re-subscribing on every render. Synced in
    // an effect, not during render: see useEscapeKey.
    const alsoInsideRef = useRef(alsoInside);
    useEffect(() => {
        dismissRef.current = onDismiss;
        alsoInsideRef.current = alsoInside;
    });

    useEscapeKey(() => dismissRef.current(), enabled);

    useEffect(() => {
        if (!enabled) return;
        // mousedown, not pointerdown: portaled children (HeroSelect's listbox)
        // stop propagation of the React mousedown to keep their own gesture
        // inside their logical boundary. Listening for pointerdown here would
        // bypass that and dismiss the surface out from under a hero being
        // picked.
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (ref.current?.contains(target)) return;
            for (const inside of alsoInsideRef.current ?? []) {
                if (inside.current?.contains(target)) return;
            }
            dismissRef.current();
        };
        window.addEventListener('mousedown', onMouseDown);
        return () => window.removeEventListener('mousedown', onMouseDown);
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !restoreFocus) return;
        const opener = document.activeElement;
        const surface = ref.current;
        return () => {
            if (!(opener instanceof HTMLElement) || !opener.isConnected) return;
            // Only reclaim focus the surface still holds. If the user moved on,
            // leave them where they are. A closing surface takes its focused
            // child with it, and the browser drops focus to <body>, so that
            // counts as still held.
            const active = document.activeElement;
            const held =
                (active instanceof Node && surface?.contains(active)) ||
                active === null ||
                active === document.body;
            if (held) opener.focus();
        };
    }, [enabled, restoreFocus]);

    return ref;
}
