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
