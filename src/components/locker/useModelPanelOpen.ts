import { useCallback, useState } from 'react';

/**
 * Remembered open/closed state for a surface's live 3D model panel.
 *
 * The panel used to start closed on every visit, so the 3D preview read as
 * missing unless you knew to hunt for the toggle: the feature was there, it
 * just never showed itself. The panel already persists its geometry, so
 * persisting whether it was open is the matching half. Keyed per surface
 * because the Locker and the Foundry workshop are separate habits.
 */
export type ModelPanelSurface = 'locker' | 'foundry';

const storageKey = (surface: ModelPanelSurface) => `grimoire.${surface}.modelPanel.open`;

function readStored(surface: ModelPanelSurface): boolean {
  try {
    return localStorage.getItem(storageKey(surface)) === '1';
  } catch {
    return false;
  }
}

export function useModelPanelOpen(surface: ModelPanelSurface): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(() => readStored(surface));

  const set = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        localStorage.setItem(storageKey(surface), next ? '1' : '0');
      } catch {
        /* ignore quota/availability errors */
      }
    },
    [surface]
  );

  return [open, set];
}
