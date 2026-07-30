import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Put a long list back where the user left it after a drill-in round trip.
 *
 * This was implemented three times independently, in exactly the three pages
 * that have a long grid plus a drill-in (Browse, Installed, Locker), and was
 * absent from every other page. So opening a conflict pair from deep in a long
 * list and coming back dumped the user at the top: the precise frustration the
 * three implementations exist to prevent.
 *
 * Restoring is not just "assign scrollTop once". The list is usually still
 * short at that moment (data loading, a two-phase grid mount, images without
 * intrinsic size), so the assignment silently clamps to a smaller
 * scrollHeight. The retry loop below is the part every hand-rolled copy got
 * subtly differently.
 */

/** Offsets live for the session, keyed by caller. A module-level map rather
 *  than storage: a scroll position is worth restoring within a session and
 *  actively wrong to restore into a list that has since changed. */
const offsets = new Map<string, number>();

/** The remembered offset for a key, or 0. Exported for tests and for callers
 *  that seed from somewhere longer-lived. */
export function rememberedScrollTop(key: string): number {
  return offsets.get(key) ?? 0;
}

export function rememberScrollTop(key: string, top: number): void {
  offsets.set(key, Math.max(0, top));
}

/** Forget one key, so a deliberate "start from the top" is expressible. */
export function forgetScrollTop(key: string): void {
  offsets.delete(key);
}

interface ScrollRestoreOptions {
  /** A longer-lived fallback for the first restore, e.g. a store that survives
   *  a module reload. Consulted only when nothing is remembered for this key. */
  initialTop?: () => number;
  /** The last offset, handed over on unmount, for callers that mirror it. */
  onLeave?: (top: number) => void;
}

/**
 * Returns the ref to attach to the scrolling element.
 *
 * `readyDeps` are the things whose arrival can change the scrollHeight (the
 * loading flags, the item count, the view mode). Restoring re-runs when they
 * change, because an offset that did not fit a moment ago may fit now.
 */
export function useScrollRestore<T extends HTMLElement>(
  key: string,
  readyDeps: readonly unknown[],
  options: ScrollRestoreOptions = {}
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  // Options are read inside effects that must not re-run when a caller passes
  // a fresh closure each render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useLayoutEffect(() => {
    let frame: number | null = null;
    let attempts = 0;

    const restore = () => {
      const container = ref.current;
      if (!container) return;
      const wanted = offsets.get(key) ?? optionsRef.current.initialTop?.() ?? 0;
      if (wanted <= 0) return;
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      // Still collapsed: assigning now would clamp to a smaller height and
      // lose the offset for good. Wait a frame and look again, bounded so a
      // genuinely short list does not spin.
      if (maxScrollTop <= 0 && attempts < 8) {
        attempts += 1;
        frame = window.requestAnimationFrame(restore);
        return;
      }
      container.scrollTop = Math.min(wanted, maxScrollTop);
    };

    restore();
    // Once more after paint: the first pass runs before the browser has laid
    // out anything that only sizes on paint.
    frame = window.requestAnimationFrame(restore);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
    // readyDeps is the caller's list; spreading it is the point of the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...readyDeps]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const onScroll = () => rememberScrollTop(key, container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      optionsRef.current.onLeave?.(rememberedScrollTop(key));
    };
    // Re-attached alongside the restore pass, for the same reason: the element
    // may not exist yet on the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...readyDeps]);

  return ref;
}
