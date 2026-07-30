import { useEffect, useMemo, useRef, useState } from 'react';
import { listUnknownModFiles } from '../../lib/api';
import { isSoundContent, soundEntriesInVpk } from '../../lib/soundInventory';
import type { Mod } from '../../types/mod';

/**
 * What each sound mod actually writes, read from its own VPK.
 *
 * A downloaded or imported sound VPK records nothing about its write set, so
 * classification had only the GameBanana category name to go on: a marketing
 * label, which is how six item-sound mods came to sit on the Announcer shelf.
 * The VPK directory is the mod's own statement of what it writes, and the main
 * process already parses and caches those directories for the Installed page
 * and the conflict scanner, so this is a read of something already in memory
 * rather than new work.
 *
 * Bounded deliberately:
 *
 * - only sound mods, and only the ones with no recorded paths;
 * - one call per mod, memoized for the life of the page by mod id, so switching
 *   category or hero never re-reads;
 * - failures are silent and per-mod. An unreadable VPK leaves that mod
 *   unclassified, which is exactly what it was before, and never blocks the
 *   rest of the shelf.
 */
export function useDiscoveredSoundPaths(mods: readonly Mod[]): Record<string, string[]> {
  const [discovered, setDiscovered] = useState<Record<string, string[]>>({});
  // Ids already asked about, successfully or not. Prevents a failed read from
  // retrying on every render.
  const asked = useRef(new Set<string>());

  const candidates = useMemo(
    () =>
      mods
        .filter((mod) => isSoundContent(mod) && !mod.lockerSounds && !mod.soundSwap)
        .map((mod) => mod.id),
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
        const sounds = soundEntriesInVpk(listing.paths);
        if (sounds.length) found[id] = sounds;
      }
      if (!cancelled && Object.keys(found).length) {
        setDiscovered((current) => ({ ...current, ...found }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates]);

  return discovered;
}
