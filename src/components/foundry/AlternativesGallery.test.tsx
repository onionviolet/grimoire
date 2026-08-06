// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import AlternativePreview from './AlternativesGallery';
import { buildFoundryPoolView } from './poolView';
import { collectFoundryChanges } from './changeList';
import { useToastStore } from '../../stores/toastStore';
import type { FoundryPoolMember } from './poolView';
import type { Mod } from '../../types/mod';
import type { FoundryForgeEdit } from '../../types/foundry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const IMAGE_ENTRY_PATH = 'panorama/images/heroes/bull.png';
const IMAGE_SOURCE_PATH = 'C:/Users/me/Pictures/neon.png';
const SOUND_ENTRY_PATH = 'sounds/weapons/bull/charge.vsnd_c';
const SOUND_MOD_ID = 'sound-mod';

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
 *  be derived from a member shape the pool view does not actually produce.
 *  Mirrors alternativePreview.test.ts's own fixture style. */
function memberFor(mods: Mod[], modId: string): FoundryPoolMember {
  const view = buildFoundryPoolView({
    mods,
    changes: collectFoundryChanges(mods),
    included: new Set<string>(),
  });
  const found = view.pools.flatMap((pool) => pool.members).find((member) => member.mod.id === modId);
  if (!found) throw new Error(`no pool member for ${modId}`);
  return found;
}

const visualMod = mod({
  id: 'visual-mod',
  name: 'Neon Abrams',
  sha256: 'aaa',
  foundryBuild: {
    writeSet: [IMAGE_ENTRY_PATH],
    parts: [
      {
        kind: 'texture',
        title: 'Neon portrait',
        entries: [IMAGE_ENTRY_PATH],
        category: 'hero-image',
        heroName: 'Abrams',
        sourceFileName: 'neon.png',
      },
    ],
    reforge: {
      name: 'Neon Abrams',
      edits: [textureEdit('e1', IMAGE_SOURCE_PATH, IMAGE_ENTRY_PATH)],
      confirmation: { writeSet: [IMAGE_ENTRY_PATH], collisionWinners: [] },
    },
  },
});

const soundMod = mod({
  id: SOUND_MOD_ID,
  name: 'Horn',
  sha256: 'bbb',
  soundSwap: {
    heroCodename: 'bull',
    event: 'Abrams.Charge',
    audioFileName: 'horn.mp3',
    loop: 'auto',
    pool: 'all',
    reforge: {
      heroName: 'Abrams',
      audioPath: 'C:/Users/me/Music/horn.mp3',
      assignments: [{ clipPath: SOUND_ENTRY_PATH, audioPath: 'C:/Users/me/Music/horn.mp3' }],
    },
  },
} as Partial<Mod>);

/** Flushes both the mocked IPC promise and the component's follow-on
 *  `await audio.play()`, which jsdom resolves as a plain (non-promise)
 *  undefined rather than the mock's own resolved value. Mirrors
 *  AssetSourcesPanel.test.tsx's own helper. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AlternativePreview alternatives gallery lane', () => {
  let host: HTMLDivElement;
  let root: Root;
  let sourceThumbnail: ReturnType<typeof vi.fn<(sourcePath: string) => Promise<string | null>>>;
  let auditionSourceClip: ReturnType<
    typeof vi.fn<(modId: string, entryPath: string) => Promise<string | null>>
  >;
  let play: MockInstance<() => Promise<void>>;
  let pause: MockInstance<() => void>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    // jsdom ships no media stack: HTMLMediaElement.prototype.play/pause are
    // not-implemented stubs. The component awaits play() inside a try/catch,
    // so an unstubbed call would not fail the test, it would just print a
    // stray "Not implemented" error and leave the audition path unasserted.
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    sourceThumbnail = vi.fn<(sourcePath: string) => Promise<string | null>>();
    auditionSourceClip = vi.fn<(modId: string, entryPath: string) => Promise<string | null>>();
    window.electronAPI = {
      foundry: {
        sourceThumbnail,
        auditionSourceClip,
      },
    } as unknown as typeof window.electronAPI;
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('resolves the mount-time source thumbnail and renders it for a visual member', async () => {
    sourceThumbnail.mockResolvedValue('grimoire-foundry://thumb/neon.png');
    const visualMember = memberFor([visualMod, soundMod], 'visual-mod');

    await act(async () => {
      root.render(<AlternativePreview member={visualMember} />);
      await sourceThumbnail.mock.results[0]?.value;
    });

    expect(sourceThumbnail).toHaveBeenCalledTimes(1);
    expect(sourceThumbnail).toHaveBeenCalledWith(IMAGE_SOURCE_PATH);

    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('grimoire-foundry://thumb/neon.png');
  });

  it('auditions the exact clicked sound member, disabling the control while pending and swapping the label once resolved', async () => {
    let resolveClip: (value: string | null) => void = () => {};
    auditionSourceClip.mockImplementation(
      () => new Promise<string | null>((resolve) => { resolveClip = resolve; })
    );
    const soundMember = memberFor([visualMod, soundMod], SOUND_MOD_ID);
    expect(soundMember.kind).toBe('sound');

    await act(async () => {
      root.render(<AlternativePreview member={soundMember} />);
    });

    const button = document.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Hear Horn');

    act(() => {
      button.click();
    });

    // Disabled synchronously, before the audition promise settles.
    expect(button.disabled).toBe(true);
    expect(auditionSourceClip).toHaveBeenCalledTimes(1);
    expect(auditionSourceClip).toHaveBeenCalledWith(SOUND_MOD_ID, SOUND_ENTRY_PATH);

    await act(async () => {
      resolveClip('blob:fake-clip-url');
      await flush();
    });

    expect(play).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-label')).toBe('Stop playing Horn');
    expect(button.disabled).toBe(false);
  });

  it('does not enter the playing state and reports the failure toast when the clip resolves null', async () => {
    auditionSourceClip.mockResolvedValue(null);
    const soundMember = memberFor([visualMod, soundMod], SOUND_MOD_ID);

    await act(async () => {
      root.render(<AlternativePreview member={soundMember} />);
    });

    const button = document.querySelector<HTMLButtonElement>('button')!;

    await act(async () => {
      button.click();
      await flush();
    });

    expect(auditionSourceClip).toHaveBeenCalledWith(SOUND_MOD_ID, SOUND_ENTRY_PATH);
    // A null clip URL must short-circuit before playback, not merely leave the
    // label alone.
    expect(play).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-label')).toBe('Hear Horn');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      tone: 'error',
      message: 'Could not extract a clip from Horn to play.',
    });
  });

  it('stops on a second click, pausing the element and returning the label to play form', async () => {
    auditionSourceClip.mockResolvedValue('blob:fake-clip-url');
    const soundMember = memberFor([visualMod, soundMod], SOUND_MOD_ID);

    await act(async () => {
      root.render(<AlternativePreview member={soundMember} />);
    });

    const button = document.querySelector<HTMLButtonElement>('button')!;

    await act(async () => {
      button.click();
      await flush();
    });
    expect(button.getAttribute('aria-label')).toBe('Stop playing Horn');

    await act(async () => {
      button.click();
      await flush();
    });

    expect(pause).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-label')).toBe('Hear Horn');
  });
});
