import { createContext, useContext, type ReactNode } from 'react';

/**
 * The confirmation contract, kept apart from the provider component so a file
 * can import the hook without importing a component (which is also what Fast
 * Refresh requires of a module that exports one).
 *
 * See `confirm.tsx` for why this exists at all: twelve destructive
 * confirmations were `window.confirm`, which in Electron blocks the renderer,
 * ignores the app's visual language, styles a destructive action like a benign
 * one, and cannot list the affected mods.
 */

export interface ConfirmRequest {
  title: ReactNode;
  /** The consequence, in a sentence. */
  message?: ReactNode;
  /** What the action affects, rendered as a list rather than a comma string. */
  items?: readonly string[];
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** 'danger' styles the confirming action as destructive. */
  variant?: 'primary' | 'danger';
}

export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Ask for confirmation and await the answer. Escape, the backdrop, and Cancel
 * all resolve `false`.
 *
 * The returned function is stable, so it is safe (and required) in a
 * `useCallback` dependency list.
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside a ConfirmProvider');
  return confirm;
}
