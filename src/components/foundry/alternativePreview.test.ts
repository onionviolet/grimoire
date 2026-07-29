import { describe, expect, it } from 'vitest';
import {
  alternativePreviewFor,
  memberAuditionEntry,
  memberSourceImagePath,
  rememberPreviewUrl,
} from './alternativePreview';
import { buildFoundryPoolView } from './poolView';
import { collectFoundryChanges } from './changeList';
import type { FoundryPoolMember } from './poolView';
import type { Mod } from '../../types/mod';
import type { FoundryForgeEdit } from '../../types/foundry';

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A change',
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Mod;
}

function textureEdit(id: string, imagePath: string, entryPath: string): FoundryForgeEdit {
  return {
    id,
    kind: 'texture',
    precedence: 0,
    request: { entryPath, imagePath, name: id, category: 'hero-image' },
  };
}

/** Members are always taken from the real pool builder, so a preview can never
 *  be derived from a member shape the pool view does not actually produce. */
function membersOf(mods: Mod[]): FoundryPoolMember[] {
  const view = buildFoundryPoolView({
    mods,
    changes: collectFoundryChanges(mods),
    included: new Set<string>(),
  });
  return view.pools.flatMap((pool) => pool.members);
}

const buildA = mod({
  id: 'build-a',
  name: 'Neon Abrams',
  sha256: 'aaa',
  foundryBuild: {
    writeSet: ['panorama/images/heroes/bull.png'],
    parts: [
      {
        kind: 'texture',
        title: 'Neon portrait',
        entries: ['panorama/images/heroes/bull.png'],
        category: 'hero-image',
        heroName: 'Abrams',
        sourceFileName: 'neon.png',
      },
    ],
    reforge: {
      name: 'Neon Abrams',
      edits: [textureEdit('e1', 'C:/Users/me/Pictures/neon.png', 'panorama/images/heroes/bull.png')],
      confirmation: { writeSet: ['panorama/images/heroes/bull.png'], collisionWinners: [] },
    },
  },
});

const buildB = mod({
  id: 'build-b',
  name: 'Chrome Abrams',
  enabled: false,
  sha256: 'bbb',
  foundryBuild: {
    writeSet: ['panorama/images/heroes/bull.png'],
    parts: [
      {
        kind: 'texture',
        title: 'Chrome portrait',
        entries: ['panorama/images/heroes/bull.png'],
        category: 'hero-image',
        heroName: 'Abrams',
        sourceFileName: 'chrome.png',
      },
    ],
    reforge: {
      name: 'Chrome Abrams',
      edits: [textureEdit('e2', 'C:/Users/me/Pictures/chrome.png', 'panorama/images/heroes/bull.png')],
      confirmation: { writeSet: ['panorama/images/heroes/bull.png'], collisionWinners: [] },
    },
  },
});

function memberFor(mods: Mod[], modId: string): FoundryPoolMember {
  const found = membersOf(mods).find((member) => member.mod.id === modId);
  if (!found) throw new Error(`no pool member for ${modId}`);
  return found;
}

describe('memberSourceImagePath', () => {
  it('reads the absolute path the build request retained', () => {
    expect(memberSourceImagePath(memberFor([buildA, buildB], 'build-a')))
      .toBe('C:/Users/me/Pictures/neon.png');
    expect(memberSourceImagePath(memberFor([buildA, buildB], 'build-b')))
      .toBe('C:/Users/me/Pictures/chrome.png');
  });

  it('picks the edit whose file matches the recorded source name in a multi-part build', () => {
    const multi = mod({
      id: 'multi',
      name: 'Two portraits',
      sha256: 'ccc',
      foundryBuild: {
        writeSet: ['panorama/images/heroes/bull.png', 'panorama/images/heroes/bull_minimap.png'],
        parts: [
          {
            kind: 'texture',
            title: 'Card',
            entries: ['panorama/images/heroes/bull.png'],
            category: 'hero-image',
            sourceFileName: 'card.png',
          },
          {
            kind: 'texture',
            title: 'Minimap',
            entries: ['panorama/images/heroes/bull_minimap.png'],
            category: 'hero-image',
            sourceFileName: 'minimap.png',
          },
        ],
        reforge: {
          name: 'Two portraits',
          edits: [
            textureEdit('e1', 'C:/pics/card.png', 'panorama/images/heroes/bull.png'),
            textureEdit('e2', 'C:/pics/minimap.png', 'panorama/images/heroes/bull_minimap.png'),
          ],
          confirmation: { writeSet: [], collisionWinners: [] },
        },
      },
    });
    // Two parts with different source names: the member records no single
    // source file, so nothing is picked rather than the wrong part's image.
    const member = memberFor([multi, buildA], 'multi');
    expect(member.sourceFileName).toBeUndefined();
    expect(memberSourceImagePath(member)).toBeNull();

    // Given a member that does name its source file, the matching edit wins.
    expect(memberSourceImagePath({ ...member, sourceFileName: 'minimap.png' }))
      .toBe('C:/pics/minimap.png');
  });

  it('has no path for a legacy texture replacement, which recorded a basename only', () => {
    const legacy = mod({
      id: 'legacy',
      name: 'Dash icon',
      sha256: 'ddd',
      textureReplacement: {
        entryPath: 'panorama/images/heroes/bull.png',
        imageFileName: 'dash.png',
        category: 'hero-image',
      },
    });
    expect(memberSourceImagePath(memberFor([legacy, buildA], 'legacy'))).toBeNull();
  });
});

describe('alternativePreviewFor', () => {
  it('gives a visual member its source image', () => {
    expect(alternativePreviewFor(memberFor([buildA, buildB], 'build-a')))
      .toEqual({ kind: 'image', sourcePath: 'C:/Users/me/Pictures/neon.png' });
  });

  it('gives a sound member an audition target instead of a thumbnail', () => {
    const swapA = mod({
      id: 'swap-a',
      name: 'Horn',
      sha256: 'e1',
      soundSwap: {
        heroCodename: 'bull',
        event: 'Abrams.Charge',
        audioFileName: 'horn.mp3',
        loop: 'auto',
        pool: 'all',
        reforge: {
          heroName: 'Abrams',
          audioPath: 'C:/Users/me/Music/horn.mp3',
          assignments: [
            { clipPath: 'sounds/weapons/bull/charge.vsnd_c', audioPath: 'C:/Users/me/Music/horn.mp3' },
          ],
        },
      },
    } as Partial<Mod>);
    const swapB = mod({
      id: 'swap-b',
      name: 'Airhorn',
      sha256: 'e2',
      soundSwap: {
        heroCodename: 'bull',
        event: 'Abrams.Charge',
        audioFileName: 'airhorn.mp3',
        loop: 'auto',
        pool: 'all',
        reforge: {
          heroName: 'Abrams',
          audioPath: 'C:/Users/me/Music/horn.mp3',
          assignments: [
            { clipPath: 'sounds/weapons/bull/charge.vsnd_c', audioPath: 'C:/Users/me/Music/horn.mp3' },
          ],
        },
      },
    } as Partial<Mod>);
    const member = memberFor([swapA, swapB], 'swap-a');
    expect(member.kind).toBe('sound');
    expect(alternativePreviewFor(member))
      .toEqual({ kind: 'sound', modId: 'swap-a', entryPath: 'sounds/weapons/bull/charge.vsnd_c' });
  });

  it('falls back to a Foundry-authored change\u2019s own recorded thumbnail', () => {
    const legacy = mod({
      id: 'legacy',
      name: 'Dash icon',
      sha256: 'ddd',
      thumbnailUrl: 'data:image/png;base64,AAAA',
      textureReplacement: {
        entryPath: 'panorama/images/heroes/bull.png',
        imageFileName: 'dash.png',
        category: 'hero-image',
      },
    });
    expect(alternativePreviewFor(memberFor([legacy, buildA], 'legacy')))
      .toEqual({ kind: 'recorded-thumbnail', src: 'data:image/png;base64,AAAA' });
  });

  it('shows nothing when a visual member recorded neither a path nor a thumbnail', () => {
    const bare = mod({
      id: 'bare',
      name: 'Bare replacement',
      sha256: 'fff',
      textureReplacement: {
        entryPath: 'panorama/images/heroes/bull.png',
        imageFileName: 'bare.png',
        category: 'hero-image',
      },
    });
    expect(alternativePreviewFor(memberFor([bare, buildA], 'bare'))).toBeNull();
  });

  it('never reports enabled state: a disabled member previews exactly like an enabled one', () => {
    const enabled = alternativePreviewFor(memberFor([buildA, buildB], 'build-a'));
    const disabled = alternativePreviewFor(memberFor([buildA, buildB], 'build-b'));
    expect(memberFor([buildA, buildB], 'build-b').enabled).toBe(false);
    expect(Object.keys(enabled ?? {})).toEqual(Object.keys(disabled ?? {}));
    expect(enabled?.kind).toBe('image');
    expect(disabled?.kind).toBe('image');
  });
});

describe('memberAuditionEntry', () => {
  it('prefers a compiled sound entry over an unrelated recorded path', () => {
    const member = {
      entries: ['panorama/images/x.png', 'sounds/weapons/bull/charge.vsnd_c'],
    } as FoundryPoolMember;
    expect(memberAuditionEntry(member)).toBe('sounds/weapons/bull/charge.vsnd_c');
  });

  it('is null when a member recorded no paths at all', () => {
    expect(memberAuditionEntry({ entries: [] } as unknown as FoundryPoolMember)).toBeNull();
  });
});

describe('rememberPreviewUrl', () => {
  it('holds the URL map to its bound, dropping the oldest lookup', () => {
    const cache = new Map<string, string | null>();
    for (let i = 0; i < 5; i += 1) rememberPreviewUrl(cache, `k${i}`, `u${i}`, 3);
    expect(cache.size).toBe(3);
    expect([...cache.keys()]).toEqual(['k2', 'k3', 'k4']);
  });

  it('re-reading a key refreshes its position rather than adding a duplicate', () => {
    const cache = new Map<string, string | null>();
    rememberPreviewUrl(cache, 'a', 'ua', 2);
    rememberPreviewUrl(cache, 'b', 'ub', 2);
    rememberPreviewUrl(cache, 'a', 'ua', 2);
    rememberPreviewUrl(cache, 'c', 'uc', 2);
    expect([...cache.keys()]).toEqual(['a', 'c']);
  });

  it('caches a null answer, so a missing source is not re-asked every render', () => {
    const cache = new Map<string, string | null>();
    rememberPreviewUrl(cache, 'gone.png', null);
    expect(cache.has('gone.png')).toBe(true);
    expect(cache.get('gone.png')).toBeNull();
  });
});
