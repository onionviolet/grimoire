// @vitest-environment jsdom

import '../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmContext, type ConfirmFn } from '../components/common/confirmContext';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Covers the page-level experimental gate added in 02-03: `ChatWheel` reads
 * `experimentalChatWheel` directly rather than trusting the sidebar filter,
 * so any navigation path (URL bar, stale bookmark, deep link) lands on the
 * same disabled state. The third case below (`settings` undefined) exists
 * because without the optional chaining the guard uses, the editor would
 * render for one frame before the settings store finishes loading: exactly
 * the frame this gate is meant to prevent (T-02-03-B).
 */

const appStoreMock = vi.hoisted(() => ({
  settings: undefined as { experimentalChatWheel: boolean } | undefined,
  loadMods: vi.fn(async () => undefined),
}));

const apiMock = vi.hoisted(() => ({
  getMods: vi.fn(async () => []),
  readChatWheel: vi.fn(async () => ''),
  saveChatWheel: vi.fn(async () => null),
  // The real starter shape (resources/chatlane/starter.yml): both override
  // maps ship as inline `{}`, so the round-trip tests below exercise the
  // inline-to-block path rather than an append-at-end path that never runs.
  getChatWheelStarter: vi.fn(
    async () =>
      'name: My Chat Wheel\n\noverride_bindable: {}\noverride_ping_wheel_bindable: {}\n\ncustom_menus:\n'
  ),
  getChatWheelStatus: vi.fn(async () => ({ available: true })),
  validateChatWheel: vi.fn(async () => undefined),
}));

vi.mock('../stores/appStore', () => ({
  useAppStore: <T,>(selector: (state: typeof appStoreMock) => T): T => selector(appStoreMock),
}));

vi.mock('../lib/api', () => apiMock);

import ChatWheel from './ChatWheel';
import { CHAT_WHEEL_DRAG_TYPE, type ChatWheelDragPayload } from '../lib/chatWheelMenuEdit';

/** One macrotask turn, so the effect chain (refreshWheels, the starter fetch,
 *  the converter-status fetch) settles before the next assertion. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ChatWheel page gate', () => {
  let host: HTMLDivElement;
  let root: Root;
  let confirmFn: ReturnType<typeof vi.fn<ConfirmFn>>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    confirmFn = vi.fn<ConfirmFn>().mockResolvedValue(true);
    appStoreMock.settings = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(
        <ConfirmContext.Provider value={confirmFn}>
          <ChatWheel />
        </ConfirmContext.Provider>
      );
    });
    await act(async () => {
      await flush();
      await flush();
    });
  };

  it('renders the disabled state and none of the editor controls when experimentalChatWheel is false', async () => {
    appStoreMock.settings = { experimentalChatWheel: false };
    await renderPage();

    expect(host.textContent).toContain('Chat Wheel is off');
    expect(document.querySelector('textarea')).toBeNull();
    expect(
      Array.from(document.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Save & install')
      )
    ).toBe(false);
  });

  it('renders the normal editor UI and no disabled state when experimentalChatWheel is true', async () => {
    appStoreMock.settings = { experimentalChatWheel: true };
    await renderPage();

    expect(host.textContent).not.toContain('Chat Wheel is off');
    expect(document.querySelector('textarea')).not.toBeNull();
    expect(
      Array.from(document.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Save & install')
      )
    ).toBe(true);
  });

  it('renders the disabled state before settings have loaded, when settings is still undefined', async () => {
    appStoreMock.settings = undefined;
    await renderPage();

    expect(host.textContent).toContain('Chat Wheel is off');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('renders the base command catalogue open, and round-trips an override through the YAML', async () => {
    appStoreMock.settings = { experimentalChatWheel: true };
    await renderPage();

    const details = Array.from(document.querySelectorAll('details')).find((element) =>
      element.querySelector('summary')?.textContent?.includes('Base command catalogue')
    )!;
    expect(details).toBeDefined();
    expect(details.open).toBe(true);

    // No testing-library in this repo: real events, dispatched inside act().
    const group = document.querySelector('[role="group"][aria-label="Can Heal: Chat Wheel"]')!;
    const on = Array.from(group.querySelectorAll('button'))[1];
    await act(async () => {
      on.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await flush();
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('override_bindable:\n  Can Heal: true');

    // ...and a manual Advanced YAML edit flows back into the control.
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(
        textarea,
        'name: My Chat Wheel\n\noverride_bindable:\n  Can Heal: false\noverride_ping_wheel_bindable: {}\n\ncustom_menus:\n'
      );
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      await flush();
    });

    const after = Array.from(
      document.querySelector('[role="group"][aria-label="Can Heal: Chat Wheel"]')!.querySelectorAll('button')
    );
    expect(after[2].getAttribute('aria-pressed')).toBe('true');
    expect(after[1].getAttribute('aria-pressed')).toBe('false');
  });
});

/**
 * Phase 10: the disclosures, and the keyboard alternatives to every drag-only
 * interaction (Move up / Move down, Alt+Arrow, Add to menu, Move to menu),
 * asserted on the YAML they produce so the existing byte-preserving path is
 * the one being exercised. A list drop is covered with a hand-made
 * dataTransfer, since jsdom has no DragEvent.
 */
describe('ChatWheel menu building', () => {
  const STARTER =
    'name: My Chat Wheel\n\noverride_bindable: {}\noverride_ping_wheel_bindable: {}\n\ncustom_menus:\n' +
    '  - name: My Messages\n    icon: quick\n    items:\n      - On My Way\n      - Help\n      - Thanks\n';
  const TWO_MENUS = STARTER + '  - name: Second\n    icon: quick\n    items:\n      - Yes\n';

  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    appStoreMock.settings = { experimentalChatWheel: true };
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  const renderPage = async (starter = STARTER) => {
    apiMock.getChatWheelStarter.mockResolvedValueOnce(starter);
    await act(async () => {
      root.render(
        <ConfirmContext.Provider value={vi.fn<ConfirmFn>().mockResolvedValue(true)}>
          <ChatWheel />
        </ConfirmContext.Provider>
      );
    });
    await act(async () => {
      await flush();
      await flush();
    });
  };

  const yaml = () => (document.querySelector('textarea') as HTMLTextAreaElement).value;
  const items = () => (yaml().split('    items:\n')[1] ?? '').split('\n').filter((line) => line.startsWith('      - ')).map((line) => line.slice(8));
  const byLabel = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
  const click = async (element: Element) => {
    await act(async () => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  it('renders each of the five documented limitations near its control', async () => {
    await renderPage();
    const notes = Array.from(document.querySelectorAll('[role="note"][data-limitation]'));
    expect(notes.map((note) => note.getAttribute('data-limitation')).sort()).toEqual(
      ['archmotherOrder', 'placeholderVoice', 'slotSelect', 'topSlot', 'unbindCrash']
    );
    // Placement: the menu notes precede the menu editor, the wheel notes sit
    // with the preview, and the crash note sits beside Save & install.
    const save = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Save & install'))!;
    const crash = document.querySelector('[data-limitation="unbindCrash"]')!;
    expect(crash.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const wheel = document.querySelector('svg[aria-label="Chat wheel preview"]')!;
    const order = document.querySelector('[data-limitation="archmotherOrder"]')!;
    expect(wheel.compareDocumentPosition(order) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reorders with the Move up / Move down buttons and writes the new order to the YAML', async () => {
    await renderPage();
    expect(items()).toEqual(['On My Way', 'Help', 'Thanks']);
    expect((byLabel('Move On My Way up') as HTMLButtonElement).disabled).toBe(true);
    expect((byLabel('Move Thanks down') as HTMLButtonElement).disabled).toBe(true);
    await click(byLabel('Move On My Way down'));
    expect(items()).toEqual(['Help', 'On My Way', 'Thanks']);
    await click(byLabel('Move Thanks up'));
    expect(items()).toEqual(['Help', 'Thanks', 'On My Way']);
    // The rest of the file is untouched by a reorder.
    expect(yaml()).toContain('override_bindable: {}\noverride_ping_wheel_bindable: {}\n');
  });

  it('reorders with Alt+Arrow on a command input', async () => {
    await renderPage();
    const input = document.getElementById('chat-wheel-slot-0-2')!;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
    });
    expect(items()).toEqual(['On My Way', 'Thanks', 'Help']);
    // A plain arrow is left to the input.
    await act(async () => {
      document.getElementById('chat-wheel-slot-0-1')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    expect(items()).toEqual(['On My Way', 'Thanks', 'Help']);
  });

  it('appends a catalogue command to the active menu from its Add button', async () => {
    await renderPage();
    await click(byLabel('Add Can Heal to My Messages'));
    expect(items()).toEqual(['On My Way', 'Help', 'Thanks', 'Can Heal']);
    expect(yaml()).toContain('      - Thanks\n      - Can Heal\n');
  });

  it('moves a command to another menu from the Move to menu select', async () => {
    await renderPage(TWO_MENUS);
    const select = byLabel('Move Help to menu') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['My Messages', 'Second']);
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(select, '1');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(yaml()).toContain('    items:\n      - On My Way\n      - Thanks\n  - name: Second\n    icon: quick\n    items:\n      - Yes\n      - Help\n');
  });

  it('inserts a dropped catalogue command before the row it lands on', async () => {
    await renderPage();
    const payload: ChatWheelDragPayload = { kind: 'command', id: 'Can Heal' };
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: [CHAT_WHEEL_DRAG_TYPE],
        effectAllowed: 'copy',
        dropEffect: 'none',
        getData: (format: string) => (format === CHAT_WHEEL_DRAG_TYPE ? JSON.stringify(payload) : ''),
        setData: () => undefined,
      },
    });
    await act(async () => {
      document.querySelector('[data-item-index="1"]')!.dispatchEvent(event);
    });
    expect(items()).toEqual(['On My Way', 'Can Heal', 'Help', 'Thanks']);
  });

  it('reorders on the wheel by dropping one wedge on another', async () => {
    await renderPage();
    const payload: ChatWheelDragPayload = { kind: 'item', menu: 0, index: 0 };
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: [CHAT_WHEEL_DRAG_TYPE],
        effectAllowed: 'move',
        dropEffect: 'none',
        getData: (format: string) => (format === CHAT_WHEEL_DRAG_TYPE ? JSON.stringify(payload) : ''),
        setData: () => undefined,
      },
    });
    await act(async () => {
      document.querySelectorAll('path[role="button"]')[2]!.dispatchEvent(event);
    });
    expect(items()).toEqual(['Help', 'Thanks', 'On My Way']);
  });
});
