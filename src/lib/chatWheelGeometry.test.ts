import { describe, expect, it } from 'vitest';
import { MAX_WHEEL_SLOTS, polarPoint, slotArc, wedgePath, wheelSlots, type WheelLayout } from './chatWheelGeometry';

const layout: WheelLayout = { cx: 130, cy: 130, rInner: 52, rOuter: 120, gapDeg: 2 };

describe('polarPoint', () => {
  it('measures clockwise from straight up', () => {
    expect(polarPoint(0, 0, 10, 0).x).toBeCloseTo(0);
    expect(polarPoint(0, 0, 10, 0).y).toBeCloseTo(-10);
    // 90 degrees clockwise is to the right (+x) in SVG space.
    expect(polarPoint(0, 0, 10, 90).x).toBeCloseTo(10);
    expect(polarPoint(0, 0, 10, 90).y).toBeCloseTo(0);
    expect(polarPoint(0, 0, 10, 180).y).toBeCloseTo(10);
  });
});

describe('slotArc', () => {
  it('centers slot 0 at the top and proceeds clockwise', () => {
    expect(slotArc(0, 8)).toEqual({ startDeg: -22.5, midDeg: 0, endDeg: 22.5 });
    expect(slotArc(2, 8).midDeg).toBe(90);
    expect(slotArc(6, 8).midDeg).toBe(270);
  });

  it('divides the whole circle among however many slots exist', () => {
    expect(slotArc(0, 3)).toEqual({ startDeg: -60, midDeg: 0, endDeg: 60 });
    const last = slotArc(2, 3);
    expect(last.endDeg - last.startDeg).toBeCloseTo(120);
  });
});

describe('wheelSlots', () => {
  it('lays labels on the wedge midlines', () => {
    const slots = wheelSlots(8, layout);
    expect(slots).toHaveLength(8);
    const rLabel = (layout.rInner + layout.rOuter) / 2;
    // Slot 0 straight up, slot 2 straight right, slot 4 straight down.
    expect(slots[0].label.x).toBeCloseTo(layout.cx, 1);
    expect(slots[0].label.y).toBeCloseTo(layout.cy - rLabel, 1);
    expect(slots[2].label.x).toBeCloseTo(layout.cx + rLabel, 1);
    expect(slots[2].label.y).toBeCloseTo(layout.cy, 1);
    expect(slots[4].label.y).toBeCloseTo(layout.cy + rLabel, 1);
  });

  it('emits one closed annular wedge per slot with the gap applied', () => {
    const slots = wheelSlots(4, layout);
    for (const slot of slots) {
      expect(slot.path.startsWith('M ')).toBe(true);
      expect(slot.path.endsWith('Z')).toBe(true);
      expect(slot.path.match(/A /g)).toHaveLength(2);
    }
    // Adjacent wedges do not touch: each side gave up half the gap.
    const first = slotArc(0, 4);
    const second = slotArc(1, 4);
    expect(second.startDeg - first.endDeg).toBe(0);
    expect(slots[0].path).not.toEqual(wedgePath(layout, first.startDeg, first.endDeg));
  });

  it('draws a one-item menu as a full ring', () => {
    const slots = wheelSlots(1, layout);
    expect(slots).toHaveLength(1);
    // Full ring needs four arcs (two per circle) instead of a degenerate 360.
    expect(slots[0].path.match(/A /g)).toHaveLength(4);
  });

  it('never renders more wedges than the game accepts, and none for zero', () => {
    expect(wheelSlots(30, layout)).toHaveLength(MAX_WHEEL_SLOTS);
    expect(wheelSlots(0, layout)).toEqual([]);
    expect(wheelSlots(-3, layout)).toEqual([]);
  });
});
