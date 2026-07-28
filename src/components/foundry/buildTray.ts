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

export function normalizeOutputName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  return cleaned || 'Foundry mod';
}

/** Resolve collisions without changing the supplied edit order or objects. */
export function analyzeStagedEdits(edits: readonly FoundryStagedEdit[]): BuildTrayCollision[] {
  const writers = new Map<string, FoundryStagedEdit[]>();
  for (const edit of edits) {
    for (const rawFile of edit.affectedFiles) {
      const file = rawFile.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!file) continue;
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
  return new Set(edits.flatMap((edit) => edit.affectedFiles.map((file) => file.replace(/\\/g, '/')))).size;
}
