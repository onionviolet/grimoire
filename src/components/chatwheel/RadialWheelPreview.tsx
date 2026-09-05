import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { MAX_WHEEL_SLOTS, wheelSlots, type WheelLayout } from '../../lib/chatWheelGeometry';
import { chatWheelIconUrl } from '../../lib/chatWheelIcons';
import type { ChatWheelDressing } from '../../types/chatWheelDressing';
import Tx from '../translation/Tx';

interface RadialWheelPreviewProps {
  menuName: string;
  /** The menu's `icon:` value; unknown names render as no icon, like ChatLane. */
  icon: string;
  items: readonly string[];
  focusedSlot: number | null;
  /** Select a slot for editing. An index one past the end appends a command
   *  (the page's existing slot-select contract). */
  onSelectSlot: (slot: number) => void;
  /** The game's own backplate art, drawn behind the ring. Absent or null
   *  renders the pure-SVG wheel with no extra markup at all: that wheel is
   *  the permanent fallback, so it must not change shape when undressed. */
  dressing?: ChatWheelDressing | null;
}

// One fixed drawing space; the SVG scales to its container.
const LAYOUT: WheelLayout = { cx: 150, cy: 150, rInner: 60, rOuter: 144, gapDeg: 1.6 };

/** How much text fits on a wedge before it walks over its neighbors. The span
 *  shrinks as slots are added, so the budget does too. */
function labelBudget(count: number): number {
  if (count <= 4) return 20;
  if (count <= 8) return 13;
  return 9;
}

function truncate(text: string, budget: number): string {
  return text.length <= budget ? text : `${text.slice(0, Math.max(1, budget - 1))}…`;
}

/**
 * The circular wheel as the game divides it: one equal wedge per command,
 * filling the whole circle, slot 0 centered at the top and reading clockwise.
 * Purely a preview-and-select surface: clicking a wedge focuses that command's
 * input in the form, and nothing here writes YAML.
 */
export default function RadialWheelPreview({ menuName, icon, items, focusedSlot, onSelectSlot, dressing }: RadialWheelPreviewProps) {
  const { t } = useTranslation();
  const shown = items.slice(0, MAX_WHEEL_SLOTS);
  const slots = useMemo(() => wheelSlots(shown.length, LAYOUT), [shown.length]);
  const iconUrl = chatWheelIconUrl(icon);
  const overflow = items.length - shown.length;
  const budget = labelBudget(shown.length);
  const backplateUrl = dressing?.backplateUrl ?? null;
  // useId's separators are not safe inside an unquoted url(); keep the id plain.
  const clipId = `chat-wheel-backplate-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const plateRadius = LAYOUT.rOuter + 4;

  return (
    <div className="mx-auto mt-5 w-full max-w-[19rem]">
      <svg viewBox="0 0 300 300" role="group" aria-label={t('chatWheel.previewWheel', 'Chat wheel preview')} className="block w-full select-none">
        {/* Backplate so the wheel reads as one object, like the in-game HUD. */}
        <circle cx={LAYOUT.cx} cy={LAYOUT.cy} r={plateRadius} className="fill-bg-primary stroke-border" strokeWidth="1" />
        {backplateUrl && (
          <>
            {/* The game's own art, clipped to the plate; wedges go translucent
                over it so it stays visible. Decorative only. */}
            <clipPath id={clipId}>
              <circle cx={LAYOUT.cx} cy={LAYOUT.cy} r={plateRadius} />
            </clipPath>
            <image
              href={backplateUrl}
              x={LAYOUT.cx - plateRadius}
              y={LAYOUT.cy - plateRadius}
              width={plateRadius * 2}
              height={plateRadius * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
              aria-hidden="true"
              data-testid="chat-wheel-backplate"
            />
          </>
        )}
        {slots.map((slot) => {
          const item = shown[slot.index];
          const active = focusedSlot === slot.index;
          return (
            <g key={slot.index}>
              <path
                d={slot.path}
                role="button"
                tabIndex={0}
                aria-label={item || t('chatWheel.emptySlot', 'Empty slot')}
                onClick={() => onSelectSlot(slot.index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectSlot(slot.index);
                  }
                }}
                className={`cursor-pointer outline-none transition-colors ${
                  active
                    ? 'fill-accent/25 stroke-accent'
                    : backplateUrl
                      ? 'fill-bg-tertiary/60 stroke-border hover:fill-bg-secondary/70 focus-visible:fill-bg-secondary/70 focus-visible:stroke-accent/60'
                      : 'fill-bg-tertiary stroke-border hover:fill-bg-secondary focus-visible:fill-bg-secondary focus-visible:stroke-accent/60'
                }`}
                strokeWidth="1"
              >
                <title>{item || t('chatWheel.emptySlot', 'Empty slot')}</title>
              </path>
              <text
                x={slot.label.x}
                y={slot.label.y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`pointer-events-none text-[11px] ${active ? 'fill-text-primary font-semibold' : 'fill-text-secondary'}`}
              >
                {truncate(item, budget)}
              </text>
            </g>
          );
        })}
        {slots.length === 0 && (
          <circle
            cx={LAYOUT.cx}
            cy={LAYOUT.cy}
            r={(LAYOUT.rInner + LAYOUT.rOuter) / 2}
            className="fill-none stroke-border"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
        )}
        {/* Hub: the menu's own icon and name, what the wheel shows before a
            wedge is hovered in game. */}
        <circle cx={LAYOUT.cx} cy={LAYOUT.cy} r={LAYOUT.rInner - 8} className="fill-bg-secondary stroke-accent/40" strokeWidth="1" />
        {iconUrl && (
          <image href={iconUrl} x={LAYOUT.cx - 14} y={LAYOUT.cy - 26} width="28" height="28" />
        )}
        <text
          x={LAYOUT.cx}
          y={iconUrl ? LAYOUT.cy + 16 : LAYOUT.cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="pointer-events-none fill-text-primary text-[11px] font-semibold"
        >
          {truncate(menuName || t('chatWheel.untitled', 'Untitled'), 12)}
        </text>
      </svg>

      <div className="mt-2 flex flex-col items-center gap-1">
        {shown.length < MAX_WHEEL_SLOTS && (
          <button
            type="button"
            onClick={() => onSelectSlot(items.length)}
            className="flex items-center gap-1 rounded-sm border border-dashed border-border px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary cursor-pointer"
          >
            <Plus size={12} />
            <Tx k="chatWheel.addCommand" fallback="Add command" />
          </button>
        )}
        {shown.length >= MAX_WHEEL_SLOTS && (
          <p className="text-center text-[11px] text-text-secondary">
            {overflow > 0
              ? t('chatWheel.overflowWarning', 'The game shows only the first {{max}} commands; {{count}} more are in this menu but will not appear on the wheel.', { max: MAX_WHEEL_SLOTS, count: overflow })
              : t('chatWheel.wheelFull', 'This wheel is full ({{max}} commands).', { max: MAX_WHEEL_SLOTS })}
          </p>
        )}
      </div>
    </div>
  );
}
