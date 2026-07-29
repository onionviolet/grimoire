import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { foundryBuildTrayPreview, foundryReleaseTrayPreview } from '../../lib/api';
import {
  isStagedVisualEdit,
  reviewStagedEdits,
  toForgeRequest,
  type FoundryStagedEdit,
} from './buildTray';

/**
 * Staging is fast and building a VPK is not, so a rebuild per keystroke-sized
 * edit would keep the viewer permanently stale. Wait for the tray to settle.
 */
const REBUILD_DELAY_MS = 700;

export interface TrayPreview {
  /** Handle to pass as a pose source's `previewId`, or null when there is
   *  nothing to preview (no visual edits, disabled, or the build failed). */
  previewId: string | null;
  building: boolean;
  error: string | null;
}

/**
 * Build the tray's visual edits into a throwaway VPK the 3D viewer can stack.
 *
 * Only visual edits are built: a sound swap changes nothing you can look at, and
 * building it would make every preview slower for no picture. The build is
 * temporary in the strong sense (see `foundry:buildTrayPreview`), and this hook
 * owns its lifetime: the previous build is released the moment a new one lands,
 * and the last one is released on unmount.
 */
export function useTrayPreview(
  edits: readonly FoundryStagedEdit[],
  enabled: boolean
): TrayPreview {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef<string | null>(null);

  // Serializing the request is also how we decide whether anything actually
  // changed: re-renders that do not alter the write set must not rebuild.
  const requestJson = useMemo(() => {
    const visual = edits.filter(isStagedVisualEdit);
    if (visual.length === 0) return '';
    const review = reviewStagedEdits(visual, new Set(visual.map((edit) => edit.id)));
    if (review.writeSet.length === 0) return '';
    return JSON.stringify(toForgeRequest('Foundry preview', review));
  }, [edits]);

  const replace = useCallback((id: string | null) => {
    const previous = activeId.current;
    activeId.current = id;
    setPreviewId(id);
    if (previous && previous !== id) void foundryReleaseTrayPreview(previous);
  }, []);

  useEffect(() => {
    if (!enabled || !requestJson) {
      replace(null);
      setBuilding(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setBuilding(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const id = await foundryBuildTrayPreview(JSON.parse(requestJson));
          // Superseded while building: the handle is still ours to release, and
          // dropping it on the floor would leak a temp directory until quit.
          if (cancelled) {
            void foundryReleaseTrayPreview(id);
            return;
          }
          replace(id);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          replace(null);
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (!cancelled) setBuilding(false);
        }
      })();
    }, REBUILD_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, requestJson, replace]);

  useEffect(
    () => () => {
      if (activeId.current) {
        void foundryReleaseTrayPreview(activeId.current);
        activeId.current = null;
      }
    },
    []
  );

  return { previewId, building, error };
}
