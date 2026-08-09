import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';

interface ShuffleToggleButtonProps {
  /** Whether this entry is currently opted into the launch shuffle pool. */
  isIncluded: boolean;
  /** Called (after stopPropagation) when the user presses the toggle. */
  onToggle: () => void;
  /** Display name interpolated into the accessible label and title. */
  name: string;
  /** Keep the toggle visible (not hover-only) while the shuffle switch is armed. */
  armed?: boolean;
  /** Caller positioning classes (e.g. the Locker's absolute card overlay). */
  className?: string;
}

/**
 * The single definition of the shuffle-inclusion control, shared by the Locker
 * skin cards and the Foundry sound-shuffle rows. Owning one copy keeps the two
 * surfaces from drifting: same icon, same i18n keys, same aria-pressed, same
 * pressed-versus-unpressed colour states. Positioning is the caller's job via
 * `className`: the Locker overlays the card corner, Foundry lays the control
 * inline in a row.
 */
export default function ShuffleToggleButton({
  isIncluded,
  onToggle,
  name,
  armed = false,
  className = '',
}: ShuffleToggleButtonProps) {
  const { t } = useTranslation();
  const label = isIncluded
    ? t('locker.randomize.removeFromShuffle', { name })
    : t('locker.randomize.addToShuffle', { name });
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={isIncluded}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-[opacity,background-color,color] duration-150 focus-visible:opacity-100 ${
        isIncluded
          ? 'opacity-100 bg-accent text-accent-foreground hover:bg-accent/80'
          : `${armed ? 'opacity-100' : 'opacity-0'} bg-black/65 text-white/90 hover:bg-accent/70 hover:text-accent-foreground`
      } ${className}`}
    >
      <Shuffle className="h-3.5 w-3.5" />
    </button>
  );
}
