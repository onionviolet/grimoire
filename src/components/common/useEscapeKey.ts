import { useEffect, useRef } from 'react';

/**
 * Escape-to-dismiss, written once.
 *
 * Escape was handled in fifteen files: `common/Modal` had the considered
 * version and every popover, menu and picker rolled its own window listener,
 * each with its own choice of `window` vs `document`, its own decision about
 * `preventDefault`, and its own re-subscribe churn from an inline handler prop.
 * The behaviour was near-identical everywhere, so the copies were drift waiting
 * to happen rather than deliberate variation.
 *
 * The handler is held in a ref, so an inline arrow passed by the caller does
 * not tear the listener down and rebuild it on every render. Only `enabled`
 * moves the subscription.
 *
 * This deliberately does not arbitrate between layered overlays. Each caller
 * installs its own listener, exactly as before, and a nested overlay that must
 * win keeps its own guard (see `ModDetailsModal`, where the lightbox eats
 * Escape before the modal does). A registration stack looks like the fix and is
 * not: React runs child effects before parent effects, so the innermost overlay
 * registers first and would read as the outermost.
 *
 * Element-scoped Escape stays element-scoped. `common/SearchInput` clears its
 * field from an `onKeyDown` and only when the field is non-empty, precisely so
 * an empty field lets Escape through to the enclosing modal. That is a
 * different contract from this one, not a call site to convert.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
    const handlerRef = useRef(onEscape);
    // Synced in an effect rather than assigned during render: the React
    // Compiler treats a render-phase ref write as a side effect and bails out
    // of optimizing the whole component.
    useEffect(() => {
        handlerRef.current = onEscape;
    });

    useEffect(() => {
        if (!enabled) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            handlerRef.current();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled]);
}
