import { useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { MAX_WHEEL_SLOTS, wheelSlots, type WheelLayout } from '../../lib/chatWheelGeometry';
import { chatWheelIconUrl } from '../../lib/chatWheelIcons';
import type { ChatWheelDressing } from '../../types/chatWheelDressing';
import {
  hasChatWheelDrag,
  readChatWheelDrag,
  writeChatWheelDrag,
  type ChatWheelDragPayload,
} from '../../lib/chatWheelMenuEdit';
import Tx from '../translation/Tx';

interface RadialWheelPreviewProps {
  /** Index of the menu shown, so a wedge drag can say where it came from. */
  menuIndex: number;
  menuName: string;
  /** The menu's `icon:` value; unknown names render as no icon, like ChatLane. */
  icon: string;
  items: readonly string[];
  focusedSlot: number | null;
  /** Select a slot for editing. An index one past the end appends a command
   *  (the page's existing slot-select contract). */
  onSelectSlot: (slot: number) => void;
  /** Reorder within this menu: the item at `from` lands at `to`. Enables wedge
   *  drag-and-drop and the Alt+Arrow keyboard alternative. */
  onMoveItem?: (from: number, to: number) => void;
  /** A drop onto the wheel: onto a wedge (`at` is that slot) or onto the
   *  surrounding surface (`at` undefined, meaning append). */
  onDrop?: (payload: ChatWheelDragPayload, at: number | undefined) => void;
  /** The game's own backplate art, drawn behind the ring. Absent or null
   *  renders the pure-SVG wheel with no extra markup at all: that wheel is
   *  the permanent fallback, so it must not change shape when undressed. */
  dressing?: ChatWheelDressing | null;
}

// One fixed drawing space; the SVG scales to its container.
const LAYOUT: WheelLayout = { cx: 150, cy: 150, rInner: 60, rOuter: 144, gapDeg: 1.6 };

// React's SVG typings omit `draggable`, though Chromium honours it on SVG
// elements; a spread sidesteps the excess-property check without a cast.
const DRAGGABLE = { draggable: true };

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

/** Where an arrow key sends focus from `index` on a ring of `count`, or null
 *  for a key the ring does not handle. Clockwise is forward, wrapping. */
function ringStep(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index + count - 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * The circular wheel as the game divides it: one equal wedge per command,
 * filling the whole circle, slot 0 centered at the top and reading clockwise.
 * A preview-and-select surface: clicking a wedge focuses that command's input
 * in the form, and every edit goes back up through the callbacks; nothing here
 * writes YAML.
 *
 * Keyboard: the wedges are one roving tab stop. Arrow keys move focus around
 * the ring (focus only, never a selection), Enter or Space select the focused
 * slot, and Alt+Arrow moves the focused command one slot, the keyboard twin of
 * dragging a wedge onto another.
 */
export default function RadialWheelPreview({
  menuIndex,
  menuName,
  icon,
  items,
  focusedSlot,
  onSelectSlot,
  onMoveItem,
  onDrop,
  dressing,
}: RadialWheelPreviewProps) {
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
  const paths = useRef<Array<SVGPathElement | null>>([]);

  // The roving tab stop follows focus around the ring, and jumps to whichever
  // slot the form selects (adjusted during render, per React's guidance).
  const [tabStop, setTabStop] = useState(0);
  const [seenFocusedSlot, setSeenFocusedSlot] = useState(focusedSlot);
  if (focusedSlot !== seenFocusedSlot) {
    setSeenFocusedSlot(focusedSlot);
    if (focusedSlot !== null) setTabStop(focusedSlot);
  }
  const activeTabStop = shown.length === 0 ? -1 : Math.min(tabStop, shown.length - 1);

  const [dropTarget, setDropTarget] = useState<number | 'append' | null>(null);
  const dragEnabled = Boolean(onMoveItem || onDrop);

  const focusSlot = (index: number) => paths.current[index]?.focus();

  const moveSlot = (from: number, to: number) => {
    if (!onMoveItem || to < 0 || to >= shown.length || to === from) return;
    onMoveItem(from, to);
    setTabStop(to);
    requestAnimationFrame(() => focusSlot(to));
  };

  const onWedgeKeyDown = (event: KeyboardEvent<SVGPathElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectSlot(index);
      return;
    }
    const next = ringStep(event.key, index, shown.length);
    if (next === null) return;
    event.preventDefault();
    if (event.altKey && onMoveItem && (event.key.startsWith('Arrow'))) {
      // Alt+Arrow moves the command itself, one slot in the arrow's direction.
      moveSlot(index, next);
      return;
    }
    focusSlot(next);
  };

  const acceptDrag = (event: DragEvent, target: number | 'append') => {
    if (!onDrop || !hasChatWheelDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
    if (dropTarget !== target) setDropTarget(target);
  };

  const finishDrop = (event: DragEvent, at: number | undefined) => {
    if (!onDrop) return;
    const payload = readChatWheelDrag(event.dataTransfer);
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    onDrop(payload, at);
  };

  return (
    <div
      className={`mx-auto mt-5 w-full max-w-[19rem] rounded transition-shadow ${
        dropTarget === 'append' ? 'ring-2 ring-accent/50' : ''
      }`}
      data-drop-target={dropTarget === null ? undefined : String(dropTarget)}
      onDragOver={(event) => acceptDrag(event, 'append')}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
      }}
      onDrop={(event) => finishDrop(event, undefined)}
    >
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
          const over = dropTarget === slot.index;
          return (
            <g key={slot.index}>
              <path
                ref={(element) => {
                  paths.current[slot.index] = element;
                }}
                d={slot.path}
                role="button"
                tabIndex={slot.index === activeTabStop ? 0 : -1}
                aria-label={item || t('chatWheel.emptySlot', 'Empty slot')}
                onClick={() => onSelectSlot(slot.index)}
                onFocus={() => setTabStop(slot.index)}
                onKeyDown={(event) => onWedgeKeyDown(event, slot.index)}
                {...(dragEnabled ? DRAGGABLE : {})}
                onDragStart={(event) => {
                  if (!dragEnabled) return;
                  writeChatWheelDrag(event.dataTransfer, { kind: 'item', menu: menuIndex, index: slot.index });
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDropTarget(null)}
                onDragOver={(event) => acceptDrag(event, slot.index)}
                onDrop={(event) => finishDrop(event, slot.index)}
                className={`outline-none transition-colors ${dragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                  over
                    ? 'fill-accent/15 stroke-accent'
                    : active
                      ? 'fill-accent/25 stroke-accent'
                      : backplateUrl
                        ? 'fill-bg-tertiary/60 stroke-border hover:fill-bg-secondary/70 focus-visible:fill-bg-secondary/70 focus-visible:stroke-accent/60'
                        : 'fill-bg-tertiary stroke-border hover:fill-bg-secondary focus-visible:fill-bg-secondary focus-visible:stroke-accent/60'
                }`}
                strokeWidth={over ? '2' : '1'}
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
        {dragEnabled && (
          <p className="text-center text-[11px] text-text-secondary">
            <Tx
              k="chatWheel.dnd.wheelHint"
              fallback="Drag a slot onto another to reorder, or drop a command here to add it. Arrow keys move around the ring; Alt+Arrow moves the command."
            />
          </p>
        )}
      </div>
    </div>
  );
}
