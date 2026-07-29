import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/ui';

interface OutOfRangeDialogProps {
    /** Localized control name, so the body reads like the card does. */
    controlLabel: string;
    /** The value gameinfo.gi holds right now, verbatim. */
    current: string;
    min: number;
    max: number;
    /** What the pending edit would write in its place. */
    next: string;
    onConfirm: () => void;
    onResetToDefault: () => void;
    onCancel: () => void;
}

// Confirmation for replacing a gameinfo.gi value that sits outside the range
// this control can represent. Grimoire never clamps such a value into range on
// the user's behalf: the number was put there deliberately (a hand edit, or a
// community config), and quietly rewriting it would look like Grimoire had
// simply read it wrong. So the choice is spelled out: replace it with the
// value the user just picked, remove Grimoire's line so the game default
// applies, or leave the file alone.
export default function OutOfRangeDialog({
    controlLabel,
    current,
    min,
    max,
    next,
    onConfirm,
    onResetToDefault,
    onCancel,
}: OutOfRangeDialogProps) {
    const { t } = useTranslation();
    return (
        <Modal onClose={onCancel} labelledBy="perf-out-of-range-title" size="md">
            <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-state-warning mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 space-y-2">
                        <h3
                            id="perf-out-of-range-title"
                            className="text-lg font-semibold text-text-primary tracking-wide font-reaver"
                        >
                            {t('performance.outOfRangeDialog.title')}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t('performance.outOfRangeDialog.body', {
                                control: controlLabel,
                                current,
                                min,
                                max,
                            })}
                        </p>
                        <p className="text-sm text-text-secondary">
                            {t('performance.outOfRangeDialog.choice', { next })}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button onClick={onCancel} variant="ghost" size="sm">
                        {t('performance.outOfRangeDialog.cancel')}
                    </Button>
                    <Button onClick={onResetToDefault} variant="secondary" size="sm" icon={RotateCcw}>
                        {t('performance.reset')}
                    </Button>
                    <Button onClick={onConfirm} variant="warning" size="sm">
                        {t('performance.outOfRangeDialog.confirm', { next })}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
