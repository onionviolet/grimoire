// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaseCommandCatalog from './BaseCommandCatalog';
import { CHAT_WHEEL_COMMANDS, CHAT_WHEEL_COMMAND_COUNTS } from '../../lib/chatWheelCommands';
import type { ChatWheelModel, OverrideState } from '../../lib/chatWheelModel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The catalogue is a pure projection of the parsed model, so these tests hand
 * it models rather than YAML and assert on what it renders and what it hands
 * back. There is no testing-library in this repo: the DOM is driven with real
 * events inside `act()`.
 */

const EMPTY: ChatWheelModel = { name: 'My Chat Wheel', menus: [] };

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('BaseCommandCatalog', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onSetOverride: ReturnType<typeof vi.fn<(id: string, map: 'bindable' | 'pingWheel', state: OverrideState) => void>>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onSetOverride = vi.fn<(id: string, map: 'bindable' | 'pingWheel', state: OverrideState) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  const render = async (props: Partial<Parameters<typeof BaseCommandCatalog>[0]> = {}) => {
    await act(async () => {
      root.render(
        <BaseCommandCatalog
          model={EMPTY}
          loading={false}
          disabled={false}
          onSetOverride={onSetOverride}
          {...props}
        />
      );
    });
    await act(async () => {
      await flush();
    });
  };

  const rows = () => Array.from(host.querySelectorAll('[role="listitem"]'));

  const click = async (element: Element) => {
    await act(async () => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const type = async (value: string) => {
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const chip = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.startsWith(label))!;

  const group = (label: string) => host.querySelector(`[role="group"][aria-label="${label}"]`)!;

  const optionsOf = (label: string) => Array.from(group(label).querySelectorAll('button'));

  const pressed = (label: string) =>
    optionsOf(label).find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent?.trim();

  it('renders one row per catalogued command', async () => {
    await render();
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.all);
    expect(CHAT_WHEEL_COMMAND_COUNTS.all).toBe(53);
  });

  it('narrows rows case-insensitively and updates the search summary', async () => {
    await render();
    await type('defend');
    const matches = CHAT_WHEEL_COMMANDS.filter((command) => command.id.toLowerCase().includes('defend')).length;
    expect(rows()).toHaveLength(matches);
    expect(host.textContent).toContain(`Showing ${matches} of 53 commands`);
  });

  it('filters to each category count from the chips', async () => {
    await render();
    await click(chip('Hidden'));
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.hidden);
    await click(chip('Broken'));
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.broken);
    await click(chip('Default'));
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.default);
    await click(chip('All'));
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.all);
  });

  it('derives on, off and inherit from the parsed override map', async () => {
    await render({
      model: { ...EMPTY, overrideBindable: { 'Can Heal': true, Help: false } },
    });
    expect(pressed('Can Heal: Chat Wheel')).toBe('On');
    expect(pressed('Help: Chat Wheel')).toBe('Off');
    expect(pressed('Yes: Chat Wheel')).toBe('Inherit');
    // The ping map is absent entirely, so every ping control inherits.
    expect(pressed('Can Heal: Ping wheel')).toBe('Inherit');
  });

  it('reports the command, the map and the new state when an option is pressed', async () => {
    await render();
    await click(optionsOf('Can Heal: Chat Wheel')[1]);
    expect(onSetOverride).toHaveBeenCalledWith('Can Heal', 'bindable', 'on');
    await click(optionsOf('Push Blue: Ping wheel')[2]);
    expect(onSetOverride).toHaveBeenCalledWith('Push Blue', 'pingWheel', 'off');
  });

  it('adds the ping-default tag exactly where the two defaults diverge', async () => {
    await render();
    const diverging = CHAT_WHEEL_COMMANDS.filter((command) => command.pingWheelBindable !== command.bindable);
    expect(diverging).toHaveLength(15);
    const tagged = rows().filter((row) => /ping wheel by default/.test(row.textContent ?? ''));
    expect(tagged).toHaveLength(15);
    const text = (id: string) => rows().find((row) => row.textContent?.startsWith(id))?.textContent ?? '';
    // isMenu default command: bindable, but not on the ping wheel.
    expect(text('Defend Lane')).toContain('Not on ping wheel by default');
    // hidden command: not bindable, but on the ping wheel.
    expect(text('Push Blue')).toContain('On ping wheel by default');
    expect(text('Can Heal')).not.toContain('ping wheel by default');
  });

  it('shows the broken caveat only while broken rows are in view', async () => {
    await render();
    expect(host.textContent).toContain('Broken commands are not bindable by default');
    await click(chip('Hidden'));
    expect(host.textContent).not.toContain('Broken commands are not bindable by default');
    await click(chip('Broken'));
    expect(host.textContent).toContain('Broken commands are not bindable by default');
  });

  it('renders no other-commands group when both maps are known', async () => {
    await render({ model: { ...EMPTY, overrideBindable: { 'Can Heal': true }, overridePingWheelBindable: {} } });
    expect(host.textContent).not.toContain('Other commands in this file');
  });

  it('surfaces unknown keys with an editable boolean per map and a Not set state', async () => {
    await render({
      model: { ...EMPTY, overrideBindable: { 'Mystery Command': true }, overridePingWheelBindable: {} },
    });
    expect(host.textContent).toContain('Other commands in this file');
    expect(host.textContent).toContain('Mystery Command');
    expect(pressed('Mystery Command: Chat Wheel')).toBe('On');
    // Absent from the ping map: neither option is pressed and the row says so.
    expect(pressed('Mystery Command: Ping wheel')).toBeUndefined();
    expect(group('Mystery Command: Ping wheel').parentElement?.textContent).toContain('Not set');
    await click(optionsOf('Mystery Command: Ping wheel')[0]);
    expect(onSetOverride).toHaveBeenCalledWith('Mystery Command', 'pingWheel', 'on');
    await click(optionsOf('Mystery Command: Chat Wheel')[1]);
    expect(onSetOverride).toHaveBeenCalledWith('Mystery Command', 'bindable', 'off');
  });

  it('offers an empty state that clears both the search and the filter', async () => {
    await render();
    await click(chip('Hidden'));
    await type('zzzz-no-such-command');
    expect(rows()).toHaveLength(0);
    expect(host.textContent).toContain('No commands match your search');
    const clear = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Clear search and filters')
    )!;
    await click(clear);
    expect(rows()).toHaveLength(CHAT_WHEEL_COMMAND_COUNTS.all);
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
  });

  it('replaces the list with four skeletons and disables the controls while loading', async () => {
    await render({ loading: true, disabled: true });
    expect(rows()).toHaveLength(0);
    expect(host.querySelectorAll('.skeleton-shimmer')).toHaveLength(4);
    expect(Array.from(host.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
  });

  it('keeps one tab stop per control group and moves focus, not value, on arrow keys', async () => {
    await render({ model: { ...EMPTY, overrideBindable: { 'Can Heal': true } } });
    const options = optionsOf('Can Heal: Chat Wheel');
    expect(options.map((button) => button.tabIndex)).toEqual([-1, 0, -1]);
    options[1].focus();
    await act(async () => {
      options[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement).toBe(optionsOf('Can Heal: Chat Wheel')[2]);
    expect(onSetOverride).not.toHaveBeenCalled();
  });

  it('uses no tab semantics anywhere', async () => {
    await render();
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
  });
});
