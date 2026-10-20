export type WinnerButtonState = 'needsBoth' | 'wins' | 'globalLocked' | 'available';

/**
 * Global mods (citadel/grimoire) load before every numbered mod and
 * reorderMods leaves them out of the batch, so "make X win" only does
 * something when the other mod is not Global. A Global winner over a
 * non-Global mod already wins by index, so it lands in 'wins' first.
 */
export function winnerButtonState(
  bothEnabled: boolean,
  isWinner: boolean,
  otherIsGlobal: boolean
): WinnerButtonState {
  if (!bothEnabled) return 'needsBoth';
  if (isWinner) return 'wins';
  return otherIsGlobal ? 'globalLocked' : 'available';
}
