import type { Mod } from '../../types/mod';

export interface SelectionEntry {
  key: string;
  ids: readonly string[];
}

type SelectableEntry = { key: string } & (
  | { kind: 'single'; mod: { id: string } }
  | { kind: 'group'; variants: readonly { id: string }[] }
);

type Fingerprinted = Pick<Mod, 'id' | 'size' | 'installedAt'>;

/** Selected mod id to the fingerprint it had when it was selected. */
export type SelectionFingerprints = ReadonlyMap<string, string>;

export function entrySelectionIds(entry: SelectableEntry): string[] {
  return entry.kind === 'single' ? [entry.mod.id] : entry.variants.map((variant) => variant.id);
}

/** The entries a user can currently see: a collapsed section contributes nothing. */
export function visibleSelectionEntries(
  enabled: readonly SelectableEntry[],
  disabled: readonly SelectableEntry[],
  enabledCollapsed: boolean,
  disabledCollapsed: boolean,
): SelectionEntry[] {
  return [...(enabledCollapsed ? [] : enabled), ...(disabledCollapsed ? [] : disabled)]
    .map((entry) => ({ key: entry.key, ids: entrySelectionIds(entry) }));
}

// Renames and slot moves keep mtime and size, while a replaced file changes
// one of them. An id alone is not enough: it can end up behind a different mod.
export function modFingerprint(mod: Fingerprinted): string {
  return `${mod.size}|${mod.installedAt}`;
}

export function fingerprintSelection(
  ids: Iterable<string>,
  previous: SelectionFingerprints,
  mods: readonly Fingerprinted[],
): Map<string, string> {
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const next = new Map<string, string>();
  for (const id of ids) {
    const known = previous.get(id);
    const mod = byId.get(id);
    if (known !== undefined) next.set(id, known);
    else if (mod) next.set(id, modFingerprint(mod));
  }
  return next;
}

/** Drops ids that vanished or now point at a different file. Returns the same map when nothing changed. */
export function pruneStaleSelection(
  selection: SelectionFingerprints,
  mods: readonly Fingerprinted[],
): SelectionFingerprints {
  if (selection.size === 0) return selection;
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const kept = new Map<string, string>();
  for (const [id, fingerprint] of selection) {
    const mod = byId.get(id);
    if (mod && modFingerprint(mod) === fingerprint) kept.set(id, fingerprint);
  }
  return kept.size === selection.size ? selection : kept;
}

export function selectEntryRange(
  selected: ReadonlySet<string>,
  entries: readonly SelectionEntry[],
  anchorKey: string | null,
  target: SelectionEntry,
  shiftKey: boolean,
): Set<string> {
  const next = new Set(selected);
  const allSelected = target.ids.every((id) => selected.has(id));
  const anchorIndex = entries.findIndex((entry) => entry.key === anchorKey);
  const targetIndex = entries.findIndex((entry) => entry.key === target.key);
  if (shiftKey && anchorIndex >= 0 && targetIndex >= 0) {
    for (const entry of entries.slice(
      Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1,
    )) {
      entry.ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
    }
  } else {
    target.ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
  }
  return next;
}

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

interface ClickNode {
  closest?: (selector: string) => unknown;
}

/** Shift-click selects the card only for clicks on the card itself: React
 *  bubbles events from portals (open menus), and text fields keep their own
 *  shift-click behavior. */
export function isCardSelectClick(
  card: { contains: (node: never) => boolean },
  target: unknown,
): boolean {
  if (!card.contains(target as never)) return false;
  return !(target as ClickNode).closest?.(TEXT_ENTRY);
}
