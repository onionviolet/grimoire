import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissToast, showToast } from '../stores/toastStore';
import { useAppStore } from '../stores/appStore';
import { bulkChangedCount, bulkUndoPlan, type BulkModSnapshot } from './bulkUndo';

/** The pending undo offer: the snapshot captured before the batch, the ids a
 *  restore should bring back into selection, and the toast id so a newer batch
 *  can supersede the previous offer (D-15). Null when no undo is outstanding;
 *  the offer is one-shot and drops when its toast goes away. */
export interface BulkUndoOfferState {
  toastId: number;
  snapshot: BulkModSnapshot[];
  selection: string[];
}

/** Outcome of a bulk batch that could not change every target: how many
 *  succeeded (`done`), how many were actually attempted and failed (`failed`),
 *  and how many the batch never reached (`total - done - failed`). The last
 *  group is skipped, not failed, so the toast never counts it as one (IN-04). */
export interface BulkPartial {
  done: number;
  total: number;
  failed: number;
}

/**
 * One-shot undo for a completed reversible bulk mutation (D-14, D-15).
 *
 * The changed count is computed against the LIVE store at offer time and the
 * restore plan against the LIVE store at click time (CR-01). The bulk handlers
 * invoke `offerBulkUndo` from the same render closure that captured the
 * snapshot, so reading `mods` from that closure would diff the snapshot
 * against the identical pre-batch array: a fully successful batch would never
 * offer the toast (count 0) and a partial batch's Undo would restore nothing
 * (empty plan). The toast's onAction closure is frozen when the toast is
 * created, so the plan must also be computed from the store inside
 * `runRestore`, never from the offer-time closure. Restores replay a live diff
 * (see bulkUndo): a field the user changed by hand between the batch and the
 * undo is only restored if it still differs from the snapshot, and a mod
 * uninstalled in between is skipped.
 */
export function useBulkUndoOffer(
  onRestored?: (selection: string[]) => void,
) {
  const { t } = useTranslation();
  const [undoOffer, setUndoOffer] = useState<BulkUndoOfferState | null>(null);
  // True while a restore is replaying. Disables the same controls a batch
  // does, and is cleared in a finally so a failed restore never strands the
  // page (T-05-11).
  const [undoBusy, setUndoBusy] = useState(false);
  const { loadMods, toggleMod, setModLockerHero, setModGlobalType } = useAppStore();

  const offerBulkUndo = useCallback(
    (snapshot: BulkModSnapshot[], selection: string[], partial?: BulkPartial) => {
      // Dismiss any previous offer first so a newer batch supersedes it rather
      // than stacking a second toast.
      if (undoOffer) dismissToast(undoOffer.toastId);
      // CR-01: read the live list at offer time; the handler closure captured
      // the pre-batch array.
      const changed = bulkChangedCount(snapshot, useAppStore.getState().mods);
      // Skip the toast entirely when nothing actually changed.
      if (changed === 0 && !partial) return;

      const runRestore = async () => {
        setUndoBusy(true);
        try {
          // Build the plan against the LIVE list at click time: a field the
          // user changed by hand since the batch is only restored if it still
          // differs from the snapshot, and a mod that was uninstalled in
          // between is skipped (CR-01).
          const ops = bulkUndoPlan(snapshot, useAppStore.getState().mods);
          const restoredIds = new Set<string>();
          for (const op of ops) {
            try {
              if (op.kind === 'toggle') {
                const ok = await toggleMod(op.modId);
                if (ok) restoredIds.add(op.modId);
              } else if (op.kind === 'lockerHero') {
                await setModLockerHero(op.modId, op.value);
                restoredIds.add(op.modId);
              } else {
                await setModGlobalType(op.modId, op.value);
                restoredIds.add(op.modId);
              }
            } catch (err) {
              // One failed op does not abort the rest of the restore; the
              // finally below still clears the busy state either way.
              console.error('[Installed] Bulk undo op failed:', err);
            }
          }
          await loadMods();
          // D-14: restore the selection too, so the user is not left to
          // rebuild it by hand.
          onRestored?.(selection);
          showToast(t('common.bulkUndo.restored', { count: restoredIds.size }));
        } finally {
          setUndoOffer(null);
          setUndoBusy(false);
        }
      };

      const toastId = partial
        ? showToast(
            t('common.bulkUndo.partial', {
              done: partial.done,
              total: partial.total,
              failed: partial.failed,
            }),
            {
              tone: 'warning',
              dismissable: true,
              actionLabel: t('common.bulkUndo.action'),
              onAction: () => {
                void runRestore();
              },
            },
          )
        : showToast(t('common.bulkUndo.message', { count: changed }), {
            actionLabel: t('common.bulkUndo.action'),
            onAction: () => {
              void runRestore();
            },
          });
      setUndoOffer({ toastId, snapshot, selection });
    },
    [t, undoOffer, loadMods, toggleMod, setModLockerHero, setModGlobalType, onRestored],
  );

  return { offerBulkUndo, undoBusy };
}
