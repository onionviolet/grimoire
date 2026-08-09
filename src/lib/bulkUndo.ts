import type { GlobalModType, Mod } from '../types/mod';

/**
 * One-shot local undo for a single reversible bulk mutation.
 *
 * This is deliberately NOT a history system: a snapshot is captured right
 * before one batch runs, lives in component state next to its toast, and is
 * dropped when that toast goes away. The permanent multi-step history idea is
 * explicitly out of scope for this phase (D-14). Restores replay a live diff
 * against the current mod list so a change the user made by hand between the
 * batch and the undo is never silently stomped.
 */

/** The three fields the reversible bulk handlers write, normalized so a diff
 *  never has to reason about undefined against null. */
export interface BulkModSnapshot {
  modId: string;
  enabled: boolean;
  lockerHero: string | null;
  globalType: GlobalModType | null;
}

/** A closed three-member operation union, one member per mutator the five
 *  reversible bulk handlers already call. The toggle variant carries no target
 *  value because the store mutator is a flip, and the plan only ever emits it
 *  when the live value differs from the snapshot, which makes a flip the
 *  correct restore. */
export type BulkUndoOp =
  | { kind: 'toggle'; modId: string }
  | { kind: 'lockerHero'; modId: string; value: string | null }
  | { kind: 'globalType'; modId: string; value: GlobalModType | null };

/** Capture the pre-batch state of the selected mods from the mod list the
 *  caller already holds. An id that is not in the list records nothing for it,
 *  and absent optional fields normalize to null. */
export function captureBulkSnapshot(
  mods: readonly Mod[],
  ids: Iterable<string>,
): BulkModSnapshot[] {
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const snapshot: BulkModSnapshot[] = [];
  for (const id of ids) {
    const mod = byId.get(id);
    if (!mod) continue;
    snapshot.push({
      modId: id,
      enabled: mod.enabled,
      lockerHero: mod.lockerHero ?? null,
      globalType: mod.globalType ?? null,
    });
  }
  return snapshot;
}

/** Build the minimal restore plan that takes the live mods back to the
 *  snapshot: at most one operation per differing field per mod, in a stable
 *  order (toggle, then lockerHero, then globalType) so a restore that clears a
 *  global type and re-applies a hero tag runs predictably. A mod that is no
 *  longer present in the live list is skipped entirely. */
export function bulkUndoPlan(
  snapshot: readonly BulkModSnapshot[],
  current: readonly Mod[],
): BulkUndoOp[] {
  const byId = new Map(current.map((mod) => [mod.id, mod]));
  const ops: BulkUndoOp[] = [];
  for (const row of snapshot) {
    const mod = byId.get(row.modId);
    if (!mod) continue;
    if (mod.enabled !== row.enabled) {
      ops.push({ kind: 'toggle', modId: row.modId });
    }
    const lockerHero = mod.lockerHero ?? null;
    if (lockerHero !== row.lockerHero) {
      ops.push({ kind: 'lockerHero', modId: row.modId, value: row.lockerHero });
    }
    const globalType = mod.globalType ?? null;
    if (globalType !== row.globalType) {
      ops.push({ kind: 'globalType', modId: row.modId, value: row.globalType });
    }
  }
  return ops;
}

/** How many distinct mods differ from their snapshot. The toast count comes
 *  from this rather than from the plan length, because a mod whose retag moved
 *  two fields is still one mod to the user. */
export function bulkChangedCount(
  snapshot: readonly BulkModSnapshot[],
  current: readonly Mod[],
): number {
  const byId = new Map(current.map((mod) => [mod.id, mod]));
  let count = 0;
  for (const row of snapshot) {
    const mod = byId.get(row.modId);
    if (!mod) continue;
    const differs =
      mod.enabled !== row.enabled ||
      (mod.lockerHero ?? null) !== row.lockerHero ||
      (mod.globalType ?? null) !== row.globalType;
    if (differs) count += 1;
  }
  return count;
}
