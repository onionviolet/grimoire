// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RadialWheelPreview from './RadialWheelPreview';
import { CHAT_WHEEL_DRAG_TYPE, type ChatWheelDragPayload } from '../../lib/chatWheelMenuEdit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The ring is one roving tab stop: arrow keys move focus around it (and
 * wrap), Enter/Space select, Alt+Arrow moves the command. Drops land with the
 * slot index they hit, or none for the surrounding surface. jsdom has no
 * DragEvent, so drops are plain events carrying a hand-made dataTransfer.
 */

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A drop or dragover event carrying our payload the way a real drag would. */
function dragEvent(type: 'drop' | 'dragover', payload: ChatWheelDragPayload | null): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const store: Record<string, string> = payload ? { [CHAT_WHEEL_DRAG_TYPE]: JSON.stringify(payload) } : { 'text/plain': 'x' };
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: Object.keys(store),
      effectAllowed: 'move',
      dropEffect: 'none',
      getData: (format: string) => store[format] ?? '',
      setData: (format: string, data: string) => {
        store[format] = data;
      },
    },
  });
  return event;
}

describe('RadialWheelPreview', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onSelectSlot: ReturnType<typeof vi.fn<(slot: number) => void>>;
  let onMoveItem: ReturnType<typeof vi.fn<(from: number, to: number) => void>>;
  let onDrop: ReturnType<typeof vi.fn<(payload: ChatWheelDragPayload, at: number | undefined) => void>>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onSelectSlot = vi.fn<(slot: number) => void>();
    onMoveItem = vi.fn<(from: number, to: number) => void>();
    onDrop = vi.fn<(payload: ChatWheelDragPayload, at: number | undefined) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  const render = async (props: Partial<Parameters<typeof RadialWheelPreview>[0]> = {}) => {
    await act(async () => {
      root.render(
        <RadialWheelPreview
          menuIndex={0}
          menuName="Menu"
          icon="quick"
          items={['One', 'Two', 'Three']}
          focusedSlot={null}
          onSelectSlot={onSelectSlot}
          onMoveItem={onMoveItem}
          onDrop={onDrop}
          {...props}
        />
      );
    });
    await act(async () => {
      await flush();
    });
  };

  const wedges = () => Array.from(host.querySelectorAll<SVGPathElement>('path[role="button"]'));

  const key = async (element: Element, key: string, init: KeyboardEventInit = {}) => {
    await act(async () => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    });
  };

  it('renders one roving tab stop and follows the form-selected slot', async () => {
    await render();
    expect(wedges().map((wedge) => wedge.tabIndex)).toEqual([0, -1, -1]);
    await render({ focusedSlot: 2 });
    expect(wedges().map((wedge) => wedge.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('moves focus around the ring with arrow keys, wrapping at both ends', async () => {
    await render();
    const [first, second, third] = wedges();
    await act(async () => first.focus());
    expect(document.activeElement).toBe(first);
    await key(first, 'ArrowRight');
    expect(document.activeElement).toBe(second);
    await key(second, 'ArrowDown');
    expect(document.activeElement).toBe(third);
    await key(third, 'ArrowRight');
    expect(document.activeElement).toBe(first);
    await key(first, 'ArrowLeft');
    expect(document.activeElement).toBe(third);
    await key(third, 'ArrowUp');
    expect(document.activeElement).toBe(second);
    await key(second, 'End');
    expect(document.activeElement).toBe(third);
    await key(third, 'Home');
    expect(document.activeElement).toBe(first);
    // Focus moved; nothing was selected or reordered.
    expect(onSelectSlot).not.toHaveBeenCalled();
    expect(onMoveItem).not.toHaveBeenCalled();
    // The tab stop followed focus.
    expect(wedges().map((wedge) => wedge.tabIndex)).toEqual([0, -1, -1]);
    await key(first, 'ArrowRight');
    expect(wedges().map((wedge) => wedge.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('selects the focused slot on Enter and Space, and the append slot from the button', async () => {
    await render();
    const [, second] = wedges();
    await key(second, 'Enter');
    expect(onSelectSlot).toHaveBeenLastCalledWith(1);
    await key(second, ' ');
    expect(onSelectSlot).toHaveBeenLastCalledWith(1);
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Add command'))!;
    await act(async () => {
      add.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectSlot).toHaveBeenLastCalledWith(3);
  });

  it('moves the command, not just focus, on Alt+Arrow', async () => {
    await render();
    const [first, , third] = wedges();
    await key(first, 'ArrowRight', { altKey: true });
    expect(onMoveItem).toHaveBeenLastCalledWith(0, 1);
    await key(third, 'ArrowLeft', { altKey: true });
    expect(onMoveItem).toHaveBeenLastCalledWith(2, 1);
    // Alt+Arrow wraps like plain arrows do.
    await key(third, 'ArrowRight', { altKey: true });
    expect(onMoveItem).toHaveBeenLastCalledWith(2, 0);
    expect(onSelectSlot).not.toHaveBeenCalled();
  });

  it('does not treat Alt+Arrow as a move when reordering is not offered', async () => {
    await render({ onMoveItem: undefined });
    const [first, second] = wedges();
    await key(first, 'ArrowRight', { altKey: true });
    expect(document.activeElement).toBe(second);
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it('reports a drop with the wedge it landed on, or none for the surface', async () => {
    await render();
    const [, second] = wedges();
    const item: ChatWheelDragPayload = { kind: 'item', menu: 0, index: 0 };
    await act(async () => {
      second.dispatchEvent(dragEvent('dragover', item));
    });
    expect(host.querySelector('[data-drop-target]')?.getAttribute('data-drop-target')).toBe('1');
    await act(async () => {
      second.dispatchEvent(dragEvent('drop', item));
    });
    expect(onDrop).toHaveBeenLastCalledWith(item, 1);
    expect(host.querySelector('[data-drop-target]')).toBeNull();

    const command: ChatWheelDragPayload = { kind: 'command', id: 'Can Heal' };
    await act(async () => {
      host.querySelector('svg')!.dispatchEvent(dragEvent('drop', command));
    });
    expect(onDrop).toHaveBeenLastCalledWith(command, undefined);
  });

  it('ignores drops that do not carry a chat wheel payload', async () => {
    await render();
    await act(async () => {
      wedges()[0].dispatchEvent(dragEvent('dragover', null));
      wedges()[0].dispatchEvent(dragEvent('drop', null));
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(host.querySelector('[data-drop-target]')).toBeNull();
  });

  it('marks wedges draggable only when a drag handler is offered', async () => {
    await render();
    expect(wedges()[0].getAttribute('draggable')).toBe('true');
    await render({ onMoveItem: undefined, onDrop: undefined });
    expect(wedges()[0].getAttribute('draggable')).toBeNull();
  });
});
