import type { ChatWheelMenu } from './chatWheelModel';

/**
 * Pure menu-list edits behind the Chat Wheel page's drag-and-drop and its
 * keyboard alternatives (Move up / Move down, Alt+Arrow, Add to menu, Move to
 * menu). Every function returns a new `menus` array and never mutates its
 * input; the page hands the result to `updateChatWheelYaml` exactly as it does
 * for a typed edit, so the byte-preserving round trip is untouched.
 *
 * Out-of-range positions clamp rather than throw: a drop index one past the
 * end means append, which is also what the preview's "Add command" slot means.
 */

const clampIndex = (index: number, length: number) => Math.max(0, Math.min(Math.floor(index), length));

function replaceMenu(menus: readonly ChatWheelMenu[], menuIndex: number, items: string[]): ChatWheelMenu[] {
  return menus.map((menu, index) => (index === menuIndex ? { ...menu, items } : menu));
}

/** Move the item at `from` so that it sits at `to` within one menu. */
export function moveMenuItem(menus: readonly ChatWheelMenu[], menuIndex: number, from: number, to: number): ChatWheelMenu[] {
  const menu = menus[menuIndex];
  if (!menu || from < 0 || from >= menu.items.length) return [...menus];
  const target = clampIndex(to, menu.items.length - 1);
  if (target === from) return [...menus];
  const items = [...menu.items];
  const [item] = items.splice(from, 1);
  items.splice(target, 0, item);
  return replaceMenu(menus, menuIndex, items);
}

/** Insert `item` into a menu at `at` (append when `at` is omitted or past the end). */
export function insertMenuItem(menus: readonly ChatWheelMenu[], menuIndex: number, item: string, at?: number): ChatWheelMenu[] {
  const menu = menus[menuIndex];
  if (!menu) return [...menus];
  const items = [...menu.items];
  items.splice(at === undefined ? items.length : clampIndex(at, items.length), 0, item);
  return replaceMenu(menus, menuIndex, items);
}

/**
 * Move one item from a menu into another (or the same) menu. Within one menu
 * this is `moveMenuItem`; across menus the item leaves its source and lands at
 * `at` in the target, appended when `at` is omitted.
 */
export function transferMenuItem(
  menus: readonly ChatWheelMenu[],
  from: { menu: number; index: number },
  to: { menu: number; index?: number },
): ChatWheelMenu[] {
  const source = menus[from.menu];
  if (!source || !menus[to.menu] || from.index < 0 || from.index >= source.items.length) return [...menus];
  if (from.menu === to.menu) {
    return moveMenuItem(menus, from.menu, from.index, to.index ?? source.items.length - 1);
  }
  const item = source.items[from.index];
  const removed = replaceMenu(menus, from.menu, source.items.filter((_, index) => index !== from.index));
  return insertMenuItem(removed, to.menu, item, to.index);
}

/**
 * The drag payload. A `command` comes from the base command catalogue and is
 * copied; an `item` is an existing menu entry and is moved. The MIME type is
 * private so a stray file or text drop is ignored rather than inserted.
 */
export type ChatWheelDragPayload =
  | { kind: 'command'; id: string }
  | { kind: 'item'; menu: number; index: number };

export const CHAT_WHEEL_DRAG_TYPE = 'application/x-grimoire-chat-wheel';

/** The subset of DataTransfer the codec touches, so tests need no DragEvent. */
export interface DragData {
  types?: ReadonlyArray<string> | DOMStringList;
  getData(format: string): string;
  setData(format: string, data: string): void;
}

export function writeChatWheelDrag(data: DragData, payload: ChatWheelDragPayload): void {
  data.setData(CHAT_WHEEL_DRAG_TYPE, JSON.stringify(payload));
  // A readable fallback for anything outside the page (a text editor, say).
  data.setData('text/plain', payload.kind === 'command' ? payload.id : '');
}

/** True while a drag carrying our payload is over a target; `dragover` cannot
 *  read the data itself, only the advertised types. */
export function hasChatWheelDrag(data: DragData | null | undefined): boolean {
  if (!data?.types) return false;
  return Array.from(data.types as ArrayLike<string>).includes(CHAT_WHEEL_DRAG_TYPE);
}

export function readChatWheelDrag(data: DragData | null | undefined): ChatWheelDragPayload | null {
  if (!data) return null;
  let raw = '';
  try {
    raw = data.getData(CHAT_WHEEL_DRAG_TYPE);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value.kind === 'command' && typeof value.id === 'string') return { kind: 'command', id: value.id };
    if (value.kind === 'item' && typeof value.menu === 'number' && typeof value.index === 'number') {
      return { kind: 'item', menu: value.menu, index: value.index };
    }
    return null;
  } catch {
    return null;
  }
}
