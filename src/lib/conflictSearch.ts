import type { ModConflict } from './api';
import type { Mod } from '../types/mod';

export interface ConflictSearchCandidate {
  conflictType: 'priority' | 'file';
  details: string;
  files?: string[];
  modA: ConflictSearchMod;
  modB: ConflictSearchMod;
}

export interface ConflictSearchMod {
  name: string;
  fileName?: string;
  sourceFileName?: string;
  variantLabel?: string | null;
}

export interface ConflictSearchResult {
  matches: boolean;
  /** Paths that caused this result to match, for an explainable result card. */
  matchingPaths: string[];
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Search the information a person can use to identify a conflict. This stays
 * deliberately separate from conflict detection: callers filter an existing
 * result set and never start another VPK scan while a query changes.
 */
export function searchConflict(
  candidate: ConflictSearchCandidate,
  query: string,
): ConflictSearchResult {
  const needle = normalize(query);
  if (!needle) return { matches: true, matchingPaths: [] };

  const matchingPaths = (candidate.files ?? []).filter((path) =>
    normalize(path).includes(needle),
  );
  const typeLabels = candidate.conflictType === 'file'
    ? ['file', 'shared file']
    : ['priority', 'same slot', 'load order'];
  const text = [
    candidate.details,
    candidate.conflictType,
    ...typeLabels,
    candidate.modA.name,
    candidate.modA.fileName,
    candidate.modA.sourceFileName,
    candidate.modA.variantLabel ?? '',
    candidate.modB.name,
    candidate.modB.fileName,
    candidate.modB.sourceFileName,
    candidate.modB.variantLabel ?? '',
  ].join('\n').toLocaleLowerCase();

  return { matches: matchingPaths.length > 0 || text.includes(needle), matchingPaths };
}

/**
 * Filter a conflict list by mod name, VPK filename or shared path. A mod-name
 * hit keeps the full shared-file list; a path-only hit narrows it to the
 * matching files. The Conflicts page uses {@link searchConflict}; this is the
 * list-narrowing form.
 */
export function searchConflicts(
  conflicts: readonly ModConflict[],
  mods: ReadonlyMap<string, Pick<Mod, 'name' | 'fileName'>>,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  return conflicts.flatMap((conflict) => {
    const files = conflict.files ?? [];
    const modA = mods.get(conflict.modA);
    const modB = mods.get(conflict.modB);
    const matchesMod = [
      conflict.modAName, conflict.modBName,
      modA?.name, modB?.name, modA?.fileName, modB?.fileName,
    ].some((value) => value?.toLowerCase().includes(needle));
    if (!needle || matchesMod) return [{ conflict, files, fileMatch: false }];
    const matchingFiles = files.filter((file) => file.toLowerCase().includes(needle));
    return matchingFiles.length > 0 ? [{ conflict, files: matchingFiles, fileMatch: true }] : [];
  });
}
