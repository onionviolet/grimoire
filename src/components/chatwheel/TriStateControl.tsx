import { useTranslation } from 'react-i18next';
import { Check, Minus, X, type LucideIcon } from 'lucide-react';
import type { OverrideState } from '../../lib/chatWheelModel';
import { chipClass, rovingArrowKeyDown } from './chipStyles';

/**
 * The three-state override control: inherit (no YAML entry), on (`true`), off
 * (`false`).
 *
 * It is deliberately not the shared `SegmentedControl`: that primitive renders
 * `role="tab"`, which promises a panel, and these are per-row selectors rather
 * than a tab switch. It is deliberately not `Toggle` either, which cannot
 * represent inherit.
 *
 * Arrow keys move focus only and never change the value. `SegmentedControl`
 * selects on arrow, but activating an option here writes the saved YAML, so a
 * focus move must not mutate the document.
 */

interface TriStateControlProps {
  value: OverrideState;
  onChange: (state: OverrideState) => void;
  ariaLabel: string;
  disabled?: boolean;
}

const OPTIONS: ReadonlyArray<{ state: OverrideState; icon: LucideIcon; key: string; fallback: string }> = [
  { state: 'inherit', icon: Minus, key: 'chatWheel.catalog.stateInherit', fallback: 'Inherit' },
  { state: 'on', icon: Check, key: 'chatWheel.catalog.stateOn', fallback: 'On' },
  { state: 'off', icon: X, key: 'chatWheel.catalog.stateOff', fallback: 'Off' },
];

export default function TriStateControl({ value, onChange, ariaLabel, disabled = false }: TriStateControlProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex gap-1">
      {OPTIONS.map((option) => {
        const active = option.state === value;
        const Icon = option.icon;
        return (
          <button
            key={option.state}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            tabIndex={active ? 0 : -1}
            onKeyDown={rovingArrowKeyDown}
            onClick={() => onChange(option.state)}
            className={chipClass(active)}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(option.key, option.fallback)}
          </button>
        );
      })}
    </div>
  );
}
