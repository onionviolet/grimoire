import { useEffect, useMemo, useRef, useState } from 'react';
import { listUnknownModFiles } from '../../lib/api';
import { isUnnamedPakName } from '../../lib/derivedPakName';
import type { Mod } from '../../types/mod';

/**
 * What each unnamed pak actually writes, read from its own VPK.
 *
 * A mod whose display name is only a pak slot (for example `Pak92`) has no
 * useful identity in its name: it says where the mod sits in the load order,
 * not what it does. In exactly that case the mod's own write set is the only
 * identity available, and the VPK directory is that write set. This is the
 * same move the Announcer-shelf classification fix made for the sound rail:
 * read the mod's own entries instead of trusting a label someone chose.
 *
 * Bounded deliberately, mirroring `useDiscoveredSoundPaths`:
 *
 * - candidates are mods whose name satisfies `isUnnamedPakName`, regardless of
 *   content kind, because an unnamed pak can hold anything;
 * - one call per mod, memoized for the life of the page by mod id, so a failed
 *   read never retries on every render;
 * - failures are silent and per-mod. An unreadable VPK never blocks the rest
 *   of the surface, and the derivation, not this hook, decides what to show.
 */
export function useUnnamedPakEntries(mods: readonly Mod[]): Record<string, string[]> {
  const [entries, setEntries] = useState<Record<string, string[]>>({});
  // Ids already asked about, successfully or not. Prevents a failed read from
  // retrying on every render.
  const asked = useRef(new Set<string>());

  const candidates = useMemo(
    () => mods.filter((mod) => isUnnamedPakName(mod.name)).map((mod) => mod.id),
    [mods]
  );

  useEffect(() => {
    const pending = candidates.filter((id) => !asked.current.has(id));
    if (pending.length === 0) return;
    for (const id of pending) asked.current.add(id);

    let cancelled = false;
    void (async () => {
      const found: Record<string, string[]> = {};
      for (const id of pending) {
        const listing = await listUnknownModFiles(id).catch(() => null);
        if (!listing) continue;
        // Store the returned paths verbatim, including an empty list: the
        // derivation decides between a description and the unknown label.
        found[id] = listing.paths;
      }
      if (!cancelled && Object.keys(found).length) {
        setEntries((current) => ({ ...current, ...found }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates]);

  return entries;
}
