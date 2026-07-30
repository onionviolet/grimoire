import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrokenPreviewBadge } from './HeroSkinsPanel';

const t = (key: string): string => key;

describe('BrokenPreviewBadge', () => {
  // Issue #16, definition of done 4: status must not be colour-only. Amber
  // pixels alone are invisible to a colourblind or greyscale reader, so the
  // badge has to carry both a glyph and a word.
  it('conveys the status with an icon and a label, not colour alone', () => {
    const html = renderToStaticMarkup(
      React.createElement(BrokenPreviewBadge, { names: ['pak56'], t })
    );

    expect(html).toContain('<svg');
    expect(html).toContain('locker.skins.previewBroken');
  });

  it('explains itself in the tooltip', () => {
    const html = renderToStaticMarkup(
      React.createElement(BrokenPreviewBadge, { names: ['pak56'], t })
    );

    expect(html).toContain('locker.skins.previewBrokenHint');
  });

  // A group card covers every variant of one upload, so the badge has to say
  // which file failed or the user has nothing to act on.
  it('names the failing files when a group has more than one', () => {
    const html = renderToStaticMarkup(
      React.createElement(BrokenPreviewBadge, { names: ['pak56', 'pak81'], t })
    );

    expect(html).toContain('pak56, pak81');
  });

  it('leaves the tooltip unqualified for a single failing file', () => {
    const html = renderToStaticMarkup(
      React.createElement(BrokenPreviewBadge, { names: ['pak56'], t })
    );

    expect(html).not.toContain('(pak56)');
  });
});
