// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LimitationNote, { type ChatWheelLimitation } from './LimitationNote';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/** Each documented limitation, and a phrase its copy must carry so a
 *  rewrite cannot quietly drop the fact the note exists to disclose. */
const EXPECTED: ReadonlyArray<[ChatWheelLimitation, RegExp]> = [
  ['archmotherOrder', /Archmother team .* reverse order/],
  ['topSlot', /top slot .* wrong direction/],
  ['slotSelect', /which slot .* not be selectable/],
  ['unbindCrash', /gameinfo\.gi.*crash the game/],
  ['placeholderVoice', /placeholder voice line/],
];

describe('LimitationNote', () => {
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

  it.each(EXPECTED)('renders the %s disclosure as an identifiable note', async (limitation, phrase) => {
    await act(async () => {
      root.render(<LimitationNote limitation={limitation} />);
    });
    const note = host.querySelector('[role="note"]')!;
    expect(note.getAttribute('data-limitation')).toBe(limitation);
    expect(note.textContent).toMatch(phrase);
    // Capability, not an in-match promise: no note claims the game "will".
    expect(note.textContent).not.toMatch(/\bwill\b/);
    expect(note.textContent).not.toContain('\u2014');
  });
});
