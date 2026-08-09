// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultHeroStageMode,
  heroStageModeStorageKey,
  readHeroStageMode,
  useHeroStageMode,
} from './heroStageMode';
import type { ModelPanelSurface } from './useModelPanelOpen';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The stage-mode choice is per-surface persisted state, so this file needs a
 * DOM to exercise the hook's setter and to reset localStorage between cases.
 */
function Harness({ surface }: { surface: ModelPanelSurface }) {
  const [mode, setMode] = useHeroStageMode(surface);
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'mode' }, mode),
    React.createElement('button', { type: 'button', onClick: () => setMode('image') }, 'to-image'),
    React.createElement('button', { type: 'button', onClick: () => setMode('model') }, 'to-model')
  );
}

describe('heroStageMode', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const render = async (surface: ModelPanelSurface) => {
    await act(async () => {
      root.render(React.createElement(Harness, { surface }));
    });
  };

  it('defaults the Locker to the model mode and Foundry to the image mode with no stored value', () => {
    expect(defaultHeroStageMode('locker')).toBe('model');
    expect(defaultHeroStageMode('foundry')).toBe('image');
    expect(readHeroStageMode('locker')).toBe('model');
    expect(readHeroStageMode('foundry')).toBe('image');
  });

  it('round-trips a written value through a fresh read', () => {
    localStorage.setItem(heroStageModeStorageKey('locker'), 'image');
    expect(readHeroStageMode('locker')).toBe('image');
    localStorage.setItem(heroStageModeStorageKey('foundry'), 'model');
    expect(readHeroStageMode('foundry')).toBe('model');
  });

  it('falls back to the surface default when a stored string is not a union member', () => {
    localStorage.setItem(heroStageModeStorageKey('locker'), '3d');
    localStorage.setItem(heroStageModeStorageKey('foundry'), 'preview');
    expect(readHeroStageMode('locker')).toBe('model');
    expect(readHeroStageMode('foundry')).toBe('image');
  });

  it('keeps the two surfaces on distinct keys so a Locker choice cannot move Foundry', () => {
    expect(heroStageModeStorageKey('locker')).not.toBe(heroStageModeStorageKey('foundry'));
    localStorage.setItem(heroStageModeStorageKey('locker'), 'image');
    localStorage.setItem(heroStageModeStorageKey('foundry'), 'model');
    expect(readHeroStageMode('locker')).toBe('image');
    expect(readHeroStageMode('foundry')).toBe('model');
  });

  it('yields the surface default when a localStorage accessor throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(readHeroStageMode('locker')).toBe('model');
    expect(readHeroStageMode('foundry')).toBe('image');
  });

  it('persists a choice made through the hook and reads it back through the pure reader', async () => {
    await render('locker');
    expect(host.querySelector('[data-testid="mode"]')?.textContent).toBe('model');

    await act(async () => {
      host.querySelectorAll('button')[0]!.click();
    });
    expect(host.querySelector('[data-testid="mode"]')?.textContent).toBe('image');
    expect(localStorage.getItem(heroStageModeStorageKey('locker'))).toBe('image');
    expect(readHeroStageMode('locker')).toBe('image');

    // A fresh mount reads the stored value rather than the surface default.
    const host2 = document.createElement('div');
    document.body.append(host2);
    const root2 = createRoot(host2);
    await act(async () => {
      root2.render(React.createElement(Harness, { surface: 'locker' }));
    });
    expect(host2.querySelector('[data-testid="mode"]')?.textContent).toBe('image');
    act(() => root2.unmount());
    host2.remove();
  });
});
