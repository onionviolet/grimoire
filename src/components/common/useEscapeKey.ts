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
 * Layered overlays arbitrate through the optional `guard` predicate. A caller
 * that participates in a stack passes its own topmost test (see `common/Modal`,
 * whose stack is keyed off the `open` transition rather than effect nesting,
 * so it does not depend on React running child effects before parent effects).
 * Callers that pass no guard behave exactly as before, and a nested overlay
 * that must win can still keep its own guard (see `ModDetailsModal`, where the
 * lightbox eats Escape before the modal does).
 *
 * The guard lives here rather than inline at the call site so there is exactly
 * one Escape implementation in the app.
 *
 * Element-scoped Escape stays element-scoped. `common/SearchInput` clears its
 * field from an `onKeyDown` and only when the field is non-empty, precisely so
 * an empty field lets Escape through to the enclosing modal. That is a
 * different contract from this one, not a call site to convert.
 */
export function useEscapeKey(
    onEscape: () => void,
    enabled = true,
    guard?: () => boolean,
) {
    const handlerRef = useRef(onEscape);
    const guardRef = useRef(guard);
    // Synced in an effect rather than assigned during render: the React
    // Compiler treats a render-phase ref write as a side effect and bails out
    // of optimizing the whole component.
    useEffect(() => {
        handlerRef.current = onEscape;
        guardRef.current = guard;
    });

    useEffect(() => {
        if (!enabled) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            // A dialog stacked above this one owns the keyboard; letting the
            // lower handler run too would close both on a single Escape.
            if (guardRef.current && !guardRef.current()) return;
            event.preventDefault();
            handlerRef.current();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled]);
}
