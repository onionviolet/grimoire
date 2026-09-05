// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RadialWheelPreview from './RadialWheelPreview';
import type { ChatWheelDressing } from '../../types/chatWheelDressing';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The pure-SVG wheel is the permanent fallback, so "undressed" must mean
 * byte-for-byte the markup it had before dressing existed: no clip path, no
 * image, no changed wedge classes. Dressing adds one decorative image behind
 * the ring and touches nothing about the slots themselves.
 */

const DRESSING: ChatWheelDressing = {
  backplateUrl: 'grimoire-foundry://key/other@full/chat_wheel_bg.png',
  entryPath: 'panorama/images/hud/chat_wheel_bg.vtex_c',
};

const ITEMS = ['On My Way', 'Help', 'Thanks'];

type Dressing = ChatWheelDressing | null | undefined;

describe('RadialWheelPreview dressing', () => {
  let hosts: HTMLDivElement[];
  let roots: Root[];

  beforeEach(() => {
    hosts = [];
    roots = [];
  });

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount());
    for (const host of hosts) host.remove();
  });

  async function render(dressing: Dressing, withProp = true): Promise<HTMLDivElement> {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    hosts.push(host);
    roots.push(root);
    await act(async () => {
      root.render(
        withProp ? (
          <RadialWheelPreview menuName="Go" icon="quick" items={ITEMS} focusedSlot={1} onSelectSlot={() => {}} dressing={dressing} />
        ) : (
          <RadialWheelPreview menuName="Go" icon="quick" items={ITEMS} focusedSlot={1} onSelectSlot={() => {}} />
        )
      );
    });
    return host;
  }

  function slotMarkup(host: HTMLElement): string[] {
    return [...host.querySelectorAll('path[role="button"]')].map(
      (path) => `${path.getAttribute('aria-label')}|${path.getAttribute('d')}|${path.getAttribute('class')}`
    );
  }

  it('renders identical markup with the prop absent, undefined, and null', async () => {
    const absent = await render(undefined, false);
    const undefinedProp = await render(undefined);
    const nullProp = await render(null);
    expect(undefinedProp.innerHTML).toBe(absent.innerHTML);
    expect(nullProp.innerHTML).toBe(absent.innerHTML);
    expect(absent.querySelector('[data-testid="chat-wheel-backplate"]')).toBeNull();
    expect(absent.querySelector('clipPath')).toBeNull();
    expect(slotMarkup(absent)).toHaveLength(ITEMS.length);
  });

  it('draws the backplate image behind the wedges when dressed, leaving the slots in place', async () => {
    const plain = await render(null);
    const dressed = await render(DRESSING);

    const image = dressed.querySelector('[data-testid="chat-wheel-backplate"]');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('href')).toBe(DRESSING.backplateUrl);
    expect(image?.getAttribute('aria-hidden')).toBe('true');
    expect(image?.getAttribute('clip-path')).toMatch(/^url\(#[A-Za-z0-9_-]+\)$/);

    const firstWedge = dressed.querySelector('path[role="button"]');
    expect(firstWedge).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: the wedge comes after the image, so it paints on top.
    expect(image!.compareDocumentPosition(firstWedge!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Same slots, same geometry, same labels; only the idle fill goes translucent.
    const strip = (rows: string[]) => rows.map((row) => row.split('|').slice(0, 2).join('|'));
    expect(strip(slotMarkup(dressed))).toEqual(strip(slotMarkup(plain)));
    const focused = dressed.querySelectorAll('path[role="button"]')[1];
    expect(focused?.getAttribute('class')).toContain('fill-accent/25');
  });
});
