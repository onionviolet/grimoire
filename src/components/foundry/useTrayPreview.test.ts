// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { foundryBuildTrayPreview, foundryReleaseTrayPreview } from '../../lib/api';
import type { FoundryStagedEdit } from './buildTray';
import { useTrayPreview } from './useTrayPreview';
import type { VisualStagedEdit } from './visualEdits';

vi.mock('../../lib/api', () => ({
  foundryBuildTrayPreview: vi.fn(),
  foundryReleaseTrayPreview: vi.fn(),
}));

const REBUILD_DELAY_MS = 700;

function visualEdit(id: string): VisualStagedEdit {
  const entryPath = `materials/heroes/abrams/tex_${id}.vmat_c`;
  return {
    id,
    kind: 'texture',
    title: `Texture ${id}`,
    affectedFiles: [entryPath],
    precedence: 0,
    source: {
      entryPath,
      imagePath: `C:\\tmp\\${id}.png`,
      imageLabel: `${id}.png`,
      name: `Texture ${id}`,
      category: 'hero-model',
    },
  };
}

function Harness({
  edits,
  enabled,
}: {
  edits: readonly FoundryStagedEdit[];
  enabled: boolean;
}) {
  const preview = useTrayPreview(edits, enabled);
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'previewId' }, preview.previewId ?? ''),
    React.createElement('span', { 'data-testid': 'building' }, String(preview.building)),
    React.createElement('span', { 'data-testid': 'error' }, preview.error ?? '')
  );
}

const read = (host: HTMLElement, key: string) =>
  host.querySelector(`[data-testid="${key}"]`)?.textContent;

describe('useTrayPreview stale window', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    vi.mocked(foundryBuildTrayPreview).mockResolvedValue('preview-1');
    vi.mocked(foundryReleaseTrayPreview).mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const render = async (edits: readonly FoundryStagedEdit[], enabled: boolean) => {
    await act(async () => {
      root.render(React.createElement(Harness, { edits, enabled }));
    });
  };

  /** Advance the debounce and flush the mocked build promise's microtasks. */
  const settleBuild = async () => {
    await act(async () => {
      vi.advanceTimersByTime(REBUILD_DELAY_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('reports a preview id and stops building after a first successful build', async () => {
    await render([visualEdit('a')], true);
    // Debounced: the build call waits for the tray to settle, but the
    // building state is immediate so the pill can say what is happening.
    expect(read(host, 'previewId')).toBe('');
    expect(read(host, 'building')).toBe('true');

    await settleBuild();

    expect(read(host, 'previewId')).toBe('preview-1');
    expect(read(host, 'building')).toBe('false');
    expect(read(host, 'error')).toBe('');
    expect(foundryBuildTrayPreview).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous preview id while a newer build is in flight (the stale window)', async () => {
    await render([visualEdit('a')], true);
    await settleBuild();
    expect(read(host, 'previewId')).toBe('preview-1');

    // Changing the tray's write set starts a new build without dropping the
    // id the screen is still showing. This is the exact window the stale pill
    // derives from: it goes red the moment someone makes the hook clear its
    // id on rebuild.
    vi.mocked(foundryBuildTrayPreview).mockResolvedValue('preview-2');
    await render([visualEdit('a'), visualEdit('b')], true);
    expect(read(host, 'building')).toBe('true');
    expect(read(host, 'previewId')).toBe('preview-1');

    await settleBuild();
    expect(read(host, 'previewId')).toBe('preview-2');
    expect(read(host, 'building')).toBe('false');
    // The superseded build handle is released, not leaked.
    expect(foundryReleaseTrayPreview).toHaveBeenCalledWith('preview-1');
  });

  it('replaces the id and clears building when the newer build lands', async () => {
    await render([visualEdit('a')], true);
    await settleBuild();
    vi.mocked(foundryBuildTrayPreview).mockResolvedValue('preview-3');
    await render([visualEdit('a'), visualEdit('b')], true);
    expect(read(host, 'building')).toBe('true');
    await settleBuild();
    expect(read(host, 'previewId')).toBe('preview-3');
    expect(read(host, 'building')).toBe('false');
  });

  it('clears the id and sets the error on a build failure, so failed and stale cannot both be true', async () => {
    vi.mocked(foundryBuildTrayPreview).mockRejectedValue(new Error('bake failed'));
    await render([visualEdit('a')], true);
    await settleBuild();
    expect(read(host, 'previewId')).toBe('');
    expect(read(host, 'building')).toBe('false');
    expect(read(host, 'error')).toBe('bake failed');
  });

  it('reports no preview id and no building for an empty visual write set or when disabled', async () => {
    await render([], true);
    expect(read(host, 'previewId')).toBe('');
    expect(read(host, 'building')).toBe('false');
    expect(read(host, 'error')).toBe('');
    expect(foundryBuildTrayPreview).not.toHaveBeenCalled();

    await render([visualEdit('a')], false);
    expect(read(host, 'previewId')).toBe('');
    expect(read(host, 'building')).toBe('false');
    expect(foundryBuildTrayPreview).not.toHaveBeenCalled();
  });
});
