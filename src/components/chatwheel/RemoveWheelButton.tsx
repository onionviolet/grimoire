import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '../common/ui';
import { useConfirm } from '../common/confirmContext';
import Tx from '../translation/Tx';
import { deleteMod } from '../../lib/api';
import type { Mod } from '../../types/mod';
import { confirmChatWheelUnbind } from './unbindWarning';

interface RemoveWheelButtonProps {
  /** The installed wheel currently selected on the page, if any. */
  wheel: Mod | undefined;
  disabled?: boolean;
  /** Runs after the VPK is gone; the page refreshes its lists here. */
  onRemoved: () => Promise<void> | void;
  onError: (message: string) => void;
}

/**
 * Removes the selected wheel from the game folder, behind the unbind warning.
 * Kept out of the page so the removal path has one owner and the page's diff
 * stays small.
 */
export default function RemoveWheelButton({ wheel, disabled, onRemoved, onError }: RemoveWheelButtonProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (!wheel || !(await confirmChatWheelUnbind(confirm, t, [wheel]))) return;
    setRemoving(true);
    try {
      await deleteMod(wheel.id);
      await onRemoved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Button
      variant="danger"
      size="sm"
      className="w-full"
      onClick={remove}
      disabled={!wheel || disabled || removing}
      isLoading={removing}
    >
      <Trash2 className="mr-1 h-4 w-4" />
      <Tx k="chatWheel.unbind.removeWheel" fallback="Remove wheel" />
    </Button>
  );
}
