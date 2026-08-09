import type { FoundryForgeEdit, FoundryForgeRequest } from '../../types/foundry';
import type { FoundryStagedSoundEdit } from './soundStagedEdit';
import type { RecolorStagedEdit } from './recolorStagedEdit';
import type { VisualStagedEdit } from './visualEdits';

/**
 * A source-mod-free description of work waiting to be forged.  The tray is
 * deliberately renderer-only: collecting edits must never disable, move, or
 * otherwise mutate an installed mod.  The eventual build IPC receives this
 * serializable shape only after the user presses Forge.
 */
export type FoundryEditKind = 'sound' | 'texture' | 'recolor' | 'model';

export interface FoundryStagedEdit {
  id: string;
  kind: FoundryEditKind;
  title: string;
  /** Exact VPK entries this edit will write, normalized with forward slashes. */
  affectedFiles: string[];
  /** Higher values win when multiple staged edits write the same entry. */
  precedence: number;
}

export interface BuildTrayCollision {
  file: string;
  winner: FoundryStagedEdit;
  overwritten: FoundryStagedEdit[];
}

/** The explicit review the user must see before a tray is forged. */
export interface BuildTrayReview {
  selected: FoundryStagedEdit[];
  /** The exact, normalized entries the output VPK will own. */
  writeSet: string[];
  collisions: BuildTrayCollision[];
}

/**
 * A tray selection is intentionally separate from catalogue selection.  A
 * catalogue search/filter must never accidentally turn into a bulk build.
 */
export function selectedStagedEdits(
  edits: readonly FoundryStagedEdit[],
  selectedIds: ReadonlySet<string>,
): FoundryStagedEdit[] {
  return edits.filter((edit) => selectedIds.has(edit.id));
}

export function reviewStagedEdits(
  edits: readonly FoundryStagedEdit[],
  selectedIds: ReadonlySet<string>,
): BuildTrayReview {
  const selected = selectedStagedEdits(edits, selectedIds);
  return {
    selected,
    writeSet: [...new Set(selected.flatMap((edit) => edit.affectedFiles.map(normalizeEntryPath)))].filter(Boolean).sort(),
    collisions: analyzeStagedEdits(selected),
  };
}

export function normalizeEntryPath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

export function normalizeOutputName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  return cleaned || 'Foundry mod';
}

/** Resolve collisions without changing the supplied edit order or objects. */
export function analyzeStagedEdits(edits: readonly FoundryStagedEdit[]): BuildTrayCollision[] {
  const writers = new Map<string, FoundryStagedEdit[]>();
  for (const edit of edits) {
    // An authoring flow may list the same logical entry with slash variants.
    // That is one writer, not a collision with itself.
    const files = new Set(edit.affectedFiles.map(normalizeEntryPath).filter(Boolean));
    for (const file of files) {
      writers.set(file, [...(writers.get(file) ?? []), edit]);
    }
  }
  return [...writers.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([file, entries]) => {
      // Stable tie break: the later staged edit is the deliberate last writer.
      const ranked = entries
        .map((edit, index) => ({ edit, index }))
        .sort((a, b) => a.edit.precedence - b.edit.precedence || a.index - b.index);
      const winner = ranked.at(-1)!.edit;
      return { file, winner, overwritten: ranked.slice(0, -1).map(({ edit }) => edit) };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

export function affectedFileCount(edits: readonly FoundryStagedEdit[]): number {
  return new Set(edits.flatMap((edit) => edit.affectedFiles.map(normalizeEntryPath)).filter(Boolean)).size;
}

/**
 * Both live authoring flows land in the same tray, so the tray (not each
 * browse panel) is what decides whether a staged edit is buildable.  These two
 * guards are the only place that decision is made, and they key off the
 * serialized payload rather than the label so a renamed edit stays buildable.
 */
export function isStagedSoundEdit(edit: FoundryStagedEdit): edit is FoundryStagedSoundEdit {
  return edit.kind === 'sound' && 'request' in edit;
}

export function isStagedVisualEdit(edit: FoundryStagedEdit): edit is VisualStagedEdit {
  return edit.kind === 'texture' && 'source' in edit;
}

export function isStagedRecolorEdit(edit: FoundryStagedEdit): edit is RecolorStagedEdit {
  return edit.kind === 'recolor' && 'request' in edit;
}

/** The first staged edit the forge cannot build yet, so the tray can name the
 *  kind instead of failing inside the build with a generic error. */
export function unsupportedStagedEditKind(edits: readonly FoundryStagedEdit[]): FoundryEditKind | null {
  return edits.find(
    (edit) => !isStagedSoundEdit(edit) && !isStagedVisualEdit(edit) && !isStagedRecolorEdit(edit),
  )?.kind ?? null;
}

/**
 * Every file on disk the build still has to read.  A staged edit records a path
 * rather than the bytes, so a file the user moved or deleted between staging
 * and forging would otherwise blow up halfway through the build.  The tray
 * checks these first and blocks with the names.
 */
export function stagedEditSourceFiles(edits: readonly FoundryStagedEdit[]): string[] {
  const files: string[] = [];
  for (const edit of edits) {
    if (isStagedSoundEdit(edit)) {
      // Assignments are the authoritative write set (audioPath is only the
      // single-donor fallback), so collect both and dedupe.
      files.push(edit.request.audioPath);
      for (const assignment of edit.request.assignments ?? []) files.push(assignment.audioPath);
    } else if (isStagedVisualEdit(edit)) {
      files.push(edit.source.imagePath);
    }
    // A recolor edit deliberately contributes nothing here: its inputs are
    // numeric picker parameters (hue/saturation/brightness/mode), already
    // resolved to the shared per-hero bake cache main owns, not user files on
    // disk that could move or vanish between staging and forging.
  }
  return [...new Set(files.filter((file) => typeof file === 'string' && file.trim().length > 0))];
}

/**
 * Which staged source files the still-on-disk check did not find.  The check
 * answers with the files that survived, so absence is the signal: a path the
 * responder never mentions is missing, and a responder that omits everything
 * blocks everything rather than quietly building half a mod.
 */
export function missingSourceFiles(requested: readonly string[], present: readonly string[]): string[] {
  const found = new Set(present);
  return requested.filter((file) => !found.has(file));
}

/**
 * Turn the reviewed selection into the typed build request.  Main re-derives
 * the same review from `edits` and refuses a `confirmation` that no longer
 * matches, so this must serialize exactly what the user just read: the same
 * normalized paths, the same collision winners.
 */
export function toForgeRequest(name: string, review: BuildTrayReview): FoundryForgeRequest {
  const edits: FoundryForgeEdit[] = review.selected.map((edit) => {
    if (isStagedSoundEdit(edit)) return { id: edit.id, kind: 'sound', precedence: edit.precedence, request: edit.request };
    if (isStagedVisualEdit(edit)) return { id: edit.id, kind: 'texture', precedence: edit.precedence, request: edit.source };
    if (isStagedRecolorEdit(edit)) return { id: edit.id, kind: 'recolor', precedence: edit.precedence, request: edit.request };
    // Unreachable via the UI (it pre-checks with unsupportedStagedEditKind),
    // but never guess a build for a kind the forge does not implement.
    throw new Error(`Unsupported staged edit kind: ${edit.kind}`);
  });
  return {
    name: normalizeOutputName(name),
    edits,
    confirmation: {
      writeSet: review.writeSet.map(normalizeEntryPath),
      collisionWinners: review.collisions.map(({ file, winner }) => ({ file: normalizeEntryPath(file), editId: winner.id })),
    },
  };
}
