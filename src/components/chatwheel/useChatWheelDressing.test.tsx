// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatWheelDressing } from '../../types/chatWheelDressing';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The gate lives here, not in main: the Foundry flag and the game path both
 * come from the settings store, and the hook must answer null for every
 * closed-gate and every failure case without the page learning why. The IPC
 * wrapper is mocked at the `lib/api` boundary, the same seam the page test
 * uses, so a missing method (an older preload) also lands on null.
 */
const apiMock = vi.hoisted(() => ({
  getChatWheelDressing: vi.fn<() => Promise<ChatWheelDressing | null>>(),
}));

vi.mock('../../lib/api', () => apiMock);

import { chatWheelDressingEnabled, useChatWheelDressing, type DressingSettings } from './useChatWheelDressing';

const DRESSED: ChatWheelDressing = {
  backplateUrl: 'grimoire-foundry://key/other@full/chat_wheel_bg.png',
  entryPath: 'panorama/images/hud/chat_wheel_bg.vtex_c',
};

const ON: DressingSettings = { experimentalFoundry: true, deadlockPath: '/games/deadlock', devMode: false, devDeadlockPath: null };

function Host({ settings }: { settings: DressingSettings }) {
  const dressing = useChatWheelDressing(settings);
  return <output data-testid="out">{dressing ? dressing.backplateUrl : 'none'}</output>;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('chatWheelDressingEnabled', () => {
  it('is closed without settings, without the Foundry flag, or without a game path', () => {
    expect(chatWheelDressingEnabled(null)).toBe(false);
    expect(chatWheelDressingEnabled(undefined)).toBe(false);
    expect(chatWheelDressingEnabled({ ...ON, experimentalFoundry: false })).toBe(false);
    expect(chatWheelDressingEnabled({ ...ON, experimentalFoundry: undefined })).toBe(false);
    expect(chatWheelDressingEnabled({ ...ON, deadlockPath: null })).toBe(false);
    expect(chatWheelDressingEnabled({ ...ON, deadlockPath: '   ' })).toBe(false);
  });

  it('is open with the flag and a configured path', () => {
    expect(chatWheelDressingEnabled(ON)).toBe(true);
  });

  it('counts the dev dummy path only while dev mode is on, like getActiveDeadlockPath', () => {
    expect(chatWheelDressingEnabled({ experimentalFoundry: true, deadlockPath: null, devMode: true, devDeadlockPath: '/dev/dummy' })).toBe(true);
    expect(chatWheelDressingEnabled({ experimentalFoundry: true, deadlockPath: null, devMode: false, devDeadlockPath: '/dev/dummy' })).toBe(false);
  });
});

describe('useChatWheelDressing', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    apiMock.getChatWheelDressing.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function render(settings: DressingSettings): Promise<string> {
    await act(async () => {
      root.render(<Host settings={settings} />);
    });
    await act(async () => {
      await flush();
    });
    return host.querySelector('[data-testid="out"]')?.textContent ?? '';
  }

  it('is null with the Foundry flag off and never asks main', async () => {
    apiMock.getChatWheelDressing.mockResolvedValue(DRESSED);
    expect(await render({ ...ON, experimentalFoundry: false })).toBe('none');
    expect(apiMock.getChatWheelDressing).not.toHaveBeenCalled();
  });

  it('is null without a game path and never asks main', async () => {
    apiMock.getChatWheelDressing.mockResolvedValue(DRESSED);
    expect(await render({ ...ON, deadlockPath: null })).toBe('none');
    expect(apiMock.getChatWheelDressing).not.toHaveBeenCalled();
  });

  it('is null when the resolver rejects', async () => {
    apiMock.getChatWheelDressing.mockRejectedValue(new Error('decode failed'));
    expect(await render(ON)).toBe('none');
    expect(apiMock.getChatWheelDressing).toHaveBeenCalledTimes(1);
  });

  it('is null when the resolver finds nothing', async () => {
    apiMock.getChatWheelDressing.mockResolvedValue(null);
    expect(await render(ON)).toBe('none');
  });

  it('carries the URL when the gate is open and the resolver succeeds', async () => {
    apiMock.getChatWheelDressing.mockResolvedValue(DRESSED);
    expect(await render(ON)).toBe(DRESSED.backplateUrl);
  });

  it('drops back to null the moment the gate closes', async () => {
    apiMock.getChatWheelDressing.mockResolvedValue(DRESSED);
    expect(await render(ON)).toBe(DRESSED.backplateUrl);
    expect(await render({ ...ON, experimentalFoundry: false })).toBe('none');
  });
});
