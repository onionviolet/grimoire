// @vitest-environment jsdom

import i18n from '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundChangeDetails } from './MySoundChanges';
import { describeSoundTuning, soundTuningBadges, type SoundTuningState } from './soundTuning';
import { ConfirmContext, type ConfirmFn } from '../common/confirmContext';
import type { Mod } from '../../types/mod';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

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

const baseSwap = {
  heroCodename: 'gigawatt',
  event: 'Gigawatt.LightningBall.Damage',
  audioFileName: 'zap.mp3',
  loop: 'auto' as const,
  pool: 'all' as const,
};

/** The compiled entry this fixture's recorded clip claims (mirrors
 *  MySoundChanges.tsx's own compiledSoundEntry: .vsnd -> .vsnd_c). */
const WRITE_SET_PATH = 'sounds/x.vsnd_c';

const tunedMod = mod({
  id: 'tuned-mod',
  name: 'Gigawatt Zap',
  soundSwap: {
    ...baseSwap,
    reforge: {
      heroName: 'Gigawatt',
      audioPath: 'C:/audio/zap.mp3',
      assignments: [{ clipPath: 'sounds/x.vsnd', audioPath: 'C:/audio/zap.mp3' }],
      trimStartMs: 250,
      trimEndMs: 1800,
      gainDb: -2,
    },
  },
} as Partial<Mod>);

const untouchedMod = mod({
  id: 'untouched-mod',
  name: 'Gigawatt Ult',
  soundSwap: {
    ...baseSwap,
    reforge: {
      heroName: 'Gigawatt',
      audioPath: 'C:/audio/zap.mp3',
      assignments: [{ clipPath: 'sounds/x.vsnd', audioPath: 'C:/audio/zap.mp3' }],
    },
  },
} as Partial<Mod>);

function buildInspection(
  overrides: Partial<FoundryAssetSourcesInspection> = {},
): FoundryAssetSourcesInspection {
  return {
    paths: [],
    sources: [],
    winners: {},
    unreadableMods: [],
    ...overrides,
  };
}

describe('SoundChangeDetails sound trim/gain badge lane', () => {
  let host: HTMLDivElement;
  let root: Root;
  let inspectAssetSources: ReturnType<typeof vi.fn>;
  let checkAudioPaths: ReturnType<typeof vi.fn>;
  let swapSound: ReturnType<typeof vi.fn>;
  let onSaveAnnotation: ReturnType<typeof vi.fn<(key: string, name: string, note: string) => Promise<void>>>;
  let onOpenInInstalled: ReturnType<typeof vi.fn<(modId: string) => void>>;
  let confirmMock: ReturnType<typeof vi.fn<ConfirmFn>>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    inspectAssetSources = vi.fn().mockResolvedValue(buildInspection());
    checkAudioPaths = vi.fn().mockResolvedValue([]);
    swapSound = vi.fn().mockResolvedValue([]);
    onSaveAnnotation = vi.fn<(key: string, name: string, note: string) => Promise<void>>().mockResolvedValue(undefined);
    onOpenInInstalled = vi.fn<(modId: string) => void>();
    // SoundChangeDetails calls useConfirm(), which throws outside a provider.
    confirmMock = vi.fn<ConfirmFn>().mockResolvedValue(false);
    window.electronAPI = {
      foundry: {
        inspectAssetSources,
        checkAudioPaths,
        swapSound,
      },
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderDetails = async (testMod: Mod) => {
    await act(async () => {
      root.render(
        <ConfirmContext.Provider value={confirmMock}>
          <SoundChangeDetails
            mod={testMod}
            annotations={{}}
            onSaveAnnotation={onSaveAnnotation}
            onOpenInInstalled={onOpenInInstalled}
          />
        </ConfirmContext.Provider>
      );
    });
  };

  const badgeSpans = (): HTMLSpanElement[] => {
    const container = document.querySelector<HTMLSpanElement>(
      `span[title="${i18n.t('soundTools.badge.title')}"]`
    );
    if (!container) return [];
    return Array.from(container.querySelectorAll('span'));
  };

  const expandButton = (): HTMLButtonElement =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes(i18n.t('foundry.myChanges.eventDetails'))
    )!;

  it('renders the recorded trim/gain badges verbatim, with no rounding or re-derivation, and resolves the expanded winner text', async () => {
    inspectAssetSources.mockResolvedValue(buildInspection({
      paths: [WRITE_SET_PATH],
      winners: { [WRITE_SET_PATH]: 'tuned-mod' },
    }));

    await renderDetails(tunedMod);

    // The exact values the component must display, computed the same way the
    // component itself computes them: no hand-typed literal numbers.
    const tunedState = describeSoundTuning(tunedMod);
    const badges = soundTuningBadges(tunedState);
    const trimBadge = badges.find((badge) => badge.kind === 'trim');
    const gainBadge = badges.find((badge) => badge.kind === 'gain');
    expect(trimBadge?.value).toBeDefined();
    expect(gainBadge?.value).toBeDefined();

    const spans = badgeSpans();
    expect(spans).toHaveLength(2);
    expect(spans.map((span) => span.textContent)).toEqual([
      i18n.t('soundTools.badge.trim', { window: trimBadge!.value }),
      i18n.t('soundTools.badge.gain', { gain: gainBadge!.value }),
    ]);

    // The expanded detail surface: only visible after the mount-driven
    // inspectAssetSources effect resolves, so this covers the effect path,
    // not only static props.
    await act(async () => {
      expandButton().click();
      await inspectAssetSources.mock.results.at(-1)?.value;
    });

    expect(inspectAssetSources).toHaveBeenCalledWith([WRITE_SET_PATH]);
    expect(document.body.textContent).toContain(t_winsAll());
  });

  it('renders the untouched badge and no trim or gain badge', async () => {
    await renderDetails(untouchedMod);

    const untouchedState = describeSoundTuning(untouchedMod);
    const badges = soundTuningBadges(untouchedState);
    expect(badges).toEqual([{ kind: 'untouched' }]);

    const spans = badgeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe(i18n.t('soundTools.badge.untouched'));
  });

  it('the badge container has no reachable "no badges" state through any real Mod, so the guard is validated directly against soundTuningBadges', () => {
    // soundTuningBadges(state) always returns at least one badge for any state
    // describeSoundTuning can actually produce: `legacy` when unrecorded,
    // otherwise `untouched`, or a trim/gain/loop badge. No Mod fixture can
    // drive SoundTuningBadges's `if (!badges.length) return null` branch
    // today. Rather than assert a DOM state no Mod can reach (which would be
    // exactly the "coverage it does not have" failure mode this phase exists
    // to prevent, per the plan's transparency prohibition), this exercises the
    // exported pure function directly against the one state shape that would
    // trigger it, proving the guard's own logic is correct.
    const unreachableState: SoundTuningState = {
      recorded: true,
      trimmed: false,
      gained: false,
      loop: null,
      untouched: false,
      retunable: false,
    };
    expect(soundTuningBadges(unreachableState)).toEqual([]);
  });
});

/** `foundry.myChanges.winsAll` has no interpolated fields, so this is a plain
 *  catalog lookup rather than a hand-typed literal. */
function t_winsAll(): string {
  return i18n.t('foundry.myChanges.winsAll');
}
