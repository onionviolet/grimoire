import type { FoundryAssetSourcesInspection } from '../../types/foundry';
import type { Mod } from '../../types/mod';
import {
  foundryChangeEntries,
  foundryShuffleKey,
  groupFoundryShufflePools,
  isFoundryChange,
} from '../../lib/foundryChanges';
import type { FoundryChangeEntry, FoundryChangeKind } from './changeList';

/**
 * The read model behind the pool-first mode of `My changes`.
 *
 * A pool is not a new idea invented here: it is exactly what
 * `groupFoundryShufflePools` already computes for the launch planner, which is
 * the set of changes contending for the same exact VPK entry paths. This module
 * only reshapes those pools for display, so the card a user reads and the group
 * the launch shuffle acts on can never disagree. Nothing here re-derives
 * grouping, ownership, or winners: grouping comes from the planner and winners
 * come from the same `foundryInspectAssetSources` result the flat list's detail
 * panel already resolves.
 *
 * Everything is pure. The component supplies the mods, the visible change rows,
 * and the persisted opt-in set, and gets back cards it can render directly.
 */

export interface FoundryPoolMember {
  /** Stable pool-membership identity, the same key the launch opt-in stores. */
  key: string;
  mod: Mod;
  /** Change rows this member contributes. A multi-part build has several. */
  changes: FoundryChangeEntry[];
  /** What to call this alternative. One row means the row's own title. */
  title: string;
  kind: FoundryChangeKind;
  /** Exact normalized entries this member alone claims. */
  entries: string[];
  /** The recorded source file, when the member has exactly one. Lane D reads
   *  this to derive a thumbnail or an audition target. */
  sourceFileName?: string;
  heroName?: string;
  enabled: boolean;
  inShuffle: boolean;
  /** False when the member is outside the caller's current filter/search/hero
   *  scope. It is still shown: hiding an alternative would misrepresent what
   *  the pool actually contains. */
  matched: boolean;
}

export interface FoundryPoolCard {
  /** Stable across renders and independent of pakNN-derived mod ids. */
  id: string;
  members: FoundryPoolMember[];
  /** Every exact path the pool covers, as the planner reports it. */
  entries: string[];
  /** The subset written by more than one member: the genuinely contended
   *  paths, which is what the alternatives are alternatives *for*. */
  contendedEntries: string[];
  /** A pool of one has no alternatives to decide between. */
  single: boolean;
  allIncluded: boolean;
  anyIncluded: boolean;
}

export interface FoundryPoolView {
  pools: FoundryPoolCard[];
  /** Visible changes that belong to no pool at all, with the reason. Today the
   *  only reason is an unrecorded write set: a change whose paths are known is
   *  always in a pool, even if that pool has one member. */
  unpooled: Array<{ entry: FoundryChangeEntry; reason: 'no-recorded-paths' }>;
}

export interface FoundryPoolViewOptions {
  /** The whole installed list. Pools are global truth, so they are never
   *  computed from a filtered subset. */
  mods: readonly Mod[];
  /** The change rows currently visible (after filter, search, hero scope). */
  changes: readonly FoundryChangeEntry[];
  /** Persisted launch-pool opt-in keys. */
  included: ReadonlySet<string>;
}

export function buildFoundryPoolView({ mods, changes, included }: FoundryPoolViewOptions): FoundryPoolView {
  const visibleModIds = new Set(changes.map((entry) => entry.mod.id));
  const changesByModId = new Map<string, FoundryChangeEntry[]>();
  for (const entry of changes) {
    changesByModId.set(entry.mod.id, [...(changesByModId.get(entry.mod.id) ?? []), entry]);
  }

  const pools: FoundryPoolCard[] = [];
  for (const pool of groupFoundryShufflePools(mods)) {
    // Only surface a pool the user can currently see something of. Its other
    // members still render, because a pool that hid half its alternatives
    // would be lying about what the launch shuffle will do.
    if (!pool.mods.some((mod) => visibleModIds.has(mod.id))) continue;

    const counts = new Map<string, number>();
    for (const mod of pool.mods) {
      for (const path of foundryChangeEntries(mod)) counts.set(path, (counts.get(path) ?? 0) + 1);
    }

    const members: FoundryPoolMember[] = pool.mods.map((mod) => {
      const rows = changesByModId.get(mod.id) ?? [];
      const sourceFiles = [...new Set(rows.map((row) => row.sourceFileName).filter((name): name is string => Boolean(name)))];
      return {
        key: foundryShuffleKey(mod),
        mod,
        changes: rows,
        title: rows.length === 1 ? rows[0].title : mod.name,
        kind: rows.length && rows.every((row) => row.kind === 'sound') ? 'sound' : 'texture',
        entries: foundryChangeEntries(mod),
        sourceFileName: sourceFiles.length === 1 ? sourceFiles[0] : undefined,
        heroName: rows.find((row) => row.heroName)?.heroName,
        enabled: mod.enabled,
        inShuffle: included.has(foundryShuffleKey(mod)),
        matched: visibleModIds.has(mod.id),
      };
    });

    pools.push({
      id: `pool:${members.map((member) => member.key).slice().sort().join('|')}`,
      members,
      entries: pool.entries,
      contendedEntries: [...counts.entries()].filter(([, count]) => count > 1).map(([path]) => path).sort(),
      single: members.length < 2,
      allIncluded: members.every((member) => member.inShuffle),
      anyIncluded: members.some((member) => member.inShuffle),
    });
  }

  const unpooled = changes
    .filter((entry) => isFoundryChange(entry.mod) && foundryChangeEntries(entry.mod).length === 0)
    .map((entry) => ({ entry, reason: 'no-recorded-paths' as const }));

  return { pools, unpooled };
}

/**
 * The pool-level opt-in. Toggling a pool means "every member or none of them",
 * because a member left out would stay enabled and win the contended path by
 * load order while the shuffle appeared to do nothing. Returns the keys to hand
 * to the store's per-key toggle, so the store stays the single writer.
 */
export function poolShuffleToggle(card: FoundryPoolCard): { keys: string[]; include: boolean } {
  const missing = [...new Set(card.members.filter((member) => !member.inShuffle).map((member) => member.key))];
  if (missing.length > 0) return { keys: missing, include: true };
  return { keys: [...new Set(card.members.map((member) => member.key))], include: false };
}

export interface FoundryPoolPathWinner {
  path: string;
  /** The winning installed mod, or null when no enabled VPK owns the path and
   *  the base-game asset wins. */
  modId: string | null;
  ownerName: string | null;
  /** Set when the winner is a member of this pool. */
  memberKey: string | null;
}

export interface FoundryPoolWinners {
  byPath: FoundryPoolPathWinner[];
  /** Paths each member currently wins, keyed by membership key. */
  winsByMemberKey: Map<string, string[]>;
  /** Contended paths taken by a mod outside the pool. The shuffle cannot fix
   *  these, so they have to be named rather than implied. */
  foreign: FoundryPoolPathWinner[];
}

/**
 * Mark the runtime winner from an inspection this module did not perform. The
 * inspection is the same `foundryInspectAssetSources` call the flat list's
 * detail panel makes, so pool view and row view cannot disagree about who wins
 * an exact path.
 */
export function resolvePoolWinners(
  card: FoundryPoolCard,
  inspection: FoundryAssetSourcesInspection | null,
): FoundryPoolWinners {
  const byPath: FoundryPoolPathWinner[] = [];
  const winsByMemberKey = new Map<string, string[]>();
  const foreign: FoundryPoolPathWinner[] = [];
  if (!inspection) return { byPath, winsByMemberKey, foreign };

  const memberByModId = new Map(card.members.map((member) => [member.mod.id, member]));
  for (const path of card.entries) {
    if (!(path in inspection.winners)) continue;
    const modId = inspection.winners[path];
    const member = modId ? memberByModId.get(modId) : undefined;
    const ownerName = modId
      ? (inspection.sources.find((source) => source.modId === modId)?.modName ?? member?.mod.name ?? modId)
      : null;
    const resolved: FoundryPoolPathWinner = {
      path,
      modId: modId ?? null,
      ownerName,
      memberKey: member?.key ?? null,
    };
    byPath.push(resolved);
    if (member) winsByMemberKey.set(member.key, [...(winsByMemberKey.get(member.key) ?? []), path]);
    else if (modId) foreign.push(resolved);
  }
  return { byPath, winsByMemberKey, foreign };
}
