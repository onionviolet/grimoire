import type { HeroSoundSwapRequest } from '../../types/foundry';
import type { FoundryStagedEdit } from './buildTray';
import { normalizeEntryPath } from './buildTray';

/**
 * Serializable sound work ready for the combined-output tray.  It deliberately
 * records the resolved clip assignments rather than an event name: an event can
 * be a randomizer pool and a later catalog refresh must not change the reviewed
 * write set.
 */
export interface FoundryStagedSoundEdit extends FoundryStagedEdit {
  kind: 'sound';
  request: HeroSoundSwapRequest;
}

export interface SoundStagedEditInput {
  id: string;
  title: string;
  /** Later edits intentionally win identical compiled clip paths in the tray. */
  precedence: number;
  request: HeroSoundSwapRequest;
}

/** Convert source catalog paths to the compiled VPK entries a sound forge writes. */
export function compiledSoundEntry(path: string): string {
  return normalizeEntryPath(path).replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');
}

/**
 * Make the reviewed tray representation for an already-valid sound forge
 * request.  The caller must provide explicit assignments; this is what makes
 * selected-target and seeded-library pools stable and safe to defer.
 */
export function serializeSoundStagedEdit(input: SoundStagedEditInput): FoundryStagedSoundEdit {
  const assignments = input.request.assignments ?? [];
  if (!input.id.trim()) throw new Error('A staged sound edit needs an id');
  if (!input.title.trim()) throw new Error('A staged sound edit needs a title');
  if (!assignments.length) {
    throw new Error('A staged sound edit needs explicit clip assignments');
  }

  return {
    id: input.id,
    kind: 'sound',
    title: input.title.trim(),
    precedence: input.precedence,
    affectedFiles: [...new Set(assignments.map((assignment) => compiledSoundEntry(assignment.clipPath)).filter(Boolean))].sort(),
    // Copy nested arrays so a panel changing its selected targets cannot mutate
    // a previously reviewed staged edit.
    request: {
      ...input.request,
      assignments: assignments.map((assignment) => ({ ...assignment })),
    },
  };
}
