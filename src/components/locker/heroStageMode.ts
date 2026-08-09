import { useCallback, useState } from 'react';
import type { ModelPanelSurface } from './useModelPanelOpen';

/**
 * Remembered stage presentation for a hero-detail surface: live 3D model on
 * the plate, or the 2D image chain.
 *
 * This is deliberately a NEW key rather than a reinterpretation of
 * `useModelPanelOpen`'s boolean. That boolean still means "is the floating
 * panel open", its meaning is unchanged and still used (it becomes the
 * pop-out state), and silently reinterpreting a stored value is how a user
 * gets a preference they never expressed. The two keys stay siblings: mode
 * says what fills the stage, panel-open says whether the model was popped
 * out of it.
 */
export type HeroStageMode = 'model' | 'image';

export function heroStageModeStorageKey(surface: ModelPanelSurface): string {
  return `grimoire.${surface}.heroStage.mode`;
}

/**
 * Per-surface default, per D-02: the Locker makes the model the primary stage
 * when it can load, and Foundry keeps the preview lazy and opt-in so the 2D
 * image stays the first thing a user sees there.
 */
export function defaultHeroStageMode(surface: ModelPanelSurface): HeroStageMode {
  return surface === 'locker' ? 'model' : 'image';
}

function readStored(surface: ModelPanelSurface): HeroStageMode {
  try {
    const raw = localStorage.getItem(heroStageModeStorageKey(surface));
    // Validate against the two-member union on every read: a hand-edited or
    // corrupted entry yields the surface default, and no string from storage
    // ever reaches rendering or an IPC argument.
    if (raw === 'model' || raw === 'image') return raw;
  } catch {
    /* ignore unavailable storage */
  }
  return defaultHeroStageMode(surface);
}

/** Read the persisted mode once. Exposed for tests and one-shot reads. */
export function readHeroStageMode(surface: ModelPanelSurface): HeroStageMode {
  return readStored(surface);
}

export function useHeroStageMode(
  surface: ModelPanelSurface
): [HeroStageMode, (next: HeroStageMode) => void] {
  const [mode, setMode] = useState<HeroStageMode>(() => readStored(surface));

  const set = useCallback(
    (next: HeroStageMode) => {
      setMode(next);
      try {
        localStorage.setItem(heroStageModeStorageKey(surface), next);
      } catch {
        /* ignore quota/availability errors */
      }
    },
    [surface]
  );

  return [mode, set];
}
