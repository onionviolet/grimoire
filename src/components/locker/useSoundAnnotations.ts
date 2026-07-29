import { useEffect, useState } from 'react';
import { foundrySoundAnnotations } from '../../lib/api';
import type { SoundAnnotation } from '../../types/foundry';

/**
 * Personal names and notes for sound events, keyed the way `SoundEntryRow`
 * looks them up.
 *
 * The IPC call answers with a `{ key, annotation }` list, not a record, so the
 * keying happens here. Both sound shelves used to inline this fetch and both
 * stored the raw list, which typechecks as an array and then never matches a
 * lookup, so no personal label ever rendered. One hook, one shape.
 *
 * A failure is not fatal: annotations are provenance detail, and the rows fall
 * back to the raw event paths, so the inventory is never blanked over one.
 */
export function useSoundAnnotations(): Record<string, SoundAnnotation> {
  const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});

  useEffect(() => {
    let active = true;
    foundrySoundAnnotations()
      .then((entries) => {
        if (!active) return;
        const byKey: Record<string, SoundAnnotation> = {};
        for (const entry of entries) byKey[entry.key] = entry.annotation;
        setAnnotations(byKey);
      })
      .catch(() => {
        // Provenance detail only; never blank the inventory over it.
      });
    return () => {
      active = false;
    };
  }, []);

  return annotations;
}
