import { parseGameBananaItemUrl, type GameBananaItemRef } from '../types/gamebanana';

/**
 * Return the internal Browse route for a supported GameBanana item page.
 *
 * This is deliberately an item-page handoff, not a download handler. The
 * Browse details panel still shows the available files and requires the user
 * to explicitly choose Install before any download can begin.
 */
export function getGameBananaImportHandoff(url: string): {
  item: GameBananaItemRef;
  route: string;
} | null {
  const item = parseGameBananaItemUrl(url);
  if (!item) return null;

  return {
    item,
    route: `/browse?item=${encodeURIComponent(`${item.section}:${item.id}`)}`,
  };
}

/** Decode the narrow handoff query shape emitted above; reject arbitrary data. */
export function parseGameBananaImportHandoff(value: string | null): GameBananaItemRef | null {
  if (!value) return null;
  const match = /^(Mod|Sound|Wip):(\d+)$/.exec(value);
  if (!match) return null;

  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return { section: match[1], id };
}
