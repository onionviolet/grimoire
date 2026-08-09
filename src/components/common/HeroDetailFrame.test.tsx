// @vitest-environment jsdom

import '../../i18n';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HeroDetailFrame from './HeroDetailFrame';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/** The plate wrapper: the full-bleed backdrop container. */
const plateSelector = '.animate-hero-zoom-in';

function renderFrame(props: Partial<React.ComponentProps<typeof HeroDetailFrame>> = {}) {
  return (
    <HeroDetailFrame
      surface="locker"
      heroName="Seven"
      backLabel="Back"
      onBack={() => {}}
      navLabel="Sections"
      sections={[]}
      activeSection="skins"
      onSectionChange={() => {}}
      {...props}
    >
      <div>content</div>
    </HeroDetailFrame>
  );
}

describe('HeroDetailFrame plate slot', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = async (props: Partial<React.ComponentProps<typeof HeroDetailFrame>> = {}) => {
    await act(async () => {
      root.render(renderFrame(props));
    });
  };

  it('renders the image chain when no platePreview is supplied', async () => {
    await render();
    const plate = host.querySelector(plateSelector);
    expect(plate).not.toBeNull();
    expect(plate!.querySelector('img')).not.toBeNull();
    expect(host.textContent).toContain('content');
  });

  it('renders the caller-supplied plate node and no plate img when platePreview is set', async () => {
    await render({ platePreview: <div data-testid="model-plate">model</div> });
    expect(host.querySelector('[data-testid="model-plate"]')).not.toBeNull();
    expect(host.querySelector(`${plateSelector} img`)).toBeNull();
    expect(host.querySelector(`${plateSelector} [data-testid="model-plate"]`)).not.toBeNull();
  });

  it('spreads the platePanel ARIA bag onto the plate wrapper', async () => {
    await render({
      platePanel: { id: 'stage-panel', role: 'tabpanel', 'aria-labelledby': 'stage-tab' },
    });
    const plate = host.querySelector(plateSelector);
    expect(plate?.getAttribute('id')).toBe('stage-panel');
    expect(plate?.getAttribute('role')).toBe('tabpanel');
    expect(plate?.getAttribute('aria-labelledby')).toBe('stage-tab');
  });

  it('falls back to the hero-name text when neither a backdrop nor a render source resolves', async () => {
    await render();
    const plateImg = () => host.querySelector<HTMLImageElement>(`${plateSelector} img`);
    expect(plateImg()).not.toBeNull();
    // Walk the render fallback chain: render -> wiki -> (no icon) -> give up.
    await act(async () => {
      plateImg()!.dispatchEvent(new Event('error'));
    });
    await act(async () => {
      plateImg()!.dispatchEvent(new Event('error'));
    });
    const plate = host.querySelector(plateSelector);
    expect(plate!.querySelector('img')).toBeNull();
    expect(plate!.textContent).toContain('Seven');
  });

  it('keeps the frame free of domain and renderer imports', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/common/HeroDetailFrame.tsx'),
      'utf8'
    );
    const importLines = source
      .split('\n')
      .filter((line) => /^import\s/.test(line.trim()))
      .join('\n');
    // The frame's stated invariant: it may import React, icons, and lib
    // utilities, but never three.js, @react-three, a Locker/Foundry component
    // path, or a store. The check reads only import lines, so prose in a
    // comment cannot trip it.
    expect(importLines).not.toMatch(/three|@react-three|components\/locker|components\/foundry|stores\//);
  });
});
