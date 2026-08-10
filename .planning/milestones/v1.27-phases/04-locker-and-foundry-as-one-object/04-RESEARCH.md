# Phase 4: Locker And Foundry As One Object - Research

**Researched:** 2026-08-08
**Domain:** React/Electron desktop app internals: shared presentation components, three.js model preview, VPK ownership disclosure, and a Rust-CLI-backed particle recolor pipeline.
**Confidence:** HIGH (all claims verified against the working tree this session; no external packages, APIs, or unfamiliar frameworks are involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Shared frame and model as stage**

- **D-01:** Preserve both contested variants through one composable page structure. `HeroDetailFrame` remains the shared outer chrome, but its visual stage is a replaceable slot rather than a fixed backdrop image. This keeps the delivered shared-frame work and allows the 3D model to become the Locker page's stage without rebuilding the rail, navigation, gradients, or fallbacks.
- **D-02:** In Locker, the model is the primary stage when it can load. The existing image chain remains a graceful fallback and a user-selectable low-cost view. In Foundry, the same stage slot hosts a lazy, opt-in preview of the tray because preview builds have real latency and lifecycle cost. This implements both product directions while leaving the user in control.
- **D-03:** Stage controls belong in the frame's top-right slot and use one shared presentation contract. Domain behavior stays outside the frame. The frame must not import Locker or Foundry stores or domain types.

**Foundry tray preview**

- **D-04:** Preview the complete reviewed tray result stacked above the hero's currently enabled skins. Do not preview only the most recent edit. The result must answer what the user will see after forging against their current installed state.
- **D-05:** A preview build is temporary in the strong sense: it uses an explicit path-based pose source, never installs, never changes load order, never writes to the addons folder, and is cleaned up when replaced, closed, navigated away from, or when the owning window exits.
- **D-06:** Build only while the preview is open. Debounce tray changes, cancel or supersede stale builds, retain the last valid preview while the replacement is building, and label stale, loading, failed, and current states distinctly. A failed preview does not invalidate the reviewed forge request.

**Locker pre-write disclosure**

- **D-07:** Show consequences inline beside the action before writing. Use a modal only when the action has a destructive overwrite that cannot be made unambiguous inline. Routine non-conflicting actions keep their current speed.
- **D-08:** Disclosure names exact normalized VPK paths, current owners, the effective winner, and the proposed result. Unreadable inspection blocks only the ambiguous action and does not mutate installed state.
- **D-09:** Locker stays immediate-apply. This phase makes writes informed; it does not move Locker actions into the Foundry tray.

**Foundry image sourcing**

- **D-10:** `PortraitEditor` offers three sources through one intake surface: file drop or picker, images found in the selected mod, and recently used images. The crop frame remains locked to the selected template's native aspect ratio.
- **D-11:** Recent-image entries are references to existing user-selected sources or safe app-owned derivatives, not a new opaque image library. Missing sources remain visible with a clear recovery action instead of silently disappearing.
- **D-12:** Image intake may be shared, but `PortraitEditor` and Locker image components remain separate authoring surfaces. Staging continues through `prepareVisualStagedEdit` unchanged.

**Foundry hero grid state**

- **D-13:** Favorites are one shared hero preference across Locker and Foundry. Do not introduce a Foundry-only favorite store.
- **D-14:** The authored-change badge counts the same per-hero entries used by `MyChanges`. The badge opens that hero's workshop and should distinguish zero from unavailable or still-loading data.
- **D-15:** The grid follows the same image fallback behavior as the detail frame and removes hardcoded visible English while this file is already being changed.

### Claude's Discretion

- Exact debounce duration and whether stale preview state uses a badge, overlay, or compact status row.
- Exact visual arrangement of the three image sources, provided all remain reachable without obscuring the crop preview.
- Whether shared stage behavior is expressed as a hook, small controller component, or typed slot contract. Prefer the smallest boundary that prevents page-specific imports in `HeroDetailFrame`.

### Deferred Ideas (OUT OF SCOPE)

- Locker portrait-family awareness is explicitly moved to Phase 5 and must not be pulled back into Phase 4 even though the older parity plan groups it with Foundry image sourcing.
- Ability playback, particle playback, and sound audition directly on the 3D model are part of the broader model-as-stage vision but are not required by Phase 4's success criteria. Keep extension points compatible; do not add those capabilities here.

**Standing scope note carried from UI-SPEC.md and the task brief (supersedes ROADMAP.md's "lanes 2-5 pending" framing):** commit `f614bb7` (ancestor of `HEAD`) already shipped parity lanes 2-5 (D-04 through D-15's mechanics, minus two named gaps). Do not re-plan or re-research the Foundry tray preview build/lifecycle, the sound pre-write disclosure, the three-source portrait intake, or the base favorites/change-count wiring — they exist and are cited with file:line evidence below. This document researches only: (1) the composable replaceable stage (D-01/02/03), (2) the tray-preview `stale` pill and grid change-count loading-vs-zero badge (two small gaps in already-shipped code), (3) whether a dry-run pre-write disclosure is feasible for the Locker Effects tab (recolor/trippy), and (4) the current, re-verified status of per-skin pose-failure attribution.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-locker-foundry-parity-lanes | Lanes 2-5 of the parity plan (Foundry preview, Locker disclosure, Foundry image sourcing, grid state) | Lanes 2, 4, and most of 5 are **already delivered** (see Scope note table below, with file:line citations). The two remaining slivers of this requirement inside Phase 4's boundary are the tray-preview `stale` pill (E5) and the grid change-count loading-vs-zero badge (E6) — see "Architecture Patterns" #2 and #3. The Effects-tab disclosure gap (lane 3's incomplete half) is covered under "Architecture Patterns" #4 (the dry-bake options). |
| REQ-locker-model-as-stage | Make the 3D model the page rather than a widget in the corner, with extension points for ability/particle/sound playback (playback itself is explicitly deferred, see Deferred Ideas) | Covered end to end under "Architecture Patterns" #1 (the composable replaceable stage: plate kind, stage-mode control, pop-out, auto-fallback banner, camera framing gap). |
</phase_requirements>

## Summary

Phase 4's real remaining work is much narrower than ROADMAP.md and REQUIREMENTS.md describe, and this was independently re-verified this session (not just trusted from UI-SPEC.md): commit `f614bb7` is confirmed an ancestor of `HEAD`, and `src/stores/poseFailureStore.ts` (per-skin pose-failure attribution) is confirmed committed at `ade0a13` (2026-07-30), also an ancestor of `HEAD` — contradicting `docs/locker-deep-dive.md`'s "in flight, uncommitted" framing, which is itself now stale. Four items remain:

1. **The composable replaceable stage (D-01/02/03).** `src/lib/heroStage.ts` already types `HeroPlateKind = 'render' | 'skinImage' | 'model'` and `heroPlateComposition()` already has a correct, tested case for `'model'` (`{ className: 'absolute inset-0', usesRenderFallback: false }`). Nothing produces that plate kind: `HeroDetailFrame.tsx`'s `resolveHeroPlate()` only ever returns `'render'` or `'skinImage'` (it has no third branch), and both `LockerHero.tsx` and `HeroWorkshop.tsx` still open the model in `FloatingModelPanel`, layered over the 2D backdrop via the frame's `after` slot, defaulting to **closed** (`useModelPanelOpen` reads `localStorage`, false unless previously opened — this directly contradicts D-02's "the model is the primary stage when it can load" as the default experience today). This is the phase's real net-new UI surface and where nearly all the design risk lives.
2. **Tray-preview `stale` pill.** `useTrayPreview.ts` already retains the last successful `previewId` while a rebuild is in flight (it never clears `previewId` when `building` becomes true) — D-06's "retain the last valid preview while replacement is building" is **already implemented behaviorally**; only the UI label for that state is missing. This is a small, purely additive change.
3. **Grid change-count loading-vs-zero badge.** `FoundryHeroGrid.tsx`'s badge is simply absent both at `changeCount === 0` and while `!modsLoaded` today. `modsLoaded` is already read from `useAppStore` in the same component; it just isn't threaded to `HeroCard`. Small, additive.
4. **Effects-tab (recolor/trippy) pre-write disclosure.** The parity commit declined this on the stated ground that particle/texture/material entries are "discovered at bake time." This session traced the actual mechanism (`electron/main/services/heroColors.ts`, `docs/ability-vfx-recolor.md`) and found the premise is only half true: the recolor's write-set is **not** truly undiscoverable pre-bake. Two concrete, costed options exist and are detailed below, because ROADMAP success criterion 2 names no exception and the planner must not assume an outcome here.

**Primary recommendation:** Build the composable stage as a small typed contract (`StageMode = 'model' | 'image'`) owned by a new fork-only hook/component that both `LockerHero.tsx` and `HeroWorkshop.tsx` call — never inside `HeroDetailFrame.tsx` itself, preserving its domain-ignorance invariant. Ship the two small gaps (E5, E6) as pure additive changes to already-shipped files. For the recolor disclosure, default to the **bake-then-disclose-at-Apply** option (Option A below): it costs nothing extra over what `applyHeroColor`/`applyHeroPrism`/`applyHeroTrippyVfx` already do, reuses `AssetSourcesPanel` verbatim, and satisfies D-07's "before it runs" literally without requiring a new vpkmerge CLI feature. Reserve the cheap prefix-scan option (Option B) for a live/instant variant only if a bake-per-slider-tick UX is explicitly wanted later.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage-mode selection UI (SegmentedControl, pop-out button) | Browser/Client (React, `HeroDetailFrame` slot consumers) | — | Pure presentation state; no IPC needed to render the control itself |
| Model-as-plate rendering (`'model'` plate kind, camera framing) | Browser/Client (`HeroPoseViewer` inside the frame's plate) | API/Backend (existing `get-hero-pose-info`/`export-hero-pose` IPC, unchanged) | Rendering is renderer-only; the pose export IPC already exists and is reused, not extended |
| Tray-preview stale/current/building/failed pill labels | Browser/Client (`useTrayPreview.ts` consumer in `HeroWorkshop.tsx`) | — | `useTrayPreview`'s state machine already carries everything needed; this is a pure derived-label change |
| Grid change-count loading vs. zero | Browser/Client (`FoundryHeroGrid.tsx`, `useAppStore.modsLoaded`) | — | `modsLoaded` is already renderer state; no new IPC |
| Effects-tab pre-write disclosure (write-set discovery) | API/Backend (main process: pak01 VPK parsing or a real bake via `vpkmerge`) | Browser/Client (renders the result through the existing `AssetSourcesPanel`) | The write-set (which VPK entries a recolor would touch) can only be computed where pak01 and the `vpkmerge` binary are reachable: the main process. The disclosure UI itself is a pure renderer reuse of `AssetSourcesPanel` |
| VPK ownership scan for the disclosed paths | API/Backend (`foundry:inspectAssetSources` IPC, already exists) | — | Unmodified: this phase supplies new `paths`, not new scanning logic |

## Standard Stack

No new external packages are required. Every capability in this phase is built from libraries already in the dependency tree and already used for the adjacent, already-shipped lanes:

| Library | Version (installed) | Purpose | Why it's already the standard here |
|---------|---------|---------|--------------|
| react / react-dom | 19.x (project baseline) | Stage-mode control, plate rendering | Existing app framework |
| three / @react-three/fiber / @react-three/drei | already a dependency (see `HeroPoseViewer.tsx` imports) | Model-as-plate rendering, camera | `HeroPoseViewer` already renders the model this way inside `FloatingModelPanel`; the plate mode reuses the same component, just remounted into the frame's plate slot instead of a floating panel |
| lucide-react | `^0.562.0` (per UI-SPEC) | `PictureInPicture2` icon for pop-out (already imported in `FloatingModelPanel.tsx:3`), `AlertTriangle` for the auto-fallback banner (already imported in `HeroPoseViewer.tsx`) | Existing icon vocabulary, UI-SPEC mandates reuse, not a new icon |
| i18next / react-i18next | existing | New keys under `locker.hero.stageMode.*`, `foundry.workshop.previewStale`, `foundry.heroes.changeCountLoading` | Existing i18n pipeline; `pnpm i18n:check` / `pnpm i18n:manifest` gates apply |

**Installation:** none. No `npm install` step in this phase.

## Package Legitimacy Audit

Not applicable. This phase installs no new external packages; every dependency used is already declared in `package.json` and already exercised by shipped code (`HeroPoseViewer.tsx`, `FloatingModelPanel.tsx`). The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
Locker (LockerHero.tsx)              Foundry (HeroWorkshop.tsx)
        \                                    /
         \                                  /
          v                                v
        +--------------------------------------+
        |   HeroDetailFrame (domain-ignorant)   |
        |   - rail, nav, veil, plate slot       |
        |   - topRight slot <-- stage control   |
        |   - after slot <-- pop-out target     |
        +--------------------------------------+
                 |
                 v
     resolveHeroPlate(backdropImage, renderSrc, mode)
                 |
        +--------+--------+
        |                 |
   kind='model'       kind='render'|'skinImage'
        |                 |
        v                 v
  HeroPoseViewer      <img> (existing 4-step fallback chain)
  (mounted in plate,       |
   NOT FloatingModelPanel) |
        |                 |
        v                 v
  get-hero-pose-info / export-hero-pose IPC (main)
        |
        v
  On failure: HeroPoseFailureState (existing) or
  a NEW auto-fallback banner that flips displayed
  plate mode back to 'render'/'skinImage'


Effects tab (HeroEffectsPanel -> HeroColorPicker/TrippySkinPanel)
        |
        v
  [Option A] applyHeroColor/Prism/TrippyVfx bake (already runs on Apply)
        |                                  [Option B] pak01 prefix scan
        v                                  (particles/abilities/<codename>/,
  read produced VPK's entry list           particles/weapon_fx/<codename>/)
  (existing VPK directory parser)                |
        |                                          |
        +------------------+-----------------------+
                           v
              foundry:inspectAssetSources (existing IPC)
                           v
              <AssetSourcesPanel paths={...} /> (existing component,
              already used by HeroSkinOverlapPanel for sound)
```

### Recommended Project Structure

No new top-level directories. New files are additive, following the fork-only convention (`docs/upstream-boundary-map.md`):

```
src/
├── lib/
│   └── heroStage.ts              # EXISTING, no changes needed to plateKind logic
├── components/
│   ├── common/
│   │   └── HeroDetailFrame.tsx   # EXISTING - resolveHeroPlate() gets a 3rd branch;
│   │                              #   the frame itself stays domain-ignorant (see Pitfall 1)
│   └── locker/
│       ├── HeroPoseViewer.tsx    # EXISTING - reused as the plate's model renderer,
│       │                          #   unchanged internally except where noted
│       ├── FloatingModelPanel.tsx# EXISTING - becomes the pop-out target only
│       ├── useModelPanelOpen.ts  # EXISTING - repurpose or add a sibling hook for
│       │                          #   stage-mode persistence (see Pitfall 2)
│       └── heroStageMode.ts      # NEW (fork-only) - the shared stage-mode contract
│                                  #   (StageMode type, persistence, default-selection
│                                  #   policy) consumed by both LockerHero and HeroWorkshop
electron/main/services/
└── heroColors.ts                 # EXISTING - add a small write-set preview function
                                    #   for Option A or B (see pattern #4)
```

### Pattern 1: The composable replaceable stage (D-01/02/03)

**What:** `HeroDetailFrame` keeps owning `resolveHeroPlate()`, but the function gains a third input (an explicit stage-mode request) and a third output branch, rather than the frame importing any domain type to decide when a model is appropriate.

**Verified current state** — `resolveHeroPlate` has exactly two branches today:

```typescript
// Source: src/lib/heroStage.ts:209-216 (verified this session, unchanged since 2026-07-30)
export function resolveHeroPlate(
  backdropImage: string | undefined,
  renderSrc: string
): HeroPlate | null {
  if (backdropImage) return { kind: 'skinImage', src: backdropImage };
  if (renderSrc) return { kind: 'render', src: renderSrc };
  return null;
}
```

And `heroPlateComposition()` already has the `'model'` arm, unused:

```typescript
// Source: src/lib/heroStage.ts:229-250 (verified this session)
export function heroPlateComposition(plate: HeroPlate): HeroPlateComposition {
  switch (plate.kind) {
    case 'skinImage':
      return { className: 'absolute inset-0 h-full w-full object-cover', style: { objectPosition: '50% 50%' }, usesRenderFallback: false };
    case 'model':
      return { className: 'absolute inset-0', usesRenderFallback: false };
    case 'render':
    default:
      return { className: 'absolute top-0 right-0 h-full w-auto max-w-none', usesRenderFallback: true };
  }
}
```

**When to use:** Both `LockerHero.tsx` and `HeroWorkshop.tsx`, replacing today's pattern where the model always renders inside `FloatingModelPanel` regardless of frame content. The `HeroPoseViewer` component itself needs **no internal changes** to become a plate: it already renders `<div className="absolute inset-0">...</div>` as its root (`HeroPoseViewer.tsx:1217`, verified this session), which is exactly `heroPlateComposition()`'s `'model'` className. The only structural change is *where* it mounts (inside `HeroDetailFrame`'s plate `<div>` instead of inside `FloatingModelPanel`'s body `<div>`).

**Design decision the planner must make (D-03's discretion clause):** `HeroDetailFrame` "must not import Locker or Foundry stores or domain types" — it currently does not import `HeroPoseViewer` at all, and it should not start. The recommended shape is a **caller-supplied plate override**: add an optional prop such as `platePreview?: ReactNode` to `HeroDetailFrameProps`, rendered in place of the `<img>` when supplied and `mode === 'model'` is selected by the caller. The frame decides *whether* to show its own `<img>` plate or the caller's override; it never imports `HeroPoseViewer`, `Mod`, `FoundryForgeEdit`, or any store. This is the "typed slot contract" option from D-03's discretion list and is the smallest boundary: `HeroDetailFrame` gains one new optional prop and zero new imports.

**Stage-mode persistence and default selection:** `useModelPanelOpen` (`src/components/locker/useModelPanelOpen.ts`, verified this session) currently persists a boolean "is the floating panel open" per surface, defaulting to `false`. Under the new contract this becomes "which mode is selected" (`'model' | 'image'`), and D-02 requires Locker to default to `'model'` "when it can load" while Foundry defaults to opt-in (`'image'`, i.e. off, matching D-02's "lazy, opt-in" framing for Foundry). Reusing `useModelPanelOpen`'s storage-key pattern (`grimoire.${surface}.modelPanel.open`) for a new mode value is straightforward, but **the default-selection policy is genuinely open** — see UI Considerations E1 in `04-UI-SPEC.md` and Pitfall 2 below.

**Camera framing gap (verified, not previously flagged in CONTEXT.md or UI-SPEC.md at this level of detail):** `HeroPoseViewer`'s `<Canvas>` uses a fixed camera with no per-hero target:

```typescript
// Source: src/components/locker/HeroPoseViewer.tsx:1224-1225 (verified this session)
<Canvas
  camera={{ position: [0, 0, 3.2], fov: 40 }}
  ...
```

`heroStage.ts`'s `heroSubjectX(heroName)` (`heroStage.ts:272-274`) is documented as "deliberately inert on the plates as they stand today... Its first real consumer is the model camera," but **no code anywhere calls it** (verified via grep this session: zero call sites outside its own definition and test file). Wiring it in requires translating `HERO_FACE_POSITION`'s percent-of-2D-art-width value into a 3D world-space camera/`OrbitControls` target offset — there is no existing mapping between those two coordinate spaces, and the calibration table (`HERO_FACE_POSITION`, 38 heroes) was hand-tuned against 2D renders, not verified against the 3D model's actual proportions per hero. Treat this as calibration work outside a mechanical refactor: the phase can ship the model-as-stage without per-hero camera retargeting (default camera framing for all heroes) and treat exact framing as a follow-up, OR budget explicit per-hero verification time if the planner wants D-02's plate to visually replace the 2D art's calibrated position on day one. `[ASSUMED]` — not decided by CONTEXT.md; flag as open in Assumptions Log.

**Auto-fallback banner (E4 in UI-SPEC.md):** distinct from `HeroPoseViewer`'s existing internal failure states (`HeroPoseFailureState`, `HeroPoseFailureKind = 'unsupported' | 'skin' | 'export'`, `HeroPoseViewer.tsx:290`, verified this session). The existing states render *inside* the plate/panel; the new banner is a frame-level element that additionally flips the *selected stage mode* back to the image plate when a Model attempt has "definitively failed" (UI-SPEC E4). This requires the stage-mode owner (whatever component/hook implements Pattern 1) to observe `HeroPoseViewer`'s failure state — currently that state is fully internal to `HeroPoseViewer` (`useState`, not exposed via a prop or callback). **A new callback prop on `HeroPoseViewer`** (e.g. `onFailureChange?: (kind: HeroPoseFailureKind | null) => void`) is the minimal change; it is additive to the component's existing internal `setFailure` calls (5 call sites, all already inside the file, verified this session).

### Pattern 2: Tray-preview `stale` pill (E5)

**What:** A derived boolean, not new state. `useTrayPreview.ts`'s existing effect never clears `previewId` when a rebuild starts — it only replaces it once the new build lands or fails (`useTrayPreview.ts:59-95`, verified this session: `setBuilding(true)` runs synchronously when `requestJson` changes, but `replace(null)` is only called in the disabled/empty branch, never in the rebuild branch). This means `building && previewId !== null` is already true for exactly the window D-06 describes ("retain the last valid preview while the replacement is building").

**When to use:** `HeroWorkshop.tsx`'s existing pill-rendering block (`HeroWorkshop.tsx:296-312`, verified this session), which currently renders "Building preview" and "Preview build failed" pills. Add a third, co-occurring pill:

```typescript
// Existing structure to extend, source: src/components/foundry/HeroWorkshop.tsx:296-312
{trayPreview.building && trayPreview.previewId && (
  <span className="...">{t('foundry.workshop.previewStale', 'Preview may be out of date')}</span>
)}
{trayPreview.building && (
  <span className="...">{t('foundry.workshop.previewBuilding', 'Building preview')}</span>
)}
{trayPreview.error && (
  <span className="...">{t('foundry.workshop.previewFailed', ...)}</span>
)}
```

No changes to `useTrayPreview.ts` itself are needed; the hook's existing `{ previewId, building, error }` return shape (`useTrayPreview.ts:16-22`) already carries everything the new pill needs.

### Pattern 3: Grid change-count loading badge (E6)

**What:** `FoundryHeroGrid.tsx` already reads `modsLoaded` from `useAppStore` (`FoundryHeroGrid.tsx:39`, verified this session) but never passes it to `HeroCard`. Thread it through as a new prop and add a third badge branch (loading dot) alongside the existing "absent when zero" and "numeral when > 0" branches (`FoundryHeroGrid.tsx:211-218`):

```typescript
// Existing badge to extend, source: src/components/foundry/FoundryHeroGrid.tsx:211-218
{!modsLoaded ? (
  <span aria-label={t('foundry.heroes.changeCountLoading', 'Change count is loading')}
        className="pointer-events-none absolute left-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-white/40 animate-pulse" />
) : changeCount > 0 ? (
  <span title={t('foundry.heroes.changeCount', { count: changeCount })} className="...">{changeCount}</span>
) : null}
```

**When to use:** Purely additive to `HeroCard`'s props (`modsLoaded: boolean`) and the `ordered.map` call site (`FoundryHeroGrid.tsx:120-129`, one new prop passed).

### Pattern 4: Effects-tab pre-write disclosure — the dry-run question

This is the one item CONTEXT.md explicitly asks the researcher not to resolve unilaterally ("Report the options and their costs rather than assuming an outcome"). Both options are traced against the actual bake pipeline this session, not assumed from the parity commit's stated reason.

**The parity commit's stated reason, checked against the code:** `heroColors.ts` bakes each recolor via `vpkmerge recolor-hero`/`prism`/`trippy-vfx` (subprocess calls, `ensureHeroColorBake`/`ensureHeroPrismBake`/`ensureHeroTrippyVfxBake`, `heroColors.ts:167-336`, verified this session). The Rust side's `HeroRecolorRecipe` (referenced in `docs/ability-vfx-recolor.md`, not itself in this repo) is a **static, per-hero, pinned table** of `particle_prefixes`, `texture_entries`, `material_entries`, `model_entries` — it is not discovered by scanning at bake time in the sense of "unknowable ahead of time." What *is* true is that Grimoire's TypeScript side has no visibility into that Rust-side recipe table; it only ever gets back a finished VPK. So "discovered at bake time" describes Grimoire's current *integration*, not an inherent property of the problem.

**Option A — Bake first (or reuse cache), then read the produced VPK's entry list.**
- Mechanism: `ensureHeroColorBake`/`ensureHeroPrismBake`/`ensureHeroTrippyVfxBake` already run on every `applyHeroColor`/`applyHeroPrism`/`applyHeroTrippyVfx` call and are **cache-keyed by the exact normalized parameters** (`colorCachePath`/`prismCachePath`/`trippyVfxCachePath`, verified this session — identical hue/sat/brightness/style/targets combos reuse the cache file, no rebake). Once the bake exists (fresh or cached), its entry list is readable with the app's own existing VPK directory parser (`parseVpkDirectoryCached`, `electron/main/services/vpk.ts`, the same function `detectVfxLayerFromVpk` already calls, verified this session) — no new parsing code needed.
- Timing: run this **at the moment the user commits** (clicks Apply), not live during slider drag. Concretely: bake (or hit cache) -> read entry list -> call the existing `foundry:inspectAssetSources` IPC with those paths -> render `<AssetSourcesPanel paths={...} />` (the exact same component `HeroSkinOverlapPanel` already uses for sound, `HeroSkinOverlapPanel.tsx:101`, verified this session) in a brief confirm step before `rebuildLockerColors` actually writes the managed colors VPK.
- Cost: **zero marginal bake cost** over what Apply already does today, because the bake this reads from is the same bake Apply performs — this option just makes that existing bake's result visible before the final `rebuildLockerColors` write instead of only after. The only new cost is one VPK-directory-parse call (cheap, cached) and one `foundry:inspectAssetSources` round trip (same cost `HeroSkinOverlapPanel` already pays for sound).
- Fit with D-07: D-07 says "modal only when destructive/ambiguous... routine non-conflicting actions keep their current speed." A recolor apply is not "routine" in the same sense as picking a sound (it is a slower, already-bake-gated action, not an instant click), so a brief confirm step before the write does not regress perceived speed the way inserting a modal into sound-picking would. **Recommended default.**

**Option B — Cheap, no-bake, live prefix scan of the particle portion only.**
- Mechanism: `particles/abilities/<codename>/` and `particles/weapon_fx/<codename>/` are static, hard-coded, per-hero path prefixes, already used by `detectVfxLayer`/`detectVfxLayerFromVpk` (`electron/main/services/vpk.ts:1077-1131`, verified this session) to identify a hero's VFX layer inside an *arbitrary* VPK. The same prefix-matching, applied to `pak01_dir.vpk`'s own (cached) directory listing instead of a mod's, yields the recolor's particle write-set with **no subprocess call and no bake** — just a filtered list from an already-cached VPK directory parse.
- Coverage gap: this only covers the `particle_prefixes` portion of the Rust-side recipe. It **misses** the hand-curated `texture_entries`/`material_entries`/`model_entries` (per `docs/ability-vfx-recolor.md`'s Paige example: 267 particle files vs. 9 texture files + 2 model files — roughly 96% of entries by count for a fully-covered hero, but not all of them, and the doc notes some heroes are "particle-only," so the gap is hero-dependent and not derivable from this repo alone). There is no way to enumerate the texture/model portion without either (a) hardcoding a second copy of the Rust recipe table in TypeScript (a duplicated-intent risk `docs/fork-divergence-policy.md` warns against directly: "the thing to minimize is not divergence in general, it is duplicated intent"), or (b) a new `vpkmerge` CLI flag to print the recipe (cross-repo change, out of this phase's boundary — the sibling `vpkmerge` repo is not part of this codebase).
- Cost: effectively free (one cached VPK-directory filter), and could run live while dragging sliders, unlike Option A.
- Fit with D-08: D-08 requires "exact normalized VPK paths" — a disclosure that is silently incomplete for some heroes does not fully satisfy this without an explicit caveat ("also touches N model/texture files, not shown"). Whether an approximate-but-live disclosure with a stated caveat satisfies ROADMAP success criterion 2 ("says what it will overwrite before it runs") is a product judgment call, not resolved here.

**Option C — New `vpkmerge` CLI flag for exact dry-run listing.** Noted for completeness, not recommended for this phase: `docs/ability-vfx-recolor.md` mentions `model recolor --list` already exists as a precedent ("`--list` first to see each model's color-bearing vertex buffers"), so a `recolor-hero --list-entries` sibling is plausible on the Rust side, but it requires a change to the separate `vpkmerge` repository and a subsequent pin bump in this repo (`scripts/fetch-vpkmerge.mjs`) — a cross-repo dependency this phase's Electron-only scope should not take on. `[ASSUMED]` that this is out of scope; not stated explicitly in CONTEXT.md, but consistent with `docs/fork-divergence-policy.md`'s scoping guidance and the phase's stated boundary (Phase 3, not Phase 4, is the one that already touched `foundryForge.ts`'s edit-kind union; nothing in Phase 4's CONTEXT.md mentions the sibling repo).

**Recommendation:** Ship Option A as the default (bake-then-disclose-at-Apply, reusing `AssetSourcesPanel` verbatim). It is the only option that fully satisfies D-08 without a cross-repo change, costs nothing beyond the bake that already happens, and its "before it runs" framing is literally true (the disclosure appears before `rebuildLockerColors`'s write, using a bake that was going to happen anyway). If a live/instant preview while dragging sliders is later wanted, Option B can be added as a supplementary, explicitly-labeled-approximate live indicator without replacing Option A's exact confirm step.

### Anti-Patterns to Avoid

- **Importing `HeroPoseViewer`, `Mod`, or any Locker/Foundry store into `HeroDetailFrame.tsx`.** D-03 is explicit and the frame's own header comment already states this invariant (`HeroDetailFrame.tsx:23-25`, verified this session: "The frame is deliberately ignorant of both domains: no mod types, no stores, no Foundry types"). Use a `platePreview?: ReactNode` slot instead.
- **Hardcoding a second copy of the Rust-side `HeroRecolorRecipe` texture/model entry list in TypeScript** to make Option B "complete." This is exactly the duplicated-intent pattern `docs/fork-divergence-policy.md` warns costs the most at absorption time, and it would silently drift the moment a hero's recipe changes on the Rust side without anyone touching this repo.
- **Baking on every slider tick for a live disclosure.** The full bake patches up to ~270 particle files and re-encodes textures (one Paige texture is 4096x4096, called out in `docs/ability-vfx-recolor.md` as "slow re-encode"). This is materially more expensive than the existing `previewHeroColor`'s `--preview-png` fast path (~170ms, one representative texture only, no VPK write) — do not conflate the two.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VPK ownership disclosure (who else owns these exact paths) | A new scan/inspection component for the Effects tab | `AssetSourcesPanel` (`src/components/foundry/AssetSourcesPanel.tsx`) + `foundry:inspectAssetSources` IPC, both already exist and are already reused once (sound, via `HeroSkinOverlapPanel`) | Exact same contract (`paths: string[]`) the recolor disclosure needs; a second implementation would duplicate the ownership-resolution logic D-08 depends on being singular |
| Segmented view toggle | A hand-rolled two-button toggle for stage mode | `SegmentedControl` + `useSegmentedTabs` (`src/components/common/ui.tsx`, `useSegmentedTabs.ts`) | UI-SPEC mandates this primitive; `useSegmentedTabs`'s "one reused panel is the right model" doc comment (`useSegmentedTabs.ts:9-14`) matches this exact case (one plate, two view modes) rather than the more common "N sibling panels" case |
| Debounced rebuild-on-change | A new debounce utility for any future preview-adjacent feature | The existing `REBUILD_DELAY_MS = 700` pattern in `useTrayPreview.ts:14` | Already tuned and tested for this exact class of problem (rebuild a temp VPK on staged-edit change) |

**Key insight:** every "don't hand-roll" item in this phase is a case of *reusing a component that was built one lane ago for a structurally identical problem* (sound disclosure -> recolor disclosure; tray preview debounce -> nothing new needed) rather than reaching for a general library. The phase's actual net-new code is small.

## Common Pitfalls

### Pitfall 1: Treating the model-as-stage work as "swap the `<img>` for a `<Canvas>`"

**What goes wrong:** `HeroDetailFrame` currently owns the `<img>` element and its `onError` fallback chain directly (`HeroDetailFrame.tsx:118-134`). A naive implementation adds a three.js import to this file to render the model inline, violating D-03's "must not import Locker or Foundry stores or domain types" and pulling the (currently lazy-loaded) three.js chunk into every surface that imports `HeroDetailFrame`, including any future non-hero use of the frame.
**Why it happens:** the plate slot visually looks like one interchangeable image; the type system (`HeroPlateKind` already including `'model'`) invites treating it as uniform.
**How to avoid:** the frame renders its own `<img>` OR a caller-supplied `ReactNode` override, never a `HeroPoseViewer` it imports itself. Keep `HeroPoseViewer`'s lazy `import()` in the calling page (`LockerHero.tsx`/`HeroWorkshop.tsx`), exactly as today.
**Warning signs:** `HeroDetailFrame.tsx`'s import list growing to include anything from `components/locker/` or `components/foundry/`, or `three`/`@react-three/*`.

### Pitfall 2: Assuming `useModelPanelOpen`'s existing default (`false`) can just be flipped to `true` for Locker

**What goes wrong:** D-02 says "the model is the primary stage when it can load" — but "when it can load" is doing real work. `get-hero-pose-info` (the cheap availability check) only reports whether a **cached** export exists, not whether an export would succeed (`ipc/portraits.ts:128-137`, verified this session: it returns `hasModel: false` for an uncached-but-exportable hero, indistinguishable from a genuinely unsupported one). Defaulting to Model unconditionally means every hero-open triggers `exportHeroPose` (an on-demand bake, not free) unless a cache already exists; defaulting to Image and only offering Model on demand undermines D-02's "primary" framing.
**Why it happens:** the existing `useModelPanelOpen` hook was built for an opt-in floating panel, where "closed by default" was uncontroversial; repurposing it for a default-on plate changes the cost/UX tradeoff without changing the code shape.
**How to avoid:** this is UI-SPEC's own flagged backstop (E1 "loading" row) — the planner must pick one of "optimistically select Model and let a failure fall through to the auto-fallback banner (E4)" or "show a brief checking-availability state before the segments become interactive." Do not silently assume either; UI-SPEC leaves it explicitly open and CONTEXT.md does not resolve it.
**Warning signs:** every hero-open now doing a rigged+static pose export attempt (two-attempt loader, `HeroPoseViewer.tsx:1017-1063`) before the user has expressed any interest in the model, inflating perceived load time.

### Pitfall 3: Trusting `docs/locker-deep-dive.md`'s "in flight, uncommitted" framing for per-skin pose-failure attribution

**What goes wrong:** UI-SPEC.md's E1/E4 "partial" rows treat stack-vs-skin pose-failure attribution as unresolved, citing the doc's 2026-07-30 status. This session re-verified: `src/stores/poseFailureStore.ts` **is committed** (`ade0a13`, confirmed ancestor of `HEAD`), and `HeroPoseViewer.tsx` already implements the single-skin-fallback narrowing described as "the non-obvious part" (`attributeBrokenSkinSources`, `markBroken`, `HeroPoseViewer.tsx:1084-1094`, verified this session). What is genuinely still missing is only the **typed `reason` field on `HeroPoseInfo`** (`types/portrait.ts:79-83`, still exactly `{ hasModel, mtimeMs, key }`, no `reason`, re-verified this session) — the taxonomy's "no game path configured" vs. "hero not posable" vs. "our extraction failed" distinction still collapses into generic strings at the `HeroPoseFailureState` level, but the skin-level badge mechanism itself is real and shipped.
**Why it happens:** `docs/locker-deep-dive.md` was correct when written and was never updated after the commit landed nine days later; the phase's own source documents (UI-SPEC.md, CONTEXT.md) both explicitly flag this exact doc as needing re-verification, which this research did.
**How to avoid:** when building the auto-fallback banner (E4), you can rely on `poseFailureStore`'s existing per-skin marks for card-level badging (already wired, do not rebuild), but the banner's own copy should stay hero-level/generic (as UI-SPEC already specifies) since `HeroPoseInfo` still cannot carry a typed reason distinguishing *why* the stage-level attempt failed.
**Warning signs:** a plan task that says "implement per-skin pose failure tracking" — that work is already done; only the typed-reason enhancement and the new frame-level banner remain.

## Code Examples

### Existing plate composition switch (extend, do not replace)

```typescript
// Source: src/lib/heroStage.ts:229-250 (verified this session — the 'model'
// branch already exists and needs no changes)
export function heroPlateComposition(plate: HeroPlate): HeroPlateComposition {
  switch (plate.kind) {
    case 'skinImage':
      return { className: 'absolute inset-0 h-full w-full object-cover', style: { objectPosition: '50% 50%' }, usesRenderFallback: false };
    case 'model':
      return { className: 'absolute inset-0', usesRenderFallback: false };
    case 'render':
    default:
      return { className: 'absolute top-0 right-0 h-full w-auto max-w-none', usesRenderFallback: true };
  }
}
```

### Existing per-hero VFX prefix detection (reuse for Option B, or as a reference for Option A's read-back)

```typescript
// Source: electron/main/services/vpk.ts:1077-1121 (verified this session)
const VFX_LAYER_PATTERNS: RegExp[] = [
  /(?:^|\/)particles\/abilities\/([a-z0-9_]+)\//i,
  /(?:^|\/)particles\/weapon_fx\/([a-z0-9_]+)\//i,
];

export function detectVfxLayer(paths: string[]): VfxLayer | null {
  // ... byCodename grouping, returns { codename, paths, prefixes } or null
  // when zero or multiple codenames are present.
}
```

### Existing reusable disclosure pattern (sound; Effects tab should follow this shape exactly)

```typescript
// Source: src/components/locker/HeroSkinOverlapPanel.tsx:37-59, 101 (verified this session)
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

## State of the Art

| Old Approach (as docs described it) | Current Approach (verified in tree) | When Changed | Impact |
|--------------------------------------|--------------------------------------|---------------|--------|
| Per-skin pose failure attribution "in flight, uncommitted" (`docs/locker-deep-dive.md`, 2026-07-30 status) | Committed and shipped (`ade0a13`, `src/stores/poseFailureStore.ts`) | 2026-07-30, same day the doc's reconciliation pass was written, but before the commit landed | Planner should not schedule work to (re)build per-skin attribution; only the typed-`HeroPoseInfo.reason` enhancement remains open |
| ROADMAP.md: "lanes 2 to 5 are no longer blocked" (implying pending) | Lanes 2, 4, and most of 5 already delivered (`f614bb7`) | Landed before Phase 4 context-gathering, discovered and documented in UI-SPEC.md's Scope note, independently re-confirmed this session | This document (and the plan that follows) must scope to only the 4 items above, not the full lane list |
| `docs/locker-foundry-parity-plan.md` Lane 3: "Reuse `analyzeStagedEdits`... to compute what a Locker sound or effects apply would overwrite" (implying effects disclosure was planned as straightforward) | The actual parity commit shipped sound disclosure only and explicitly declined effects disclosure with a stated reason | Discovered this session by reading the commit message context cited in UI-SPEC.md and tracing `heroColors.ts` | The "straightforward reuse" premise from the original plan doc does not hold for effects; this phase must make an explicit product decision (Option A recommended) rather than assume the same one-line reuse pattern sound got |

**Deprecated/outdated:** `docs/locker-deep-dive.md`'s "Status since this was written" reconciliation section is itself now nine days stale on the one item (poseFailureStore) it called "in flight." Treat any "in flight, uncommitted, untracked" claim in that document as needing a fresh `git log`/`git status` check before planning around it, not just this one instance.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-hero camera retargeting (`heroSubjectX` wiring into the 3D camera) is out of this phase's minimum scope and can ship with a fixed default camera for v1 of the model-as-stage plate. | Architecture Patterns #1, "Camera framing gap" | If the planner instead scopes exact per-hero framing into this phase, the work is materially larger (38-hero calibration/verification pass, not a mechanical wire-up) and should be split into its own task or deferred explicitly rather than estimated as trivial |
| A2 | A new `vpkmerge` CLI flag for exact recolor dry-run listing (Option C) is out of this phase's boundary because it requires a cross-repo change to the sibling `vpkmerge` engine. | Architecture Patterns #4, Option C | If the team is willing to take on the sibling-repo dependency and pin bump, Option C would eventually give an exact, cheap, live disclosure superior to both A and B — but nothing in CONTEXT.md authorizes that scope for Phase 4 |
| A3 | The stage-mode default-selection policy for E1's "loading" backstop (optimistic Model-first vs. an availability-check step) is left to the planner, per UI-SPEC.md's own explicit flag. | Common Pitfalls #2 | Choosing "optimistic" without measuring the cost of an unconditional pose-export attempt on every hero-open could regress perceived Locker responsiveness for heroes with no cached pose |
| A4 | `docs/locker-deep-dive.md`'s per-skin attribution status is stale and `poseFailureStore.ts`'s existing mechanism should be treated as complete infrastructure, not something to rebuild. | Common Pitfalls #3, State of the Art | Low risk: this was verified directly against `git log`/`git merge-base` this session, not inferred from the doc |

## Open Questions

1. **Should the Effects-tab disclosure (Pattern 4) block Apply, or only inform it?**
   - What we know: D-07 allows a modal "when the action has a destructive overwrite that cannot be made unambiguous inline," and sound disclosure stays inline/non-blocking.
   - What's unclear: whether a recolor/trippy apply, which is already a multi-second bake-gated action (not an instant click), should insert an explicit confirm step (closer to Foundry's tray review) or stay inline like sound.
   - Recommendation: given the bake already happens before the final write regardless (Option A), a lightweight inline disclosure shown once the bake completes and before `rebuildLockerColors` runs (not a full modal) most closely matches D-07's stated preference for inline treatment; reserve a hard confirm-blocking modal only if the disclosure reveals the recolor would take over paths currently owned by a different downloaded mod (a genuinely destructive, surprising case).

2. **What exact persistence key/shape should stage-mode selection use?**
   - What we know: `useModelPanelOpen`'s existing per-surface `localStorage` pattern (`grimoire.${surface}.modelPanel.open`) is the established convention to extend.
   - What's unclear: whether stage mode should be a boolean (reusing the exact existing key/shape, repurposed) or a new three-state-capable key (`'model' | 'image' | null-for-unset`) to allow future stage modes without a second migration.
   - Recommendation: introduce a new key (e.g. `grimoire.${surface}.heroStage.mode`) rather than repurposing the existing boolean key, since the existing key's semantics ("is the floating panel open") genuinely change meaning if silently reinterpreted as "is Model selected" — a user who previously left the panel closed should not be surprised by a semantics change under the same storage key.

## Environment Availability

Not applicable. This phase has no new external tool, service, or runtime dependency: the `vpkmerge` binary, Deadlock installation path, and all IPC surfaces used are already required by (and verified working for) the shipped lanes this phase builds on.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`, `package.json` script `test`) |
| Config file | `vitest.config.ts` (node environment by default; per-file `// @vitest-environment jsdom` pragma opts a test into DOM rendering) |
| Quick run command | `pnpm exec vitest run <path-to-test-file>` |
| Full suite command | `pnpm test` |

Render-capable test precedent already exists for structurally identical components: `src/components/foundry/AssetSourcesPanel.test.tsx` and `src/components/foundry/PortraitEditor.test.tsx` (verified present this session) both use the `@vitest-environment jsdom` per-file pragma established by Phase 1's `REQ-renderer-test-harness`. New tests for the stage-mode control and the frame's plate branch should follow this exact pattern rather than introducing a second harness.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-locker-model-as-stage | `resolveHeroPlate`/`heroPlateComposition` produce the `'model'` branch when the caller requests it | unit | `pnpm exec vitest run src/lib/heroStage.test.ts` | Test file exists (`heroStage.test.ts`); extend it, do not create a new one |
| REQ-locker-model-as-stage | `HeroDetailFrame` renders the caller-supplied plate override and stays free of Locker/Foundry imports | render (jsdom) | `pnpm exec vitest run src/components/common/HeroDetailFrame.test.tsx` | Wave 0 gap: no `HeroDetailFrame.test.tsx` exists yet (verified via file listing this session) |
| REQ-locker-foundry-parity-lanes (stale pill) | `useTrayPreview` exposes `building && previewId !== null` in the retained-preview window | unit | `pnpm exec vitest run src/components/foundry/useTrayPreview.test.ts` | Wave 0 gap: no test file for this hook exists yet |
| REQ-locker-foundry-parity-lanes (grid badge) | `FoundryHeroGrid` renders the loading dot when `!modsLoaded` and the numeral when `changeCount > 0`, never both | render (jsdom) | `pnpm exec vitest run src/components/foundry/FoundryHeroGrid.test.tsx` | Wave 0 gap: no test file exists yet |
| REQ-locker-foundry-parity-lanes (effects disclosure) | The chosen dry-run option (Option A recommended) produces the correct write-set for a known hero/param combo | unit (main-process, node env) | `pnpm exec vitest run electron/main/services/heroColors.test.ts` | Wave 0 gap: no dedicated test file for the new write-set function exists yet (existing `heroColors.previewHeroColor.test.ts` covers a different function) |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run <changed-test-files>`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `pnpm typecheck` and `pnpm lint` per `docs/ui-conventions.md`'s standing rule ("After UI changes: `pnpm typecheck` + `pnpm lint`")

### Wave 0 Gaps

- [ ] `src/components/common/HeroDetailFrame.test.tsx` — new, covers plate-slot override rendering and the frame's continued domain-ignorance (no Locker/Foundry imports)
- [ ] `src/components/foundry/useTrayPreview.test.ts` — new, covers the stale-window derivation
- [ ] `src/components/foundry/FoundryHeroGrid.test.tsx` — new, covers the loading-vs-zero-vs-numeral badge states
- [ ] `electron/main/services/heroColors.test.ts` — new, covers the chosen dry-run write-set function
- [ ] `src/lib/heroStage.test.ts` — existing, extend for the `'model'` branch if not already covered (verify current coverage before assuming a gap)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so treated as enabled per the standing rule. This phase introduces no new authentication, session, or cryptography surface; it is presentation and disclosure-only work over data the app already reads (VPK entry paths, hero pose exports).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface |
| V3 Session Management | no | No new session surface |
| V4 Access Control | no | No new access boundary; all IPC reused is already gated by the existing main/renderer trust boundary (renderer never names a filesystem path directly, per `HeroPoseSkinSource`'s `previewId` doc comment, `types/portrait.ts:62-68`, verified this session) |
| V5 Input Validation | yes (narrow) | Any new IPC handler for the recolor write-set preview (Pattern 4, Option A/B) must validate `heroName` the same way existing handlers do (`colorCodenameForHero` returning `null` for an unknown hero, `heroColors.ts:441-444`, already throws a clear error) — no new validation pattern needed, reuse the existing one |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer-supplied path reaching a main-process file write | Tampering | Already mitigated by the existing pattern this phase does not change: the renderer never supplies a raw filesystem path for the preview VPK; main issues an opaque `previewId`/cache key instead (`types/portrait.ts:62-68`, `previewVpkRegistry.ts`). Any new IPC (Option A/B's write-set preview) must follow the same shape: renderer passes `heroName` + params, main resolves paths internally. |

## Sources

### Primary (HIGH confidence — read directly this session)

- `C:/Users/wayba/dev/grimoire/src/lib/heroStage.ts` — plate kind types, composition function, camera-target helper
- `C:/Users/wayba/dev/grimoire/src/components/common/HeroDetailFrame.tsx` — current plate rendering, domain-ignorance invariant
- `C:/Users/wayba/dev/grimoire/src/pages/LockerHero.tsx` — current FloatingModelPanel mounting, `useModelPanelOpen` usage
- `C:/Users/wayba/dev/grimoire/src/components/foundry/HeroWorkshop.tsx` — current tray-preview pill rendering, FloatingModelPanel mounting
- `C:/Users/wayba/dev/grimoire/src/components/locker/FloatingModelPanel.tsx` — pop-out target, existing `PictureInPicture2` icon usage
- `C:/Users/wayba/dev/grimoire/src/components/locker/useModelPanelOpen.ts` — existing per-surface persistence pattern
- `C:/Users/wayba/dev/grimoire/src/components/locker/HeroPoseViewer.tsx` — failure-state taxonomy, per-skin attribution wiring, camera setup, plate-shaped root element
- `C:/Users/wayba/dev/grimoire/src/stores/poseFailureStore.ts` — per-skin pose-failure store (confirmed committed, `ade0a13`)
- `C:/Users/wayba/dev/grimoire/src/components/foundry/useTrayPreview.ts` — tray-preview state machine, existing stale-retention behavior
- `C:/Users/wayba/dev/grimoire/src/components/foundry/FoundryHeroGrid.tsx` — grid badge, `modsLoaded` availability
- `C:/Users/wayba/dev/grimoire/src/components/locker/HeroSkinOverlapPanel.tsx` — the sound disclosure pattern to replicate
- `C:/Users/wayba/dev/grimoire/src/components/foundry/AssetSourcesPanel.tsx` — the reusable ownership-disclosure component
- `C:/Users/wayba/dev/grimoire/electron/main/services/heroColors.ts` — recolor/prism/trippy bake pipeline, cache-key discipline
- `C:/Users/wayba/dev/grimoire/electron/main/services/vpk.ts` — `detectVfxLayer`/`parseVpkDirectoryCached`, the prefix-scan primitive
- `C:/Users/wayba/dev/grimoire/electron/main/ipc/mods.ts` — `foundry:inspectAssetSources` handler
- `C:/Users/wayba/dev/grimoire/electron/main/ipc/portraits.ts` — `get-hero-pose-info` handler shape
- `C:/Users/wayba/dev/grimoire/src/types/portrait.ts` — `HeroPoseInfo`, `HeroPoseSkinSource` shapes
- `C:/Users/wayba/dev/grimoire/src/lib/heroFavorites.ts` — confirms D-13's shared favorites store
- `C:/Users/wayba/dev/grimoire/docs/ability-vfx-recolor.md` — the recolor recipe mechanism and per-hero entry-set composition
- `C:/Users/wayba/dev/grimoire/docs/locker-foundry-parity-plan.md` — original lane plan (superseded scope, kept for historical trace)
- `C:/Users/wayba/dev/grimoire/docs/locker-deep-dive.md` — model-as-stage vision (status section found stale, corrected in this document)
- `C:/Users/wayba/dev/grimoire/docs/ui-conventions.md`, `docs/upstream-boundary-map.md`, `docs/fork-divergence-policy.md` — house rules applied throughout
- Git: `git log`/`git merge-base --is-ancestor` verification of `f614bb7` and `ade0a13` against `HEAD`

### Secondary (MEDIUM confidence)

- None used beyond primary sources; all claims in this phase were verifiable by reading the working tree directly, so no web search or external documentation lookup was needed.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every library already in use for structurally identical shipped features
- Architecture (stage composition, disclosure options): HIGH for what exists and is cited with file:line; MEDIUM for the camera-framing and default-selection design decisions explicitly flagged as open (A1, A3)
- Pitfalls: HIGH — all three traced to specific, cited code paths and one directly corrects a stale project doc

**Research date:** 2026-08-08
**Valid until:** 14 days (this codebase's own docs demonstrate status drift on a roughly 1-2 week cadence; re-verify `poseFailureStore.ts`/`HeroDetailFrame.tsx`/`useTrayPreview.ts` against `git log` before planning if this document is more than 2 weeks old)
