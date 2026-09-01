import { describe, expect, it } from 'vitest';
import type { ChatWheelMenu } from './chatWheelModel';
import {
  CHAT_WHEEL_DRAG_TYPE,
  hasChatWheelDrag,
  insertMenuItem,
  moveMenuItem,
  readChatWheelDrag,
  transferMenuItem,
  writeChatWheelDrag,
  type DragData,
} from './chatWheelMenuEdit';

const menus = (): ChatWheelMenu[] => [
  { name: 'A', icon: 'quick', items: ['a0', 'a1', 'a2'] },
  { name: 'B', icon: 'quick', items: ['b0'] },
];

/** A DataTransfer stand-in: jsdom has no DragEvent, and the codec only needs this much. */
function fakeData(): DragData & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    get types() {
      return Object.keys(store);
    },
    getData: (format) => store[format] ?? '',
    setData: (format, data) => {
      store[format] = data;
    },
  };
}

describe('moveMenuItem', () => {
  it('moves an item forward and back within one menu without touching the others', () => {
    const before = menus();
    expect(moveMenuItem(before, 0, 0, 2)[0].items).toEqual(['a1', 'a2', 'a0']);
    expect(moveMenuItem(before, 0, 2, 0)[0].items).toEqual(['a2', 'a0', 'a1']);
    expect(moveMenuItem(before, 0, 0, 2)[1]).toBe(before[1]);
    expect(before[0].items).toEqual(['a0', 'a1', 'a2']);
  });

  it('clamps the target and ignores an out-of-range source', () => {
    expect(moveMenuItem(menus(), 0, 0, 99)[0].items).toEqual(['a1', 'a2', 'a0']);
    expect(moveMenuItem(menus(), 0, 2, -5)[0].items).toEqual(['a2', 'a0', 'a1']);
    expect(moveMenuItem(menus(), 0, 7, 0)[0].items).toEqual(['a0', 'a1', 'a2']);
    expect(moveMenuItem(menus(), 5, 0, 1)).toEqual(menus());
  });
});

describe('insertMenuItem', () => {
  it('appends by default and inserts at a clamped index otherwise', () => {
    expect(insertMenuItem(menus(), 1, 'x')[1].items).toEqual(['b0', 'x']);
    expect(insertMenuItem(menus(), 0, 'x', 1)[0].items).toEqual(['a0', 'x', 'a1', 'a2']);
    expect(insertMenuItem(menus(), 0, 'x', 40)[0].items).toEqual(['a0', 'a1', 'a2', 'x']);
    expect(insertMenuItem(menus(), 9, 'x')).toEqual(menus());
  });
});

describe('transferMenuItem', () => {
  it('reorders when source and target are the same menu', () => {
    expect(transferMenuItem(menus(), { menu: 0, index: 0 }, { menu: 0, index: 1 })[0].items).toEqual(['a1', 'a0', 'a2']);
    expect(transferMenuItem(menus(), { menu: 0, index: 0 }, { menu: 0 })[0].items).toEqual(['a1', 'a2', 'a0']);
  });

  it('moves an item across menus, appending or inserting', () => {
    const appended = transferMenuItem(menus(), { menu: 0, index: 1 }, { menu: 1 });
    expect(appended[0].items).toEqual(['a0', 'a2']);
    expect(appended[1].items).toEqual(['b0', 'a1']);
    const inserted = transferMenuItem(menus(), { menu: 1, index: 0 }, { menu: 0, index: 0 });
    expect(inserted[0].items).toEqual(['b0', 'a0', 'a1', 'a2']);
    expect(inserted[1].items).toEqual([]);
  });

  it('returns an equal list for a missing menu or item', () => {
    expect(transferMenuItem(menus(), { menu: 3, index: 0 }, { menu: 0 })).toEqual(menus());
    expect(transferMenuItem(menus(), { menu: 1, index: 4 }, { menu: 0 })).toEqual(menus());
  });
});

describe('drag payload codec', () => {
  it('round-trips both payload kinds under the private MIME type', () => {
    const data = fakeData();
    writeChatWheelDrag(data, { kind: 'command', id: 'Can Heal' });
    expect(hasChatWheelDrag(data)).toBe(true);
    expect(data.store['text/plain']).toBe('Can Heal');
    expect(readChatWheelDrag(data)).toEqual({ kind: 'command', id: 'Can Heal' });

    const item = fakeData();
    writeChatWheelDrag(item, { kind: 'item', menu: 1, index: 2 });
    expect(readChatWheelDrag(item)).toEqual({ kind: 'item', menu: 1, index: 2 });
  });

  it('rejects foreign drops and malformed payloads', () => {
    const text = fakeData();
    text.setData('text/plain', 'Can Heal');
    expect(hasChatWheelDrag(text)).toBe(false);
    expect(readChatWheelDrag(text)).toBeNull();

    const junk = fakeData();
    junk.setData(CHAT_WHEEL_DRAG_TYPE, '{"kind":"item","menu":"x"}');
    expect(readChatWheelDrag(junk)).toBeNull();
    junk.setData(CHAT_WHEEL_DRAG_TYPE, 'not json');
    expect(readChatWheelDrag(junk)).toBeNull();
    expect(readChatWheelDrag(null)).toBeNull();
    expect(hasChatWheelDrag(undefined)).toBe(false);
  });
});
