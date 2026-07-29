import { analyzeStagedEdits, type FoundryStagedEdit } from '../foundry/buildTray';

/** A sound source identified by its metaKey plus the exact entries it writes. */
export interface SoundWriteSet {
  metaKey: string;
  files: string[];
}

export interface PickConsequence {
  /** Entries the candidate takes over from the applied source. */
  takenOver: number;
  /** Entries the applied source supplies that the candidate does not, and which
   *  therefore stop being overridden at all. */
  reverted: number;
}

/**
 * What picking `candidate` would do to what is applied now, computed from exact
 * normalized entry paths rather than from labels or classification counts.
 *
 * A pick rebuilds the whole (hero, slot) selection, so the applied source stops
 * supplying every entry it owned: the ones the candidate also writes are taken
 * over, and the ones it does not write revert to the game default. That second
 * half is the part users cannot see, so it is the part worth saying out loud.
 *
 * Reuses Foundry's `analyzeStagedEdits`, which is pure and has no Foundry
 * dependency, so the Locker and the build tray agree on what a collision is.
 * Null when there is nothing to overwrite (nothing applied, or the candidate is
 * already the applied source).
 */
export function pickConsequence(
  applied: SoundWriteSet | null,
  candidate: SoundWriteSet
): PickConsequence | null {
  if (!applied || applied.metaKey === candidate.metaKey) return null;
  const edits: FoundryStagedEdit[] = [
    {
      id: applied.metaKey,
      kind: 'sound',
      title: applied.metaKey,
      affectedFiles: applied.files,
      precedence: 0,
    },
    {
      id: candidate.metaKey,
      kind: 'sound',
      title: candidate.metaKey,
      affectedFiles: candidate.files,
      precedence: 1,
    },
  ];
  const contested = new Set(analyzeStagedEdits(edits).map((collision) => collision.file));
  // Count the applied source's own distinct entries, normalized the same way, so
  // a source listing an entry twice cannot inflate the "reverts" number.
  const appliedDistinct = new Set(
    applied.files.map((file) => file.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase())
  );
  return {
    takenOver: contested.size,
    reverted: Math.max(0, appliedDistinct.size - contested.size),
  };
}
