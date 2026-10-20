import { describe, expect, it } from 'vitest';
import {
  fingerprintSelection,
  isCardSelectClick,
  modFingerprint,
  pruneStaleSelection,
  selectEntryRange,
  visibleSelectionEntries,
  type SelectionEntry,
} from './selection';

const entries: SelectionEntry[] = [
  { key: 'talon', ids: ['talon'] },
  { key: 'variants', ids: ['variant-a', 'variant-b'] },
  { key: 'mcginnis', ids: ['mcginnis'] },
  { key: 'other', ids: ['other'] },
];

describe('installed range selection', () => {
  it('selects an inclusive range and all grouped variants, preserving other selections', () => {
    expect(selectEntryRange(new Set(['talon', 'other']), entries, 'talon', entries[2], true))
      .toEqual(new Set(['talon', 'variant-a', 'variant-b', 'mcginnis', 'other']));
  });

  it('selects a range backwards in the displayed order', () => {
    expect(selectEntryRange(new Set(['mcginnis']), entries, 'mcginnis', entries[0], true))
      .toEqual(new Set(['talon', 'variant-a', 'variant-b', 'mcginnis']));
  });

  it('deselects an inclusive range and grouped variants without clearing other selections', () => {
    const selected = new Set(entries.flatMap((entry) => entry.ids));
    expect(selectEntryRange(selected, entries, 'talon', entries[2], true))
      .toEqual(new Set(['other']));
    expect(selectEntryRange(selected, entries, 'mcginnis', entries[0], true))
      .toEqual(new Set(['other']));
  });

  it('selects a partially selected target group instead of removing the range', () => {
    expect(selectEntryRange(new Set(['talon', 'variant-a']), entries, 'talon', entries[1], true))
      .toEqual(new Set(['talon', 'variant-a', 'variant-b']));
  });

  it('only includes displayed entries after filtering or collapsing a section', () => {
    expect(selectEntryRange(new Set(['talon']), [entries[0], entries[2]], 'talon', entries[2], true))
      .toEqual(new Set(['talon', 'mcginnis']));
  });

  it('falls back to an ordinary toggle when the anchor is absent', () => {
    expect(selectEntryRange(new Set(), entries, 'hidden', entries[2], true))
      .toEqual(new Set(['mcginnis']));
  });

  it('toggles whole groups on ordinary clicks, including partially selected groups', () => {
    const selected = selectEntryRange(new Set(['variant-a']), entries, null, entries[1], false);
    expect(selected).toEqual(new Set(['variant-a', 'variant-b']));
    expect(selectEntryRange(selected, entries, null, entries[1], false)).toEqual(new Set());
  });
});

const mod = (id: string, size = 10, installedAt = '2026-01-01T00:00:00.000Z') => ({ id, size, installedAt });
const single = (id: string) => ({ kind: 'single' as const, key: id, mod: { id } });
const group = (key: string, ...ids: string[]) =>
  ({ kind: 'group' as const, key, variants: ids.map((id) => ({ id })) });

describe('visibleSelectionEntries', () => {
  const enabled = [single('a'), group('g', 'g1', 'g2')];
  const disabled = [single('d')];

  it('lists enabled then disabled entries with every variant id', () => {
    expect(visibleSelectionEntries(enabled, disabled, false, false)).toEqual([
      { key: 'a', ids: ['a'] },
      { key: 'g', ids: ['g1', 'g2'] },
      { key: 'd', ids: ['d'] },
    ]);
  });

  it('leaves out a collapsed section', () => {
    expect(visibleSelectionEntries(enabled, disabled, true, false)).toEqual([{ key: 'd', ids: ['d'] }]);
    expect(visibleSelectionEntries(enabled, disabled, false, true).flatMap((e) => e.ids))
      .toEqual(['a', 'g1', 'g2']);
    expect(visibleSelectionEntries(enabled, disabled, true, true)).toEqual([]);
  });
});

describe('stale selection pruning', () => {
  it('fingerprints selected ids from the current mods and keeps earlier fingerprints', () => {
    const previous = new Map([['a', 'old']]);
    const next = fingerprintSelection(['a', 'b', 'gone'], previous, [mod('a'), mod('b', 5, 't')]);
    expect(next).toEqual(new Map([['a', 'old'], ['b', modFingerprint(mod('b', 5, 't'))]]));
  });

  it('returns the same map when nothing changed', () => {
    const selection = fingerprintSelection(['a', 'b'], new Map(), [mod('a'), mod('b')]);
    expect(pruneStaleSelection(selection, [mod('b'), mod('a'), mod('c')])).toBe(selection);
  });

  it('drops ids that disappeared', () => {
    const selection = fingerprintSelection(['a', 'b'], new Map(), [mod('a'), mod('b')]);
    expect([...pruneStaleSelection(selection, [mod('b')]).keys()]).toEqual(['b']);
  });

  it('drops an id whose file changed size or mtime behind it', () => {
    const selection = fingerprintSelection(['a', 'b', 'c'], new Map(), [mod('a'), mod('b'), mod('c')]);
    const kept = pruneStaleSelection(selection, [mod('a', 11), mod('b', 10, 'later'), mod('c')]);
    expect([...kept.keys()]).toEqual(['c']);
  });

  it('keeps a selection whose file was only renamed (same id, size and mtime)', () => {
    const selection = fingerprintSelection(['a'], new Map(), [mod('a')]);
    expect(pruneStaleSelection(selection, [{ ...mod('a'), fileName: 'pak05_dir.vpk' } as ReturnType<typeof mod>]))
      .toBe(selection);
  });
});

describe('isCardSelectClick', () => {
  const inside = new Set<unknown>();
  const card = { contains: (node: unknown) => inside.has(node) };
  const node = (matchesTextEntry: boolean, within = true) => {
    const n = { closest: () => (matchesTextEntry ? {} : null) };
    if (within) inside.add(n);
    return n;
  };

  it('accepts clicks on the card body', () => {
    expect(isCardSelectClick(card, node(false))).toBe(true);
  });

  it('ignores clicks that bubbled from a portal outside the card', () => {
    expect(isCardSelectClick(card, node(false, false))).toBe(false);
  });

  it('ignores clicks on text entry elements inside the card', () => {
    expect(isCardSelectClick(card, node(true))).toBe(false);
  });
});
