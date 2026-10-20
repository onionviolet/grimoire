import { useMemo, useRef, useState } from 'react';
import { useStableCallback } from '../../lib/useStableCallback';
import type { Mod } from '../../types/mod';
import {
  fingerprintSelection,
  pruneStaleSelection,
  selectEntryRange,
  type SelectionEntry,
  type SelectionFingerprints,
} from './selection';

const NONE: SelectionFingerprints = new Map();

export function useInstalledSelection(
  mods: readonly Mod[],
  getVisibleEntries: () => readonly SelectionEntry[],
) {
  const [selection, setSelection] = useState<SelectionFingerprints>(NONE);
  const anchorKey = useRef<string | null>(null);
  const getMods = useStableCallback(() => mods);
  const selectedIds = useMemo(
    () => new Set(pruneStaleSelection(selection, mods).keys()),
    [selection, mods],
  );
  const setSelectedIds = useStableCallback((ids: Set<string>) => {
    anchorKey.current = null;
    setSelection((previous) => {
      const live = pruneStaleSelection(previous, getMods());
      return fingerprintSelection(ids, live, getMods());
    });
  });
  const toggleSelection = useStableCallback((target: SelectionEntry, shiftKey: boolean) => {
    const entries = getVisibleEntries();
    const anchor = anchorKey.current;
    setSelection((previous) => {
      const live = pruneStaleSelection(previous, getMods());
      return fingerprintSelection(
        selectEntryRange(new Set(live.keys()), entries, anchor, target, shiftKey),
        live,
        getMods(),
      );
    });
    if (!shiftKey || !entries.some((entry) => entry.key === anchor)) {
      anchorKey.current = target.key;
    }
  });
  return { selectedIds, setSelectedIds, toggleSelection };
}
