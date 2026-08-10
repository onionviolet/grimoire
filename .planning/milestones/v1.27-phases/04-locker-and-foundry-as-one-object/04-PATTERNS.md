# Phase 4: Locker And Foundry As One Object - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 10
**Analogs found:** 10 / 10 (all in-tree, no external analogs needed)

Scope reminder (per RESEARCH.md / UI-SPEC.md): only 4 items are in scope this phase:
1. Composable replaceable stage (D-01/02/03, E1-E4)
2. Tray-preview `stale` pill (E5)
3. Grid change-count loading badge (E6)
4. Locker Effects-tab pre-write disclosure (recolor/trippy)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/heroStage.ts` (extend `resolveHeroPlate`) | utility | transform | itself (existing `heroPlateComposition`'s already-present `'model'` branch) | exact — extend, don't replace |
| `src/components/common/HeroDetailFrame.tsx` (add `platePreview?: ReactNode` slot prop) | component (shared/domain-ignorant) | request-response (prop-driven render) | itself, current `topRight`/`after`/`railExtra` slot props | exact — same slot-prop pattern already used 3x in this file |
| `src/components/locker/heroStageMode.ts` (NEW, fork-only) | hook / store | CRUD (localStorage read/write) | `src/components/locker/useModelPanelOpen.ts` | exact — same per-surface `localStorage` key pattern, generalized from boolean to a mode string |
| `src/pages/LockerHero.tsx` (wire stage-mode control + plate override + pop-out + auto-fallback banner) | component (page) | event-driven (user toggles view) | itself, current `topRight`/`after`/`FloatingModelPanel` wiring (lines ~300-390) | exact — same file, restructure existing wiring |
| `src/components/foundry/HeroWorkshop.tsx` (wire stage-mode control + plate override + pop-out + stale pill) | component (page) | event-driven | itself, current `topRight`/`after`/`FloatingModelPanel`/pill wiring (lines ~200-316) | exact — same file, restructure existing wiring |
| `src/components/locker/HeroPoseViewer.tsx` (add `onFailureChange?` callback prop) | component | event-driven | itself, existing `setFailure` call sites (5, lines ~1009-1135) | exact — additive callback beside existing internal state |
| `src/components/locker/FloatingModelPanel.tsx` (pop-out target, no internal changes expected) | component | request-response | itself, existing `PictureInPicture2` icon usage (line 3, 282) | exact — reuse icon, no new icon needed |
| `src/components/foundry/useTrayPreview.ts` (no hook changes; consumed only) | hook | streaming/state-machine | itself | exact — hook already exposes `{previewId, building, error}` needed for the stale derivation |
| `src/components/foundry/FoundryHeroGrid.tsx` (thread `modsLoaded` into `HeroCard`, add loading badge branch) | component | CRUD (derived display state) | itself, existing badge block (lines 209-218) | exact — extend existing conditional |
| `electron/main/services/heroColors.ts` (add write-set preview function, Option A) | service (main process) | request-response / batch (subprocess bake + VPK read) | itself, `previewHeroColor` (line 668) and `ensureHeroColorBake`/cache-keyed bake functions (lines 129-336, 433-518) | exact — same cache-keyed bake + read pattern |
| `src/components/locker/HeroEffectsPanel.tsx` / `HeroColorPicker.tsx` / `TrippySkinPanel.tsx` (add pre-write disclosure via `AssetSourcesPanel`) | component | request-response | `src/components/locker/HeroSoundPicker.tsx` (disclosure wiring) + `src/components/locker/HeroSkinOverlapPanel.tsx` (scan/`AssetSourcesPanel` docking) | exact — same shape: compute paths, call `foundry:inspectAssetSources`, render `<AssetSourcesPanel paths={...} />` |

## Pattern Assignments

### `src/lib/heroStage.ts`

**Analog:** itself — `resolveHeroPlate` and `heroPlateComposition` already exist; `heroPlateComposition`'s `'model'` case is already correct and needs zero changes.

**Current signature to extend** (`heroStage.ts:209-216`):
```typescript
export function resolveHeroPlate(
  backdropImage: string | undefined,
  renderSrc: string
): HeroPlate | null {
  if (backdropImage) return { kind: 'skinImage', src: backdropImage };
  if (renderSrc) return { kind: 'render', src: renderSrc };
  return null;
}
```
Per RESEARCH.md's recommended shape, the model branch is NOT produced inside `resolveHeroPlate`/`heroStage.ts` at all — the frame receives a caller-supplied `platePreview` override instead (see `HeroDetailFrame.tsx` below), so `heroStage.ts` itself may need no signature change, only continued use of the existing `'model'` case in `heroPlateComposition` (already correct, `heroStage.ts:241-242`).

**Already-correct composition switch to extend if a third resolve branch is added instead** (`heroStage.ts:229-250`) — reuse verbatim, do not rewrite the `case 'model':` arm.

---

### `src/components/common/HeroDetailFrame.tsx`

**Analog:** itself — the existing `topRight`, `railExtra`, `after` optional `ReactNode` slot props (`HeroDetailFrameProps`, lines 38-77) are the established "typed slot contract" pattern this file already uses three times.

**Domain-ignorance invariant to preserve** (lines 22-25, header comment):
```typescript
/**
 * The frame is deliberately ignorant of both domains: no mod types, no stores,
 * no Foundry types. Everything page-specific arrives through slots.
 */
```

**Current plate-rendering block to extend, not replace** (lines 118-134):
```typescript
<div className="hidden lg:block absolute inset-0 bg-bg-primary animate-hero-zoom-in overflow-hidden">
  {plate && plateComposition ? (
    <img
      src={plate.src}
      alt={heroName}
      className={plateComposition.className}
      style={plateComposition.style}
      onError={plateComposition.usesRenderFallback ? handleRenderError : undefined}
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-2xl">
      {heroName}
    </div>
  )}
  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
</div>
```
Add an optional `platePreview?: ReactNode` prop; when supplied (and the caller has selected Model), render it in place of the `<img>`, exactly as `topRight`/`after` are conditionally rendered elsewhere in this same component (e.g. line 136: `{topRight && (...)}`). **Do not** import `HeroPoseViewer`, `three`, or any Locker/Foundry store into this file — that is the file's own stated invariant and RESEARCH.md's Pitfall 1.

**Existing slot-prop pattern to copy exactly** (lines 65-77, the prop interface shape for a new `platePreview` prop):
```typescript
/** Absolutely positioned controls in the top-right corner. */
topRight?: ReactNode;
...
/** The active section's content. */
children: ReactNode;
/** Siblings after the content pane: docked panels, floating panels, modals. */
after?: ReactNode;
```

---

### `src/components/locker/heroStageMode.ts` (NEW, fork-only)

**Analog:** `src/components/locker/useModelPanelOpen.ts` (full file, 41 lines) — copy this pattern verbatim, generalizing the boolean to a `'model' | 'image'` string union per RESEARCH.md's Open Question 2 recommendation (new key, not a repurposed boolean key).

**Full pattern to copy and adapt:**
```typescript
// Source: src/components/locker/useModelPanelOpen.ts:1-40 (verified this session)
import { useCallback, useState } from 'react';

export type ModelPanelSurface = 'locker' | 'foundry';

const storageKey = (surface: ModelPanelSurface) => `grimoire.${surface}.modelPanel.open`;

function readStored(surface: ModelPanelSurface): boolean {
  try {
    return localStorage.getItem(storageKey(surface)) === '1';
  } catch {
    return false;
  }
}

export function useModelPanelOpen(surface: ModelPanelSurface): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(() => readStored(surface));
  const set = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        localStorage.setItem(storageKey(surface), next ? '1' : '0');
      } catch {
        /* ignore quota/availability errors */
      }
    },
    [surface]
  );
  return [open, set];
}
```
Adapt to: `storageKey` becomes `grimoire.${surface}.heroStage.mode` (new key, per RESEARCH.md Open Question 2 — do not reinterpret the existing `.modelPanel.open` key's semantics); stored value becomes `'model' | 'image'` instead of `'1'/'0'`; default-selection policy differs by surface (Locker defaults optimistically to `'model'` per D-02, Foundry defaults to `'image'`/opt-in) — this is the one piece with no existing analog and is genuinely new logic, not copied.

---

### `src/pages/LockerHero.tsx`

**Analog:** itself — current `topRight`/`after` wiring for the `3D` toggle and `FloatingModelPanel` (lines 322-386).

**Current stage-toggle button to replace with `SegmentedControl`** (lines 335-349):
```typescript
<button
  type="button"
  onClick={() => setView3d(!view3d)}
  aria-pressed={view3d}
  title={view3d ? t('locker.hero.hide3dModel') : t('locker.hero.showLive3dModel')}
  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
    view3d
      ? 'border-accent/60 bg-accent/20 text-text-primary'
      : 'border-border/70 bg-bg-secondary/70 text-text-secondary hover:text-text-primary backdrop-blur'
  }`}
>
  <Box className="h-3.5 w-3.5" />
  3D
</button>
```

**Current `after`-slot `FloatingModelPanel` mount to relocate into the plate override** (lines 351-385) — the `HeroPoseViewer` currently mounts inside `FloatingModelPanel`'s body; under the new contract it mounts into `HeroDetailFrame`'s `platePreview` slot when stage mode is `'model'`, and `FloatingModelPanel` becomes the pop-out-only target (still using the same `HeroPoseViewer` component, same lazy `Suspense` boundary):
```typescript
<Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/80" /></div>}>
  <HeroPoseViewer
    key={`${hero.name}:${activeSkinSourceKey}:${fallbackPoseSkinMetaKey ?? ''}`}
    heroName={hero.name}
    skinSources={activeSkinSources}
    fallbackSkinMetaKey={fallbackPoseSkinMetaKey}
    trippyPreview={matchedTrippyPreview}
  />
</Suspense>
```
Keep the lazy `import()`/`Suspense` boundary exactly as-is per RESEARCH.md Pitfall 1 (three.js chunk must stay lazy-loaded from the page, never from `HeroDetailFrame`).

---

### `src/components/foundry/HeroWorkshop.tsx`

**Analog:** itself — current `topRight` toggle (lines 221-240) and `after`-slot pill block (lines 277-314).

**Current pill block to extend with the new `stale` pill** (lines 296-312):
```typescript
{trayPreview.building && (
  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
    <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('foundry.workshop.previewBuilding', 'Building preview')}
    </span>
  </div>
)}
{trayPreview.error && (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center">
    <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200 backdrop-blur">
      {t('foundry.workshop.previewFailed', 'Preview build failed: {{error}}', { error: trayPreview.error })}
    </span>
  </div>
)}
```
Add, alongside (not replacing) the building pill, per UI-SPEC E5:
```typescript
{trayPreview.building && trayPreview.previewId && (
  <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
    {t('foundry.workshop.previewStale', 'Preview may be out of date')}
  </span>
)}
```
`useTrayPreview.ts` itself needs no changes — `building && previewId !== null` is already the correct derived condition (verified `useTrayPreview.ts:59-95`, `replace(null)` is never called on the rebuild path).

---

### `src/components/locker/HeroPoseViewer.tsx`

**Analog:** itself — existing internal failure-state taxonomy and all 5 `setFailure` call sites.

**Existing state to expose via a new prop, not duplicate** (lines 907-937):
```typescript
export default function HeroPoseViewer({ ... }) {
  ...
  const [failure, setFailure] = useState<HeroPoseFailureKind | null>(null);
```
**Call sites where the new `onFailureChange` callback must be invoked alongside `setFailure`** (lines 1009, 1083, 1098, 1104, 1113, 1135) — add `onFailureChange?.(kind)` next to each `setFailure(kind)` call, per RESEARCH.md's Pattern 1 recommendation. This is the minimal additive change; no new state duplication.

**`HeroPoseFailureState` component to reuse unchanged for the plate's own inline failure UI** (line 292) — the new frame-level auto-fallback banner (E4) is a *different*, hero-level generic message, not a copy of this component's per-failure-kind copy.

---

### `src/components/locker/FloatingModelPanel.tsx`

**Analog:** itself — no internal changes expected; it becomes the pop-out-only target.

**Existing icon import to reuse for the new pop-out button** (line 3, 282):
```typescript
import { GripHorizontal, PanelLeft, PanelRight, PictureInPicture2, X } from 'lucide-react';
...
icon: PictureInPicture2,
```
Use the same `PictureInPicture2` icon on the new stage pop-out `IconButton` in `LockerHero.tsx`/`HeroWorkshop.tsx`'s `topRight` per UI-SPEC's Copywriting Contract ("reuse the icon rather than introducing a new one for the same meaning").

---

### `src/components/foundry/FoundryHeroGrid.tsx`

**Analog:** itself — `modsLoaded` is already read (line 39) but not threaded to `HeroCard`; the existing badge conditional (lines 211-218) is the direct analog to extend.

**Existing badge to extend with a third (loading) branch** (lines 209-218):
```typescript
{/* What you have already made for this hero. Absent rather than "0": an
    empty badge would be noise on most of the roster. */}
{changeCount > 0 && (
  <span
    title={t('foundry.heroes.changeCount', { count: changeCount })}
    className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground"
  >
    {changeCount}
  </span>
)}
```
Add, per RESEARCH.md Pattern 3 and UI-SPEC's E6 typography note (copy the `10px`/badge position verbatim, do not invent a new size):
```typescript
{!modsLoaded ? (
  <span
    aria-label={t('foundry.heroes.changeCountLoading', 'Change count is loading')}
    className="pointer-events-none absolute left-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-white/40 animate-pulse"
  />
) : changeCount > 0 ? (
  <span title={t('foundry.heroes.changeCount', { count: changeCount })} className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground">
    {changeCount}
  </span>
) : null}
```
**`HeroCard` props to extend** (interface at lines 141-152) — add `modsLoaded: boolean`, thread from the `ordered.map` call site (lines 120-129).

---

### `electron/main/services/heroColors.ts`

**Analog:** itself — `previewHeroColor` (fast-path preview, line 668) and the cache-keyed bake functions `ensureHeroColorBake`/`ensureHeroPrismBake`/`ensureHeroTrippyVfxBake` (lines 129-336) plus `applyHeroColor`/`applyHeroPrism`/`applyHeroTrippyVfx` (lines 433-518).

**Cache-key discipline to reuse for the new write-set preview function** (line 129):
```typescript
function colorCachePath(codename: string, hue: number, sat: number, brightness: number): string {
  // ... deterministic cache path from exact normalized params
}
```
**Pattern (Option A, recommended by RESEARCH.md):** the new write-set function should call the existing `ensureHeroColorBake`/`ensureHeroPrismBake`/`ensureHeroTrippyVfxBake` (fresh bake or cache hit, no new subprocess logic), then read the produced VPK's entry list with the existing `parseVpkDirectoryCached` from `electron/main/services/vpk.ts` (same function `detectVfxLayerFromVpk` already calls) — do not write a second VPK parser. Validate `heroName` the same way existing handlers do: `colorCodenameForHero` already throws a clear error for an unknown hero (lines ~441-444) — reuse that, no new validation pattern.

**IPC shape to follow** (per RESEARCH.md's Security Domain section): renderer passes `heroName` + params; main resolves paths internally and returns exact normalized entry paths — never a raw filesystem path back to the renderer, matching the existing `foundry:inspectAssetSources`/`get-hero-pose-info` IPC shapes.

---

### `src/components/locker/HeroEffectsPanel.tsx` / recolor + trippy apply flow

**Analog:** `src/components/locker/HeroSkinOverlapPanel.tsx` (scan + dock pattern, lines 37-59, 101) and `src/components/locker/HeroSoundPicker.tsx` (inline disclosure copy, lines 317-323) — both already deliver D-07/D-08 for sound; copy this shape exactly for the recolor/trippy Apply flow (Option A).

**Exact reusable pattern** (`HeroSkinOverlapPanel.tsx:37-59, 101`):
```typescript
const scan = useCallback(async () => {
  const conflicts = await getConflicts();
  const contested = conflicts
    .filter((c) => c.conflictType === 'file' && (enabledIds.has(c.modA) || enabledIds.has(c.modB)))
    .flatMap((c) => c.files ?? []);
  setPaths([...new Set(contested)].sort());
}, [enabledIds]);
// ...
<AssetSourcesPanel paths={paths} />
```
For the recolor/trippy Apply flow: on Apply, call the new main-process write-set function (see `heroColors.ts` above) to get exact normalized paths, then call `foundry:inspectAssetSources` (existing IPC, unchanged — `electron/main/ipc/mods.ts`) with those paths, then render `<AssetSourcesPanel paths={...} />` — the exact same component and contract `HeroSkinOverlapPanel` already uses for sound. Show this inline before the final `rebuildLockerColors` write, not as a blocking modal, per D-07 and RESEARCH.md's Open Question 1 recommendation.

**`pickConsequence` reuse for sound is the sibling pattern, not directly reusable for effects** (`src/components/locker/soundPickConsequence.ts`, full file) — this uses `analyzeStagedEdits` from `src/components/foundry/buildTray.ts` on a synthetic two-edit collision check. The effects disclosure is simpler (single write-set + ownership scan, no "candidate vs currently-applied" comparison needed since there's no competing recolor), so `AssetSourcesPanel` is the right level of reuse, not `soundPickConsequence.ts`'s collision-diff logic.

---

## Shared Patterns

### Domain-ignorant shared frame (D-03)
**Source:** `src/components/common/HeroDetailFrame.tsx:22-25` (header comment, the stated invariant) and its existing `topRight`/`railExtra`/`after` optional-`ReactNode` slot props.
**Apply to:** `LockerHero.tsx`, `HeroWorkshop.tsx`, the new `heroStageMode.ts` hook. Never import `HeroPoseViewer`, `three`, `Mod`, or any Locker/Foundry store into `HeroDetailFrame.tsx` itself.

### VPK ownership disclosure (D-07/D-08)
**Source:** `src/components/foundry/AssetSourcesPanel.tsx` (full component) + `foundry:inspectAssetSources` IPC (`electron/main/ipc/mods.ts`), already reused once for sound via `src/components/locker/HeroSkinOverlapPanel.tsx`.
**Apply to:** the new Effects-tab (recolor/trippy) pre-write disclosure. Do not write a second ownership-scan component.

### Per-surface localStorage persistence
**Source:** `src/components/locker/useModelPanelOpen.ts` (full file) — `grimoire.${surface}.<feature>` key convention, try/catch around `localStorage` access.
**Apply to:** the new `heroStageMode.ts` hook (new key: `grimoire.${surface}.heroStage.mode`, not a reinterpretation of the existing `.modelPanel.open` key).

### Lazy three.js loading
**Source:** existing `Suspense`/dynamic-`import()` boundaries around `HeroPoseViewer` in both `LockerHero.tsx` (lines 369-383) and `HeroWorkshop.tsx` (lines 283-295).
**Apply to:** the plate-mounted `HeroPoseViewer` instance in both pages — keep the lazy import at the page level, never inside `HeroDetailFrame.tsx`.

### Debounced rebuild-on-change
**Source:** `REBUILD_DELAY_MS = 700` in `src/components/foundry/useTrayPreview.ts:14`.
**Apply to:** nothing new this phase needs it (already shipped); cited here only because RESEARCH.md's Don't-Hand-Roll table flags it as the existing standard for this exact class of problem, should any related debounce be needed.

### SegmentedControl for two-state pick-one UI
**Source:** `src/components/common/ui.tsx:518-560` (`SegmentedControl`) + `useSegmentedTabs.ts` (shared tab/panel id contract).
**Apply to:** the new stage-mode "Model"/"Image" control in both `LockerHero.tsx` and `HeroWorkshop.tsx`'s `topRight` slot. Do not hand-roll a two-button toggle (UI-SPEC and RESEARCH.md's Don't-Hand-Roll table both mandate this primitive).

## No Analog Found

None. Every file in this phase's scope has a direct, cited in-tree analog — either itself (extend, don't replace) or a structurally identical shipped sibling feature (sound disclosure -> effects disclosure; `useModelPanelOpen` -> `heroStageMode`).

## Metadata

**Analog search scope:** `src/components/common/`, `src/components/locker/`, `src/components/foundry/`, `src/pages/`, `src/lib/heroStage.ts`, `electron/main/services/heroColors.ts`, `electron/main/services/vpk.ts`
**Files scanned:** 14 (all read directly this session; no grep-only files beyond confirming call-site line numbers)
**Pattern extraction date:** 2026-08-08
