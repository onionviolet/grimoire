import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

/**
 * One inline disclosure for a documented game or ChatLane limitation that
 * affects a saved wheel. Each note sits next to the control it affects rather
 * than in a single disclaimer block nobody reads.
 *
 * The copy states what the game and ChatLane do, as documented upstream
 * (RedMser/ChatLane "Known issues"), not what a given match will do. The
 * source of each line is docs/chat-wheel.md; if the doc does not say it, the
 * note must not either.
 */

export type ChatWheelLimitation =
  /** Custom menu item order is reversed for players on the Archmother team. */
  | 'archmotherOrder'
  /** A menu bound to the top slot opens in the wrong direction. */
  | 'topSlot'
  /** Some items cannot be selected depending on the slot the menu is bound to. */
  | 'slotSelect'
  /** Bound custom menus whose add-on disappears (e.g. gameinfo reset) can crash the game. */
  | 'unbindCrash'
  /** Selecting the custom menu itself plays a placeholder voice line. */
  | 'placeholderVoice';

const COPY: Record<ChatWheelLimitation, { key: string; fallback: string }> = {
  archmotherOrder: {
    key: 'chatWheel.limits.archmotherOrder',
    fallback: 'In game, players on the Archmother team see the items of a custom menu in reverse order. The preview shows the order as written.',
  },
  topSlot: {
    key: 'chatWheel.limits.topSlot',
    fallback: "A custom menu bound to the top slot of the game's Chat Wheel opens in the wrong direction and cannot be used there. Bind custom menus to other slots in the game's settings.",
  },
  slotSelect: {
    key: 'chatWheel.limits.slotSelect',
    fallback: 'Depending on which slot a custom menu is bound to in game, some of its items may not be selectable.',
  },
  unbindCrash: {
    key: 'chatWheel.limits.unbindCrash',
    fallback: "If this add-on goes missing while its custom menus are still bound, for example after a game update resets gameinfo.gi, opening the chat wheel or the settings can crash the game. Unbind custom menus in the game's Chat Wheel settings before removing the add-on.",
  },
  placeholderVoice: {
    key: 'chatWheel.limits.placeholderVoice',
    fallback: 'Opening a custom menu without picking one of its entries plays a placeholder voice line in game.',
  },
};

interface LimitationNoteProps {
  limitation: ChatWheelLimitation;
  className?: string;
}

export default function LimitationNote({ limitation, className = '' }: LimitationNoteProps) {
  const { t } = useTranslation();
  const copy = COPY[limitation];
  return (
    <p
      role="note"
      data-limitation={limitation}
      className={`flex items-start gap-1.5 text-[11px] leading-relaxed text-text-secondary ${className}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-info" aria-hidden="true" />
      <span>{t(copy.key, copy.fallback)}</span>
    </p>
  );
}
