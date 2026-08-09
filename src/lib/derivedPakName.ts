/**
 * Identity for imported paks that have no useful name (D-19).
 *
 * A downloaded VPK whose filename is only a load-order slot (for example
 * `pak92_dir.vpk`) reaches the UI titled like `Pak92`: the suffix is stripped
 * and the remainder is title-cased. Such a name says where the mod sits in the
 * load order, not what it does, so this module derives a description from the
 * exact entry paths that mod actually writes. The rule D-19 states: a
 * description is derived from exact paths when possible, the raw pak name is
 * kept as secondary identity by the caller, and unknown data is labelled
 * unknown rather than guessed.
 */

/**
 * True when the trimmed name is exactly the word "pak" followed by one or more
 * digits, case-insensitively.
 *
 * This is the precise shape `extractModName` in `electron/main/services/mods.ts`
 * produces for a `pakNN_dir.vpk` with no other name: the `_dir.vpk` suffix is
 * stripped, the `name.length > 5` guard does not fire for a five-character
 * `pakNN`, and the title-casing step yields `PakNN`. Matching that exact shape
 * keeps a real mod named something like `Pak Rat` untouched.
 */
export function isUnnamedPakName(name: string | null | undefined): boolean {
  if (name == null) return false;
  return /^pak\d+$/i.test(name.trim());
}

export type DerivedPakDescription =
  | { kind: 'derived'; entries: string[]; extra: number }
  | { kind: 'unknown' };

/**
 * Reduce VPK-internal entry paths to a capped, sorted list of leaf names.
 *
 * Only the leaf name of each entry is ever surfaced, never a full filesystem
 * path. Leaves are de-duplicated and sorted so the description is stable
 * regardless of the order the VPK directory reports, and the visible list is
 * capped at `limit` entries with the remainder stated as a count rather than
 * truncated silently. An empty result returns the unknown variant: a pak whose
 * entries cannot be read, or that reads back nothing, is labelled unknown, not
 * given a guessed description.
 */
export function derivePakDescription(
  paths: readonly string[],
  limit = 3
): DerivedPakDescription {
  const leaves = [
    ...new Set(
      paths
        .map((path) => path.slice(path.lastIndexOf('/') + 1))
        .filter((leaf) => leaf.length > 0)
    ),
  ].sort();
  if (leaves.length === 0) return { kind: 'unknown' };
  return {
    kind: 'derived',
    entries: leaves.slice(0, limit),
    extra: Math.max(0, leaves.length - limit),
  };
}
