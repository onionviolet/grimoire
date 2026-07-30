import { create } from 'zustand';

/**
 * Which installed skin VPKs have been seen to break the live 3D pose preview.
 *
 * The Locker's only failure surface used to be the model viewer itself, so a
 * skin whose model cannot be posed looked exactly like a hero nobody has built
 * a recipe for. The valuable half of that distinction belongs in the grid: a
 * badge on the skin card means you find out before you launch the game, which
 * is the point of a locker.
 *
 * Written by HeroPoseViewer, which is the only place that learns a skin is
 * broken (it exports the stack, and on failure narrows down which VPK is at
 * fault). Read by the skin cards. Keyed by `metaKey` because that is the stable
 * per-installed-VPK identity the pose export already takes.
 *
 * Persisted, so a skin stays flagged after you close the panel or the app: the
 * discovery only happens while the viewer is open, and a badge that vanished on
 * navigation would almost never be seen. A later export that succeeds with the
 * skin in the stack clears its mark, so the flag heals itself once the user
 * updates the mod.
 */

const STORAGE_KEY = 'grimoire.locker.brokenPoseSkins';

export interface BrokenPoseSkin {
  /** The hero the failure was observed on, for the mark's own provenance. */
  heroName: string;
  /** Epoch ms, so a future settings action can expire or list these. */
  at: number;
}

export type BrokenPoseSkins = Record<string, BrokenPoseSkin>;

/** Sanitize a stored blob into marks we are willing to badge a card with.
 *  Exported for its own test: this is the only place hand-edited or
 *  older-format localStorage can leak into the UI. */
export function parseStoredBrokenSkins(raw: string | null): BrokenPoseSkins {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: BrokenPoseSkins = {};
  for (const [metaKey, value] of Object.entries(parsed as Record<string, unknown>)) {
    const v = value as Partial<BrokenPoseSkin> | null;
    if (typeof v?.heroName === 'string' && typeof v?.at === 'number') {
      out[metaKey] = { heroName: v.heroName, at: v.at };
    }
  }
  return out;
}

function readStored(): BrokenPoseSkins {
  try {
    return parseStoredBrokenSkins(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function writeStored(broken: BrokenPoseSkins): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(broken));
  } catch {
    /* ignore quota/availability errors */
  }
}

interface PoseFailureState {
  broken: BrokenPoseSkins;
  /** Flag these VPKs as unable to be posed. No-op for an empty list. */
  markBroken: (heroName: string, metaKeys: string[], at?: number) => void;
  /** Clear the flag, e.g. after a stack containing them exported cleanly. */
  clearBroken: (metaKeys: string[]) => void;
}

export const usePoseFailureStore = create<PoseFailureState>((set) => ({
  broken: readStored(),

  markBroken: (heroName, metaKeys, at = Date.now()) =>
    set((state) => {
      const fresh = metaKeys.filter((key) => key && !state.broken[key]);
      if (fresh.length === 0) return state;
      const broken = { ...state.broken };
      for (const key of fresh) broken[key] = { heroName, at };
      writeStored(broken);
      return { broken };
    }),

  clearBroken: (metaKeys) =>
    set((state) => {
      const stale = metaKeys.filter((key) => state.broken[key]);
      if (stale.length === 0) return state;
      const broken = { ...state.broken };
      for (const key of stale) delete broken[key];
      writeStored(broken);
      return { broken };
    }),
}));
