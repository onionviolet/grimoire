// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortraitEditor from './PortraitEditor';
import { ConfirmContext, type ConfirmFn } from '../common/confirmContext';
import { cropToTargetRect } from './portraitFamily';
import type { TextureGridItem } from '../../types/foundry';
import type { VisualStagedEdit } from './visualEdits';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Drives `PortraitEditor` (and, through it, `LockerImageCropper`) through a
 * real pick -> crop -> apply cycle against stubbed `Image` decode and canvas
 * 2D context. Both components already null-guard their canvas context, so an
 * unstubbed `getContext('2d')` would take the silent no-context fallback and
 * this test would pass while proving nothing (D-04); every rectangle asserted
 * below is derived from the stubbed natural dimensions and the cropper's own
 * (unexported) frame-sizing math, never hand-typed.
 */

/** `LockerImageCropper.tsx`'s frame-sizing constants, read directly from the
 *  source since the module does not export them. Mirrored here so the
 *  expected crop rectangle is computed the same way the component computes
 *  it. */
const FRAME_MAX_W = 320;
const FRAME_MIN_W = 160;
const FRAME_MAX_H = 420;
const FRAME_MIN_H = 160;
const FRAME_MARGIN_W = 96;
const FRAME_VH = 0.4;
const MAX_OUTPUT_LONG = 1280;

/** Mirrors `frameBudget()` + `fitAspect()` from `LockerImageCropper.tsx`. */
function fitAspect(aspect: number, winW: number, winH: number): { w: number; h: number } {
  const maxW = Math.max(FRAME_MIN_W, Math.min(FRAME_MAX_W, winW - FRAME_MARGIN_W));
  const maxH = Math.max(FRAME_MIN_H, Math.min(FRAME_MAX_H, Math.round(winH * FRAME_VH)));
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

/** Mirrors `handleApply`'s centered-cover, zoom-1, undragged case: with the
 *  natural image an exact multiple of the frame, the source covers the frame
 *  with zero offset, so the framed source rect and the MAX_OUTPUT_LONG-capped
 *  bake size are both derivable from the frame and natural sizes alone. */
function expectedFramedRect(
  natural: { width: number; height: number },
  frame: { w: number; h: number }
) {
  const coverScale = Math.max(frame.w / natural.width, frame.h / natural.height);
  const srcW = frame.w / coverScale;
  const srcH = frame.h / coverScale;
  const longSrc = Math.max(srcW, srcH);
  const k = longSrc > MAX_OUTPUT_LONG ? MAX_OUTPUT_LONG / longSrc : 1;
  return {
    srcX: 0,
    srcY: 0,
    srcW,
    srcH,
    outW: Math.max(1, Math.round(srcW * k)),
    outH: Math.max(1, Math.round(srcH * k)),
  };
}

const WIN_W = 1024;
const WIN_H = 768;
const FAKE_TO_DATA_URL = 'data:image/png;base64,fake-baked-image';

/** The picked source's natural pixel dimensions for the current test, read by
 *  every `HTMLImageElement` the editor and cropper create. Every test in this
 *  file picks exactly one image and reloads that same data URL more than
 *  once (the editor's own re-decode plus the cropper's), so one shared value
 *  is correct rather than a per-instance map. */
const imageNaturalSize = { width: 0, height: 0 };

function setNaturalSize(width: number, height: number): void {
  imageNaturalSize.width = width;
  imageNaturalSize.height = height;
}

function makeFile(name = 'source.png'): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'image/png' });
}

/** One macrotask turn, so pending promise chains (file read, image decode,
 *  the editor's own effects) settle before the next assertion or action. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function anchorItem(overrides: Partial<TextureGridItem> = {}): TextureGridItem {
  return {
    path: 'panorama/images/heroes/cards/abrams_card.png',
    category: 'hero-image',
    hero: 'abrams',
    label: 'Abrams card',
    thumbUrl: null,
    sourceWidth: 600,
    sourceHeight: 800,
    ...overrides,
  };
}

function minimapItem(overrides: Partial<TextureGridItem> = {}): TextureGridItem {
  return {
    path: 'panorama/images/heroes/cards/abrams_mm.png',
    category: 'hero-image',
    hero: 'abrams',
    label: 'Abrams minimap',
    thumbUrl: null,
    sourceWidth: 128,
    sourceHeight: 128,
    ...overrides,
  };
}

describe('PortraitEditor crop, apply, and whole-family staging', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStage: ReturnType<typeof vi.fn<(edits: VisualStagedEdit[]) => void>>;
  let stagePortraitImage: ReturnType<typeof vi.fn>;
  let confirmFn: ReturnType<typeof vi.fn<ConfirmFn>>;
  let fakeCtx: { drawImage: ReturnType<typeof vi.fn>; imageSmoothingQuality: string };
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: WIN_W, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: WIN_H, configurable: true });

    onClose = vi.fn<() => void>();
    onStage = vi.fn<(edits: VisualStagedEdit[]) => void>();
    confirmFn = vi.fn<ConfirmFn>().mockResolvedValue(true);
    stagePortraitImage = vi.fn((dataUrl: string) =>
      Promise.resolve(dataUrl === FAKE_TO_DATA_URL ? 'staged://baked.png' : 'staged://unexpected.png')
    );

    window.electronAPI = {
      foundry: {
        fullImage: vi.fn().mockResolvedValue(null),
        listPortraitImages: vi.fn().mockResolvedValue([]),
        portraitImageNames: vi.fn().mockResolvedValue({}),
        stagePortraitImage,
        inspectAssetSources: vi.fn().mockResolvedValue({
          paths: [],
          sources: [],
          winners: {},
          unreadableMods: [],
        }),
      },
    } as unknown as typeof window.electronAPI;

    // jsdom never fires `load` on an <img> and reports naturalWidth/Height as
    // 0. Both PortraitEditor and LockerImageCropper construct `new Image()`,
    // assign `src`, and await `onload`; without this stub every crop number
    // below would be derived from a decode that never ran.
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(
      () => imageNaturalSize.width
    );
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(
      () => imageNaturalSize.height
    );
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
      this: HTMLImageElement
    ) {
      queueMicrotask(() => this.dispatchEvent(new Event('load')));
    });

    // Without the native `canvas` package (deliberately not installed), jsdom's
    // `getContext('2d')` returns null, which both LockerImageCropper's and
    // PortraitEditor's own bake take as a silent no-context fallback. Stub
    // only what the two draw sites call (LockerImageCropper.tsx:328-329,
    // PortraitEditor.tsx:269-270), and share one instance so both canvases'
    // draws land in the same recorded call list.
    fakeCtx = { drawImage: vi.fn(), imageSmoothingQuality: 'low' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(FAKE_TO_DATA_URL);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
    vi.restoreAllMocks();
  });

  const renderEditor = async (
    item: TextureGridItem,
    catalog: readonly TextureGridItem[],
    initialFile: File
  ) => {
    await act(async () => {
      root.render(
        <ConfirmContext.Provider value={confirmFn}>
          <PortraitEditor
            item={item}
            catalog={catalog}
            heroName="Abrams"
            initialFile={initialFile}
            onClose={onClose}
            onStage={onStage}
          />
        </ConfirmContext.Provider>
      );
    });
    // Several effects chain here (file read -> image decode -> target
    // measurement -> a LockerImageCropper remount once the target size is
    // known -> that instance's own image decode), so settle over several
    // macrotask turns rather than assuming one flush covers it.
    await act(async () => {
      for (let i = 0; i < 6; i++) await flush();
    });
  };

  const findButton = (text: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    );

  // A zero offset in this fixture is a *computed* zero (`-offset.x` where
  // offset.x is 0), which JS represents as -0; `toEqual` distinguishes -0
  // from +0, but the geometry does not. Normalize before comparing.
  const normalizeZero = (call: unknown[]) =>
    call.map((value) => (typeof value === 'number' && Object.is(value, -0) ? 0 : value));

  it('crops and applies through a real 2D-context call, deriving the source rectangle from the stubbed dimensions', async () => {
    const anchor = anchorItem();
    const mm = minimapItem();
    const catalog = [anchor, mm];

    const frame = fitAspect(anchor.sourceWidth! / anchor.sourceHeight!, WIN_W, WIN_H);
    // An exact multiple of the frame keeps the source's aspect identical to
    // the frame's, so at zoom 1 it covers the frame with zero offset and no
    // partial crop -- letting the expected rectangle be derived cleanly.
    const natural = { width: frame.w * 4, height: frame.h * 4 };
    setNaturalSize(natural.width, natural.height);

    await renderEditor(anchor, catalog, makeFile('source.png'));

    const useImage = findButton('Use image');
    expect(useImage).toBeDefined();
    expect(useImage!.disabled).toBe(false);

    await act(async () => {
      useImage!.click();
      await flush();
      await flush();
    });

    const expectedFrame = expectedFramedRect(natural, frame);
    // Sanity: this fixture is not exercising the MAX_OUTPUT_LONG cap.
    expect(expectedFrame.outW).toBe(natural.width);
    expect(expectedFrame.outH).toBe(natural.height);

    // LockerImageCropper's own bake: drawImage's last two args (dw, dh) are
    // its uncapped output size, which uniquely identifies this call among the
    // two draws PortraitEditor's flow performs.
    const cropperCall = fakeCtx.drawImage.mock.calls.find(
      (call) => call[7] === expectedFrame.outW && call[8] === expectedFrame.outH
    );
    expect(cropperCall).toBeDefined();
    expect(normalizeZero(cropperCall!)).toEqual([
      expect.anything(),
      expectedFrame.srcX,
      expectedFrame.srcY,
      expectedFrame.srcW,
      expectedFrame.srcH,
      0,
      0,
      expectedFrame.outW,
      expectedFrame.outH,
    ]);

    // The normalized crop the cropper reports back is full coverage (the
    // source exactly fills the frame), so PortraitEditor's own bake -- which
    // re-derives its rect via cropToTargetRect(crop, natural, target) rather
    // than trusting the cropper's baked pixels -- should draw the same source
    // region into a canvas sized to the *template's* real pixel size.
    const crop = { sx: 0, sy: 0, sw: 1, sh: 1 };
    const target = { width: anchor.sourceWidth!, height: anchor.sourceHeight! };
    const expectedTargetRect = cropToTargetRect(crop, natural, target);

    const targetCall = fakeCtx.drawImage.mock.calls.find(
      (call) => call[7] === expectedTargetRect.width && call[8] === expectedTargetRect.height
    );
    expect(targetCall).toBeDefined();
    expect(normalizeZero(targetCall!)).toEqual([
      expect.anything(),
      expectedTargetRect.sx,
      expectedTargetRect.sy,
      expectedTargetRect.sw,
      expectedTargetRect.sh,
      0,
      0,
      expectedTargetRect.width,
      expectedTargetRect.height,
    ]);

    // The applied payload: PortraitEditor's own canvas.toDataURL() result was
    // handed to foundryStagePortraitImage, and only from there did the
    // family slot get marked ready. A null-guarded fallback would have shown
    // the bake-failed error instead and never reached the IPC call.
    expect(stagePortraitImage).toHaveBeenCalledWith(FAKE_TO_DATA_URL, 'source.png');
    expect(document.body.textContent).toContain('Framed and ready');
  });

  it('caps a heavily oversized source on its long edge while holding the target aspect', async () => {
    const anchor = anchorItem();
    const mm = minimapItem();
    const catalog = [anchor, mm];

    const frame = fitAspect(anchor.sourceWidth! / anchor.sourceHeight!, WIN_W, WIN_H);
    // 10x the frame drives the framed source region well past
    // MAX_OUTPUT_LONG on its long edge (height, since the target is taller
    // than wide), which is exactly the case this test exists to cover.
    const natural = { width: frame.w * 10, height: frame.h * 10 };
    setNaturalSize(natural.width, natural.height);

    await renderEditor(anchor, catalog, makeFile('big-source.png'));

    const useImage = findButton('Use image');
    expect(useImage).toBeDefined();

    await act(async () => {
      useImage!.click();
      await flush();
      await flush();
    });

    const expectedFrame = expectedFramedRect(natural, frame);
    // Sanity: this fixture does exercise the cap (the uncapped framed region
    // is well past MAX_OUTPUT_LONG on its long edge).
    expect(Math.round(expectedFrame.srcH)).toBeGreaterThan(MAX_OUTPUT_LONG);
    expect(expectedFrame.outH).toBe(MAX_OUTPUT_LONG);
    expect(expectedFrame.outW).toBeLessThan(Math.round(expectedFrame.srcW));

    const cropperCall = fakeCtx.drawImage.mock.calls.find(
      (call) => call[7] === expectedFrame.outW && call[8] === expectedFrame.outH
    );
    expect(cropperCall).toBeDefined();
    expect(normalizeZero(cropperCall!)).toEqual([
      expect.anything(),
      expectedFrame.srcX,
      expectedFrame.srcY,
      expectedFrame.srcW,
      expectedFrame.srcH,
      0,
      0,
      expectedFrame.outW,
      expectedFrame.outH,
    ]);

    // The aspect held: the capped output's ratio still matches the source
    // region's own ratio (both frame-covering, so both equal the frame's own
    // aspect), not squashed to the target's aspect or left uncapped.
    const outputAspect = expectedFrame.outW / expectedFrame.outH;
    const sourceAspect = expectedFrame.srcW / expectedFrame.srcH;
    expect(outputAspect).toBeCloseTo(sourceAspect, 2);
  });

  it('lists every discovered family variant and refuses to stage a subset', async () => {
    const anchor = anchorItem();
    const mm = minimapItem();
    const catalog = [anchor, mm];

    const frame = fitAspect(anchor.sourceWidth! / anchor.sourceHeight!, WIN_W, WIN_H);
    const natural = { width: frame.w * 4, height: frame.h * 4 };
    setNaturalSize(natural.width, natural.height);

    await renderEditor(anchor, catalog, makeFile('source.png'));

    // Both discovered variants are listed, by their translated labels.
    expect(document.body.textContent).toContain('Hero card');
    expect(document.body.textContent).toContain('Minimap icon');
    expect(document.body.textContent).toContain('2 variants were discovered');

    // Override the minimap variant only -- never the family slot -- so the
    // anchor (card) variant is left uncovered.
    const overrideButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button')
    ).filter((button) => button.textContent?.trim() === 'Override');
    expect(overrideButtons.length).toBeGreaterThan(0);
    await act(async () => {
      overrideButtons[0]!.click();
    });

    // The cropper remounts under the minimap's own (square) target aspect;
    // let its own fresh image decode settle before applying.
    await act(async () => {
      for (let i = 0; i < 4; i++) await flush();
    });

    const useImage = findButton('Use image');
    expect(useImage).toBeDefined();
    await act(async () => {
      useImage!.click();
      await flush();
      await flush();
    });

    expect(stagePortraitImage).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(
      'Some variants would be left with the stock art.'
    );

    const stageButton = findButton('Stage 1 change');
    expect(stageButton).toBeDefined();
    expect(stageButton!.disabled).toBe(true);

    const stageCallsBefore = stagePortraitImage.mock.calls.length;
    await act(async () => {
      stageButton!.click();
      await flush();
    });

    // A disabled button's click is a no-op: nothing further staged, and
    // neither onStage nor onClose ever fired, which is what "refuses to stage
    // a subset" means in practice -- the family stays exactly as under-covered
    // as it was, rather than silently shipping the narrower set.
    expect(stagePortraitImage.mock.calls.length).toBe(stageCallsBefore);
    expect(onStage).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
