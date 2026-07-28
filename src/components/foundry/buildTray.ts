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
