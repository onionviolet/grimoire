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
