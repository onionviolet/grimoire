/**
 * Radial chat-wheel geometry (pure).
 *
 * The in-game wheel divides the full circle evenly among a menu's entries
 * (ChatLane: "a custom menu can only have up to 12 entries, filling up the
 * entire circle"), so the preview does the same: N items means N equal
 * annular wedges, not a fixed grid. Slot 0 is centered at 12 o'clock and
 * slots proceed clockwise, matching the reading order of the item list.
 * (In game the Archmother team sees the order mirrored; the preview shows
 * the canonical order.)
 *
 * Angles are in degrees, measured clockwise from straight up, because that is
 * how the wheel is described everywhere else in the UI. Only this module
 * converts to SVG's coordinate space.
 */

/** The most entries the game will place on one wheel. */
export const MAX_WHEEL_SLOTS = 12;

export interface WheelLayout {
  /** Wheel center in SVG user units. */
  cx: number;
  cy: number;
  /** Annulus radii: the hub lives inside `rInner`. */
  rInner: number;
  rOuter: number;
  /** Angular gap between adjacent wedges, split evenly between them. */
  gapDeg: number;
}

export interface WheelSlotGeometry {
  index: number;
  /** Closed SVG path of the annular wedge. */
  path: string;
  /** Anchor for the slot label, on the wedge's angular and radial midline. */
  label: { x: number; y: number };
  /** Wedge midline angle, degrees clockwise from up. */
  midDeg: number;
}

/** A point at `angleDeg` (clockwise from up) and radius `r` around (cx, cy). */
export function polarPoint(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/** The angular span of slot `index` of `count`, before the gap is applied. */
export function slotArc(index: number, count: number): { startDeg: number; midDeg: number; endDeg: number } {
  const span = 360 / count;
  const midDeg = index * span;
  return { startDeg: midDeg - span / 2, midDeg, endDeg: midDeg + span / 2 };
}

const round = (value: number) => Number(value.toFixed(3));

/** Closed annular-sector path from `startDeg` to `endDeg` (clockwise). A span
 *  of (effectively) the full circle is drawn as a ring out of two half arcs,
 *  because a single 360-degree SVG arc collapses to nothing. */
export function wedgePath(layout: WheelLayout, startDeg: number, endDeg: number): string {
  const { cx, cy, rInner, rOuter } = layout;
  const span = endDeg - startDeg;
  if (span >= 359.999) {
    const top = polarPoint(cx, cy, rOuter, 0);
    const bottom = polarPoint(cx, cy, rOuter, 180);
    const topIn = polarPoint(cx, cy, rInner, 0);
    const bottomIn = polarPoint(cx, cy, rInner, 180);
    return [
      `M ${round(top.x)} ${round(top.y)}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${round(bottom.x)} ${round(bottom.y)}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${round(top.x)} ${round(top.y)}`,
      `M ${round(topIn.x)} ${round(topIn.y)}`,
      `A ${rInner} ${rInner} 0 1 0 ${round(bottomIn.x)} ${round(bottomIn.y)}`,
      `A ${rInner} ${rInner} 0 1 0 ${round(topIn.x)} ${round(topIn.y)}`,
      'Z',
    ].join(' ');
  }
  const largeArc = span > 180 ? 1 : 0;
  const outerStart = polarPoint(cx, cy, rOuter, startDeg);
  const outerEnd = polarPoint(cx, cy, rOuter, endDeg);
  const innerEnd = polarPoint(cx, cy, rInner, endDeg);
  const innerStart = polarPoint(cx, cy, rInner, startDeg);
  return [
    `M ${round(outerStart.x)} ${round(outerStart.y)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${round(outerEnd.x)} ${round(outerEnd.y)}`,
    `L ${round(innerEnd.x)} ${round(innerEnd.y)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${round(innerStart.x)} ${round(innerStart.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Geometry for every slot of an N-way wheel. `count` outside [1, 12] is the
 * caller's bug surface, not this module's: it is clamped so the preview never
 * renders more wedges than the game would.
 */
export function wheelSlots(count: number, layout: WheelLayout): WheelSlotGeometry[] {
  const slots = Math.min(MAX_WHEEL_SLOTS, Math.max(0, Math.floor(count)));
  if (slots === 0) return [];
  const rLabel = (layout.rInner + layout.rOuter) / 2;
  return Array.from({ length: slots }, (_, index) => {
    const { startDeg, midDeg, endDeg } = slotArc(index, slots);
    // A one-slot wheel is a full ring; a gap would just notch it for no reason.
    const gap = slots === 1 ? 0 : layout.gapDeg / 2;
    const anchor = polarPoint(layout.cx, layout.cy, rLabel, midDeg);
    return {
      index,
      path: wedgePath(layout, startDeg + gap, endDeg - gap),
      label: { x: round(anchor.x), y: round(anchor.y) },
      midDeg,
    };
  });
}
