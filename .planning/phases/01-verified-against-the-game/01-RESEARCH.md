# Phase 1: Verified Against The Game - Research

**Researched:** 2026-08-06
**Domain:** Vitest/jsdom render-test harness construction; Electron IPC test doubles; ConVar data threading; human-gated in-game verification scaffolding
**Confidence:** HIGH (all core claims verified by reading the actual source files this session; no external library research was needed because this phase touches only the existing codebase plus one devDependency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Render harness**
- **D-01:** Render tests extend the existing precedent rather than introducing a library. `src/components/common/HeroSelect.test.tsx` already renders under jsdom with raw `react-dom/client` + `act` and no testing-library; it passes today (5 tests, 2.2s, verified 2026-08-06). New render tests follow that shape.
- **D-02:** `jsdom` is added to `devDependencies` explicitly. It is currently absent from `package.json` entirely and resolves only as a hoisted transitive copy (24.1.3), so the one passing render test works by accident of the lockfile.
- **D-03:** Each test file declares its environment with a per-file `// @vitest-environment jsdom` pragma. `vitest.config.ts` is not modified. — **Reversibility:** reversible — a glob rule can replace the pragmas later in one edit if the boilerplate becomes a problem.
- **D-04:** Each of the six lanes gets an interaction-depth test that drives the behavior the lane shipped for, not a mount-without-throwing smoke check. Lanes: pool cards, alternatives gallery, audition preview, sound trim/gain badges, seeded `SoundImportEditor`, portrait editor.
- **D-05:** The Chat Wheel round trip is real: build a VPK from `resources/chatlane/starter.yml` through `buildChatWheelVpk`, read it back through `readChatWheelVpk`, assert the YAML survives. Not a stub, not a golden fixture.
- **D-06:** That test guards on `chatLaneBinaryPath()` resolving and skips when the binary is absent, so it runs on Windows locally and CI stays green on `ubuntu-latest`. No `.github/workflows/ci.yml` change. — **Reversibility:** reversible — adding a Windows CI job later is additive.

**Evidence record**
- **D-07:** All human-gated evidence lives in one new fork-only doc under `docs/`, one row per check, sitting beside `docs/rigged-preview-spike.md` as the same kind of artifact.
- **D-08:** A passing check is a written verdict naming what was run and what happened. A failing check additionally attaches the screenshot, clip, or log that shows it.
- **D-09:** A plan scaffolds the record with every row present and empty (exact steps, the mod or hero to use, what a pass looks like, verdict blank). The user runs the game session and fills the verdicts in. No agent can run Deadlock.
- **D-10:** The phase is not done while any row is blank. `blocked`, with a stated reason, is a legitimate verdict for a check whose preconditions are unavailable. — **Reversibility:** reversible — this is a completion rule, not a code change.

**Failure handling**
- **D-11:** A failed in-game check produces a verdict row plus a written root-cause note. Only then is in-phase fix versus new phase decided. Neither "always fix here" nor "always route out" applies.
- **D-12:** The user makes that call. The agent proposes a size first: files touched, whether it crosses the main/renderer process boundary, whether it moves a shipped format.

**ConVar defaults**
- **D-13:** A new `engineDefault` field is added beside `gameDefault` in `electron/main/services/performanceUserControls.ts`. `gameDefault` keeps its existing meaning (what stock `gameinfo.gi` writes, where `null` means the key is unset and so `off` is a written value rather than a removal). `engineDefault` carries what the console reports. — **Reversibility:** costly — the two fields feed the four-state badge logic in `convarStates`; collapsing them later means re-deciding every consumer's branch.
- **D-14:** `citadel_damage_offscreen_indicator_disabled` is recorded as the raw console value with a comment stating the inversion, and its `on`/`off` mapping is re-checked against the reading. Values are not normalized at the source.
- **D-15:** `citadel_hud_objective_health_enabled` is currently commented as unsupported. The reading either confirms or contradicts that, and the comment is corrected either way.
- **D-16:** The only UI effect this phase is the badge: `convarStates` gains the engine value so an untagged stock line stops being badged "Your override" and an unset toggle can show what the game will do. No new controls. Today's per-control reset keeps removing Grimoire's line rather than writing an app-chosen number, which was a deliberate decision.

**Rigged preview gate**
- **D-17:** The decision resolves to `RELEASE_RENDER_FLAGS.rigged` true or false, plus the written recommendation. No per-hero mechanism and no user-facing setting are built. If the measurement argues for per-hero, that is a recorded finding and its own phase.
- **D-18:** The spike's step 3 (roster-wide `model clips --json` sweep, no export) runs only if the fps reading argues for shipping. If the number says gate, the sweep is skipped.

### Claude's Discretion
- Whether the six render tests share a fixture module or keep the codebase's existing inline-factory convention (`TESTING.md` documents inline factories with no shared `fixtures/` directory).
- The exact filename and row schema of the verification record doc.
- Which specific mod, hero, and multi-clip pool serve as fixtures for each in-game check. These get proposed in the scaffold; the user can substitute at run time.

### Deferred Ideas (OUT OF SCOPE)
- **Auto-apply of performance settings.** The user asked for saved settings to be applied automatically. Saving already works (`overridesByPreset` in the sidecar, harvested and re-layered on every apply), but nothing reapplies on launch or after a game update; every apply is user-initiated. This is new capability and maps to the deferred `REQ-performance-convar-profiles-and-recovery`, whose Phase C is a "compatibility manifest checked on launch". If it is wanted sooner than v2 it needs its own phase, not a Phase 1 task.
- **Per-hero rigged preview allowlist.** No mechanism exists near `RELEASE_RENDER_FLAGS`. Only built if the fps measurement actually argues for it, and then as its own phase.
- **Reset-to-engine-default action** on ConVar controls. Becomes possible once `engineDefault` is populated, but today's per-control reset deliberately removes Grimoire's line rather than writing an app-chosen number, so changing it is a decision, not a follow-through.
- **A Windows CI job.** Would let the Chat Wheel round trip gate on every push. Additive whenever it is wanted; costs a shared workflow file edit.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-ingame-verification-sweep | Every path proven only by unit tests is exercised against a running Deadlock build and the result recorded: forge-and-mount a sound+texture VPK, cancel-dialog no-op, forge-install rollback, merged-VPK winner, `AssetSourcesPanel` audition parity, hero/voice/global sound cases across four fixture types, and honest `minimap`/`small` portrait `VARIANT_LABEL`s. | Evidence-record doc shape (D-07..D-10) modeled on `docs/rigged-preview-spike.md`'s measured/estimated/unverifiable table; scaffold structure in Validation Architecture section |
| REQ-renderer-test-harness | Render six previously-untested Foundry lanes (pool cards, alternatives gallery, audition preview, sound trim/gain badges, seeded `SoundImportEditor`, portrait editor) plus the Chat Wheel VPK round trip. | Full component-by-component trace of all six lanes (Architecture Patterns, Pitfalls 1-3), exact `window.electronAPI`/canvas/media stubbing gaps identified, Chat Wheel round-trip function signatures and skip-guard confirmed |
| REQ-rigged-preview-release-gate | Human measures fps on Seven (`gigawatt_prisoner`) per `docs/rigged-preview-spike.md` §8, records a ship/gate/per-hero recommendation, and applies it to `RELEASE_RENDER_FLAGS.rigged`. | Confirmed `RELEASE_RENDER_FLAGS.rigged: false` at `HeroPoseViewer.tsx:119` is the exact value the decision writes to; confirmed the flag-decoupling prerequisite (spike step 1) already shipped and is tested at `HeroPoseViewer.test.ts:159-164` |
| REQ-performance-convar-safer-experimentation | Eight advanced ConVar defaults and seven HUD toggle defaults read off a running build, recorded as `engineDefault` beside `gameDefault`. | Full four-file data-flow chain traced with exact line numbers and verbatim interface quotes (Pattern 5); confirms this is a 4-file change, not the 2-file change CONTEXT.md's code_context section implies |
</phase_requirements>

## Summary

This phase has almost no "new technology" to research. It is a verification and test-infrastructure phase on a codebase that already contains one working precedent (`HeroSelect.test.tsx`) for rendering React under Vitest with `jsdom`. The real research work here was tracing exactly what each of the six render-test lanes touches, because several of them call browser APIs `jsdom` does not implement without an optional native package: `HTMLCanvasElement.getContext('2d')` returns `null` unless the `canvas` npm package is installed (it is not, and should not be added: it is a native build dependency and this phase's own standing constraint is to minimize shared-file and dependency footprint), and `HTMLMediaElement.play()`/`pause()` are stubbed as no-ops that emit a silent `jsdomError` rather than throwing. Both consuming components (`LockerImageCropper.tsx:323-327`, `SoundImportEditor.tsx:346-347`) already null-guard their canvas context, which means a naive render test will silently exercise the *fallback* branch instead of the real drawing behavior D-04 requires ("drives the behavior the lane shipped for, not a mount-without-throwing smoke check"). The plan needs an explicit decision on how each lane reaches its real behavior under jsdom.

A second load-bearing discovery: essentially every one of the six lanes calls `window.electronAPI.*` through `src/lib/api.ts` (grep found 16 files importing pool/gallery/sound/portrait helpers, all of which bottom out in `window.electronAPI.foundry.*`). `window.electronAPI` is populated by the preload's `contextBridge` at runtime; under Vitest/jsdom there is no preload, so it does not exist at all unless a test stubs it. No existing test file in this repo stubs `window.electronAPI` — this is genuinely new ground, and the plan should pick one approach (a plain object assigned to `globalThis.window.electronAPI` before render, matching the project's "mock via injected object, not `vi.mock()`" convention) and apply it uniformly across the six lane tests.

Third: the ConVar `engineDefault` field (D-13) is not a two-file change. `HUD_CONVARS`/`ADVANCED_GAMEINFO_CONVARS` in `performanceUserControls.ts` feed `configKeyIndex.ts`'s own **separately declared** `ConfigKeyDefinition` interface (not imported from `src/types/electron.ts` — the two files independently declare a `gameDefault: string | null` field that must be kept in sync by hand), which feeds `CONFIG_KEY_INDEX`/`CONFIG_KEY_BY_NAME`, which `performanceConfig.ts`'s `computeConvarStates` reads to build the `PerformanceConvarState` the renderer consumes (a third, again independently declared, interface in `src/types/electron.ts:139-155`). Adding `engineDefault` end-to-end touches four files, not two, and the plan should scope a task per file rather than one "add the field" task.

**Primary recommendation:** Extend the `HeroSelect.test.tsx` shape file-by-file (per-file `// @vitest-environment jsdom` pragma, no `vitest.config.ts` change, no testing-library), add `jsdom` to `devDependencies` pinned to `^24.1.3` (the version already hoisted and already proven to pass, not the `30.0.1` currently on the registry), and give each of the six render tests its own small `window.electronAPI` stub object plus, where the lane touches canvas, a `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` stub returning a minimal fake 2D context, rather than installing the native `canvas` package.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render test harness (jsdom, `react-dom/client`) | Renderer (test-only) | — | Pure UI rendering; no main-process involvement in the test itself |
| IPC stubbing for render tests | Renderer (test-only) | Preload (contract) | Tests stand in for the preload's `contextBridge` surface; the real contract lives in `electron/preload/index.ts` / `src/types/electron.ts` |
| Chat Wheel VPK round trip | API/Backend (main process) | — | `buildChatWheelVpk`/`readChatWheelVpk` spawn `ChatLane.exe` and touch the filesystem; this is a main-process service test, node environment, no DOM |
| Rigged preview fps measurement | Browser/Client (renderer, GPU) | — | Requires a real GPU-backed `HeroPoseViewer` render; cannot run headlessly, human-gated |
| ConVar `engineDefault` | API/Backend (main process, data) | Renderer (badge display) | The value is read off a running game console by a human and hand-typed into `performanceUserControls.ts`; the renderer only displays what the main process threads through `convarStates` |
| In-game verification sweep | Browser/Client (human, real Deadlock process) | — | No agent can run Deadlock; this is a human-only check against a real engine, recorded in a fork-only doc |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.9` (already pinned in `package.json:112`) | Test runner | Already the project's only test runner; `test:environment` per-file pragma is a documented Vitest 4 feature, no upgrade needed |
| `jsdom` | `^24.1.3` (add explicitly; currently hoisted transitively at this exact version — `node -e "require('./node_modules/jsdom/package.json').version"` printed `24.1.3` this session) [VERIFIED: node_modules/jsdom/package.json, checked via node this session] | DOM environment for the six render tests | It is the environment `HeroSelect.test.tsx` already declares via `// @vitest-environment jsdom` and the only DOM shim Vitest resolves for that pragma; adding it removes the "works by accident of the lockfile" risk D-02 names |
| `react-dom/client` (`createRoot`) | Already a `dependencies` entry via `react-dom@^19.2.0` (`package.json:74`) | Imperative render harness | `HeroSelect.test.tsx` uses this directly with no testing-library wrapper; matches D-01 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | — | — | No new library is needed for IPC stubbing or canvas/audio stubbing; both are done with a plain object assignment and `vi.spyOn`, which Vitest already provides (`vi` is imported in every existing test file that needs it) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `HTMLCanvasElement.getContext` returning `null` under jsdom | Installing the `canvas` npm package (native, node-gyp build) | Rejected: adds a native build dependency to `devDependencies` for six tests, works against the phase's explicit merge-cost minimization goal, and both consuming components already have a `null`-guarded fallback path that changes behavior once `canvas` is present (they stop hitting `noCanvasContext` and start actually drawing), which is more surface to keep in sync with upstream than a `vi.spyOn` stub |
| Manual `window.electronAPI` object per test | `vi.mock('../../lib/api')` | `TESTING.md` documents "No `vi.mock()`... tests avoid mocking at the module level" as the established convention (verified: no test file in the repo calls `vi.mock` at the module level except `chatWheel.test.ts`'s `vi.mock('electron', ...)` and `vi.mock('child_process', ...)`, which mock Node/Electron built-ins, not project code); a plain `globalThis.window.electronAPI = {...}` object before render matches the existing "manual mocks via factories" pattern more closely for a DOM-level global than a module mock would |
| Per-file jsdom pragma (D-03) | `vitest.config.ts` `environmentMatchGlobs` | Already decided by CONTEXT.md D-03: reversible, no shared-file edit, matches existing precedent |

**Installation:**
```bash
pnpm add -D jsdom@24.1.3
```

**Version verification:** [VERIFIED: npm registry, checked this session via `npm view jsdom version`] `jsdom` registry latest is `30.0.1`. The already-hoisted, already-proven copy in `node_modules/jsdom` is `24.1.3` [VERIFIED: node_modules/jsdom/package.json, read this session]. Pin the explicit devDependency to `24.1.3`, not `^30.0.1` or an unpinned `^24`: a caret range on `jsdom` risks pnpm resolving a newer major on the next `pnpm install` and silently changing DOM behavior under all six new render tests at once, with no test currently pinning that risk down. If a jsdom upgrade is ever wanted, it should be its own reviewed change, not an incidental side effect of adding the explicit dependency this phase needs anyway.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `jsdom` | npm | latest release `30.0.1` published 2026-07-29 (8 days before this research); package itself is a foundational, decade-old project | 91,746,979/week [VERIFIED: package-legitimacy seam, `gsd-tools query package-legitimacy check`, this session] | `github.com/jsdom/jsdom` | `SUS` (reason: `too-new`) | **Approved with correction** — see below |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `jsdom` — flagged only because its *most recent release* is within the tool's "too new" window, not because the package is untrustworthy. At 91.7M weekly downloads and an 11-year-old canonical DOM-implementation project this is a false positive on the "recent activity" heuristic, not a slopsquat signal. The mitigating action is already the plan's own decision: **pin to `24.1.3`**, the version already resolving and already passing in this repo, not the flagged-latest `30.0.1`. No `checkpoint:human-verify` task is needed beyond confirming the pinned version in the `package.json` diff during review, since the version being installed is not the one that triggered the flag.

*No other packages are installed or upgraded by this phase.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │   Human, real Deadlock       │
                    │   build + GPU (out of        │
                    │   automated reach)            │
                    └───────────────┬───────────────┘
                                    │ runs checks, fills verdicts
                                    ▼
   ┌────────────────────────────────────────────────────────┐
   │  docs/<verification-record>.md  (D-07..D-10)            │
   │  scaffolded by the plan: rows pre-filled with exact      │
   │  steps + fixture + pass criteria, verdict column blank   │
   └────────────────────────────────────────────────────────┘

   ┌──────────────────── Vitest (automated) ─────────────────┐
   │                                                          │
   │  node environment (default)          jsdom environment   │
   │  ┌───────────────────────┐           ┌─────────────────┐ │
   │  │ chatWheel.test.ts      │           │ 6 render tests   │ │
   │  │ (existing, stubbed)    │           │ + 1 new Chat     │ │
   │  │                        │           │ Wheel round-trip │ │
   │  │ NEW: real round trip   │           │ test file each   │ │
   │  │ buildChatWheelVpk() -> │           │                  │ │
   │  │ readChatWheelVpk() ->  │           │ createRoot() +   │ │
   │  │ assert YAML survives   │           │ act() + a local  │ │
   │  │ guarded on             │           │ window.electronAPI│ │
   │  │ chatLaneBinaryPath()   │           │ stub + (canvas/  │ │
   │  │                        │           │ audio stubs where│ │
   │  │ (skips on CI ubuntu,   │           │ the lane needs   │ │
   │  │  runs on Windows dev)  │           │ them)            │ │
   │  └───────────────────────┘           └─────────────────┘ │
   └──────────────────────────────────────────────────────────┘

   ┌──────── ConVar engineDefault data flow (main process) ───┐
   │                                                            │
   │ performanceUserControls.ts (hand-edited: add engineDefault │
   │   beside gameDefault on HUD_CONVARS + ADVANCED_GAMEINFO_   │
   │   CONVARS entries, values typed in from a human reading    │
   │   the console)                                             │
   │        │                                                   │
   │        ▼                                                   │
   │ configKeyIndex.ts (ConfigKeyDefinition interface + the two │
   │   .map() blocks that build userDefinitions — both need the │
   │   new field threaded through)                              │
   │        │                                                   │
   │        ▼                                                   │
   │ performanceConfig.ts computeConvarStates() (reads           │
   │   CONFIG_KEY_BY_NAME, must copy engineDefault onto the      │
   │   output PerformanceConvarState)                            │
   │        │                                                   │
   │        ▼                                                   │
   │ src/types/electron.ts PerformanceConvarState interface      │
   │   (separately declared — add engineDefault: string | null)  │
   │        │                                                   │
   │        ▼                                                   │
   │ GameConvarsSection.tsx ValueStateBadge (consumes            │
   │   state.gameDefault today; D-16 badge logic change)         │
   └────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new directories. Every new file is co-located per existing convention:

```
src/components/foundry/
├── ChangePools.test.tsx              # pool cards lane (renders FoundryPoolList)
├── AlternativesGallery.test.tsx      # alternatives gallery lane
├── MySoundChanges.test.tsx           # sound trim/gain badges lane (SoundTuningBadges)
├── SoundImportEditor.test.tsx        # seeded SoundImportEditor lane
├── PortraitEditor.test.tsx           # portrait editor lane
src/components/foundry/AssetSourcesPanel.test.tsx  # audition preview lane
electron/main/services/
├── chatWheel.roundtrip.test.ts       # NEW real round-trip file, separate from the
│                                      #   existing stubbed chatWheel.test.ts (D-05
│                                      #   says the existing stubbed tests stay)
docs/
├── <verification-record>.md          # D-07 scaffold, exact name is Claude's discretion
```

### Pattern 1: jsdom render test skeleton (established precedent)

**What:** Per-file jsdom pragma, `IS_REACT_ACT_ENVIRONMENT`, `createRoot`, `act()`-wrapped renders and events, `beforeEach`/`afterEach` root lifecycle.
**When to use:** Every one of the six render-lane tests.
**Example:**
```typescript
// Source: src/components/common/HeroSelect.test.tsx:1-9,72-86 (read this session)
// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe('SomeLane', () => {
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
    vi.restoreAllMocks();
  });

  it('drives the real interaction, not a mount-only smoke check', () => {
    act(() => root.render(/* component under test */));
    // ... query document, dispatch real events, assert real DOM state
  });
});
```

### Pattern 2: `window.electronAPI` stub for a render test (new — no existing precedent)

**What:** Every one of the six lanes calls `window.electronAPI.*` indirectly through `src/lib/api.ts` (e.g. `AssetSourcesPanel.tsx` calls `foundryInspectAssetSources`/`foundryAuditionSourceClip`, which are thin wrappers at `src/lib/api.ts:1580-1593` around `window.electronAPI.foundry.inspectAssetSources`/`.auditionSourceClip`). Under jsdom, `window.electronAPI` does not exist (no preload runs), so any render that reaches these calls without a stub throws `Cannot read properties of undefined`.
**When to use:** All six render-lane tests, and the reason each needs a purpose-built stub object rather than a shared fixture: each lane calls a different, small slice of the `foundry` namespace.
**Example:**
```typescript
// New pattern, not copied from an existing file — matches the project's
// "manual mocks via factories" convention (TESTING.md) applied to a DOM global
// instead of a module import.
beforeEach(() => {
  (globalThis as any).window.electronAPI = {
    foundry: {
      inspectAssetSources: vi.fn().mockResolvedValue({
        sources: [], winners: {}, unreadableMods: [],
      }),
      auditionSourceClip: vi.fn().mockResolvedValue('blob:fake-clip-url'),
    },
  };
});
```

### Pattern 3: canvas stub for the two canvas-drawing lanes

**What:** `LockerImageCropper.tsx:320-327` (portrait editor's crop-apply path) and `SoundImportEditor.tsx:336-349` (waveform draw) both call `canvas.getContext('2d')`. Without the native `canvas` npm package (not installed — `ls node_modules/canvas` confirmed absent this session), jsdom's `HTMLCanvasElement.prototype.getContext` returns `null` [VERIFIED: node_modules/jsdom/lib/jsdom/living/nodes/HTMLCanvasElement-impl.js:11-42, read this session — `getContext` calls `this._getCanvas()`, which returns `undefined` when the optional peer `Canvas` (the `canvas` package) is absent, and the method then calls `notImplemented(...)` and `return null`]. Both call sites already null-guard (`if (!ctx) { setError(...); return; }` and `if (!g) return;`), so an un-stubbed render test silently exercises the fallback branch, not the drawing code D-04 asks for.
**When to use:** `SoundImportEditor.test.tsx`, `PortraitEditor.test.tsx`.
**Example:**
```typescript
// New pattern. A minimal fake 2D context covering exactly the methods each
// lane calls (drawImage, clearRect, scale — read from the two source files
// directly; do not add methods speculatively).
const fakeCtx = {
  drawImage: vi.fn(),
  clearRect: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  imageSmoothingQuality: 'low',
} as unknown as CanvasRenderingContext2D;

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,fake');
```

### Pattern 4: Chat Wheel VPK round trip (D-05)

**What:** A real build-then-read round trip through the actual bundled `ChatLane.exe`, guarded on binary presence, in the existing `node` environment (no DOM needed — this is a main-process service test).
**When to use:** The one new test file covering `REQ-renderer-test-harness`'s Chat Wheel clause.
**Example:**
```typescript
// Source: function signatures read from electron/main/services/chatWheel.ts
// this session (lines 9-15, 39-49, 52-66).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { buildChatWheelVpk, readChatWheelVpk, chatLaneBinaryPath } from './chatWheel';

describe.skipIf(!(() => {
  try { chatLaneBinaryPath(); return false; } catch { return true; }
})())('Chat Wheel VPK round trip', () => {
  it('survives a build -> read round trip of the starter YAML', async () => {
    const starterPath = join(__dirname, '..', '..', '..', 'resources', 'chatlane', 'starter.yml');
    const yaml = readFileSync(starterPath, 'utf8');

    const built = await buildChatWheelVpk(yaml);
    try {
      const roundTripped = await readChatWheelVpk(built.vpkPath);
      expect(roundTripped.trim()).toBe(yaml.trim()); // ChatLane may reformat; compare content, verify exactly what survives before locking this assertion
    } finally {
      await built.cleanup();
    }
  });
});
```
Note: `describe.skipIf` needs the guard evaluated eagerly (not inside an `it`), matching D-06's "skips when the binary is absent" requirement. Confirm the exact YAML-equality behavior (ChatLane may reformat comments/ordering) by running this once locally before finalizing the assertion — this is exactly the kind of thing D-05 ("not a stub, not a golden fixture") wants surfaced rather than guessed at.

### Pattern 5: `engineDefault` threading (D-13)

**What:** The field must be added at all four points in the chain, not just `performanceUserControls.ts`.
**Where:**
1. `electron/main/services/performanceUserControls.ts:28-54` — add `engineDefault: string | null` to each `HUD_CONVARS` and `ADVANCED_GAMEINFO_CONVARS` entry, `as const` intact.
2. `electron/main/services/configKeyIndex.ts:15-32` (its own `ConfigKeyDefinition` interface) and the two `.map()` blocks at lines 46-67 that build `userDefinitions` — thread `engineDefault` through both the HUD and the advanced mapping.
3. `electron/main/services/performanceConfig.ts:1235-1279` `computeConvarStates` — read `control.engineDefault` (via `CONFIG_KEY_BY_NAME`) and copy it onto the returned object.
4. `src/types/electron.ts:139-155` `PerformanceConvarState` — add `engineDefault: string | null` beside `gameDefault: string | null` (verbatim quote of the existing field this session: `/** The engine's stock value, or null when Grimoire does not know it. */` / `gameDefault: string | null;`).

### Anti-Patterns to Avoid

- **Testing thumbnails/waveforms by asserting pixel content:** jsdom's canvas is a stub even with `canvas` installed for anything beyond basic 2D drawing; assert the *calls into* the canvas API (via the spy) and the resulting DOM/state (e.g. `onApply` was called with the expected `dataUrl` string from the stubbed `toDataURL`), not pixel-level correctness — that belongs to the human in-game sweep, not a render test.
- **Adding the `canvas` npm package "to be safe":** rejected above; keep the footprint to the one `jsdom` devDependency line CONTEXT.md's specifics section calls out as the only shared-file dependency edit this phase should make.
- **Sharing one giant `window.electronAPI` fixture across all six tests:** each lane touches a different slice of `window.electronAPI.foundry`; a shared fixture either grows to cover every lane's needs (defeating the point of a focused test) or under-covers a lane and masks what it actually depends on. Per-test-file stub objects match the existing "inline factory functions... no shared `fixtures/` directory" convention (`TESTING.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM environment for React render tests | A custom DOM shim | `jsdom` (pin `24.1.3`) | Already the working, precedented choice; nothing about these six lanes needs `happy-dom` or a real browser (Playwright etc.) — no lane in scope needs WebGL/Canvas pixel fidelity, only DOM structure and call-shape assertions |
| ConVar badge state derivation | A second badge-computation path for `engineDefault` | Extend `computeConvarStates` (`performanceConfig.ts:1235`), the single existing computation | `convarStates` is already the one place origin/state is derived; a parallel path would let the two disagree, which is exactly the "wrong number badges an untagged stock line" bug this requirement exists to fix |
| Verification record doc | A new structured format (JSON checklist, custom schema) | Markdown table, one row per check, mirroring `docs/rigged-preview-spike.md`'s "measured vs estimated vs unverifiable" table shape | D-07 already specifies this: "sitting beside `docs/rigged-preview-spike.md` as the same kind of artifact" |

**Key insight:** Nothing in this phase calls for a new library or a new abstraction. Every "don't hand-roll" risk here is really "don't build a second version of a mechanism that already exists in this codebase" (a second badge computation, a second render-harness shape, a second doc format), not "don't reinvent an open-source library."

## Common Pitfalls

### Pitfall 1: Canvas render tests silently pass by hitting the wrong branch
**What goes wrong:** A render test for `PortraitEditor` or `SoundImportEditor` clicks "Apply"/renders the waveform and asserts "no crash" or "some element exists" — and the test passes because `getContext('2d')` returned `null` and the component's error-fallback branch rendered, not because the crop/draw logic actually ran.
**Why it happens:** jsdom returns `null` from `getContext('2d')` without the `canvas` package, and both consumers already null-guard gracefully (see Pattern 3), so the failure mode is silent rather than a thrown error.
**How to avoid:** Stub `HTMLCanvasElement.prototype.getContext` (Pattern 3) before asserting the "Apply produces a dataUrl" or "waveform draws N bars" behavior; assert the stub's methods were actually called with the expected arguments, not just that the surrounding UI rendered.
**Warning signs:** A render test for either lane that never references `getContext`, `drawImage`, or `toDataURL` anywhere in the test file.

### Pitfall 2: `window.electronAPI` undefined crashes the render, or worse, is left partially stubbed
**What goes wrong:** A lane calls a `window.electronAPI.foundry.*` method the test's stub object does not define; the failure is `TypeError: window.electronAPI.foundry.someMethod is not a function`, often deep in a `useEffect` that Vitest reports as an unhandled rejection rather than a clean assertion failure.
**Why it happens:** `src/lib/api.ts` is a thin, un-typed-at-the-call-site pass-through (1600+ lines, no per-function stub generation), so it's easy to stub the two or three methods a component visibly calls and miss one buried in a `useEffect` (e.g. `AssetSourcesPanel`'s `inspect()` runs automatically on mount in `ChangePools.tsx`'s `PoolCard`, not only on a button click).
**How to avoid:** Read the full component (and, for `PoolCard`, its automatic `useEffect`-driven `inspect()` call) before writing the stub, not just the props/JSX; grep the component file for `foundry` before finalizing the stub object.
**Warning signs:** Console noise about unhandled promise rejections in test output even when assertions pass.

### Pitfall 3: `HTMLMediaElement.play()` doesn't throw, but doesn't play either
**What goes wrong:** A test for the audition/alternatives-gallery lane (`AlternativesGallery.tsx`'s `AuditionButton`, `AssetSourcesPanel.tsx`'s `audition()`) asserts on `playing` state after clicking a play button, but jsdom's `HTMLMediaElement.prototype.play` is a `notImplemented()` no-op that returns `undefined` (not a rejected Promise) [VERIFIED: node_modules/jsdom/lib/jsdom/living/nodes/HTMLMediaElement-impl.js:118-121, read this session] — so `await audio.play()` resolves immediately without ever "playing," and `audio.onended` never fires on its own.
**Why it happens:** jsdom does not implement real media playback; this is expected and does not need a workaround for the state-before-playback assertions, but any assertion that depends on `onended` firing needs the test to call it manually.
**How to avoid:** Assert the `playing`/`busy` state transitions the component itself drives synchronously (button becomes disabled during the async `foundryAuditionSourceClip` call, `Play` icon swaps to `Square`/`Pause`), and if an `onended` transition needs testing, invoke `audio.onended?.(new Event('ended'))` manually in the test rather than expecting jsdom to fire it.
**Warning signs:** A test with a comment like "wait for playback to end" and no explicit manual trigger of `onended`.

### Pitfall 4: Adding `jsdom` bumps the resolved version silently
**What goes wrong:** `pnpm add -D jsdom` with no version pin resolves to the registry's current latest (`30.0.1` as of this session, published only 8 days prior), not the `24.1.3` that's currently hoisted and that the one existing passing test (`HeroSelect.test.tsx`) has been running against. A major jsdom bump can change event-timing or API-availability behavior across all six new tests at once, with no prior signal that the bump is safe.
**Why it happens:** `pnpm add -D <pkg>` without an explicit version defaults to the latest satisfying a caret range on the current registry version.
**How to avoid:** Install with an explicit exact version — `pnpm add -D jsdom@24.1.3` — matching D-02's own framing ("the one passing render test works by accident of the lockfile"; pinning removes the accident without introducing a new one from an unreviewed major bump).
**Warning signs:** `package.json` shows `"jsdom": "^30.0.0"` (or similar) after the install command instead of `"24.1.3"`.

### Pitfall 5: The Chat Wheel round-trip assertion is written before checking what ChatLane actually preserves
**What goes wrong:** The round-trip test asserts byte-exact YAML equality (`expect(roundTripped).toBe(yaml)`), and it fails not because the round trip is broken but because ChatLane reformats comments, key ordering, or blank lines on write.
**Why it happens:** `starter.yml` has header comments (`resources/chatlane/starter.yml:1-2`, read this session) that a YAML round trip through a compiled binary has no obligation to preserve verbatim, only semantically.
**How to avoid:** Run the round trip once locally first (per D-05's "not a stub, not a golden fixture" spirit) and observe what actually comes back before locking the assertion; parse both YAML documents and compare structurally if ChatLane does not preserve formatting, rather than comparing raw strings.
**Warning signs:** A test that was clearly never run against the real binary before being committed (e.g., asserts on formatting details no one confirmed).

## Code Examples

See Patterns 1-5 above under Architecture Patterns — all five are the load-bearing code examples for this phase, sourced from files read directly this session rather than external docs (there is no external library whose docs are relevant here).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Zero DOM render coverage; all six Foundry lanes tested only at the pure-model level | jsdom-based render tests per lane, using the codebase's own `HeroSelect.test.tsx` precedent | This phase | Closes the "four waves landed with a green repository gate and zero in-game validation" gap named in `.planning/STATE.md`'s top blocker |
| `gameDefault: null` on all seven HUD toggles and one advanced ConVar (`citadel_hud_objective_health_enabled`) | `engineDefault` read off a running build, recorded beside `gameDefault` | This phase | An untagged stock line stops being mis-badged "Your override"; an unset toggle can preview what the game will actually do |
| Rigged hero preview gated off with only an arithmetic frame-cost estimate (`docs/rigged-preview-spike.md` section 6) | A real measured fps number on Seven, ship/gate/per-hero decision recorded and applied to `RELEASE_RENDER_FLAGS.rigged` | This phase | Turns an estimate into a verified release decision; the estimate said "should not move fps meaningfully" but explicitly could not be trusted alone |

**Deprecated/outdated:** None — this phase does not remove or replace any shipped mechanism; it adds tests and one data field to already-landed code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `readChatWheelVpk` output can be compared to the input YAML after `.trim()` alone (no deeper reformatting by ChatLane) | Pattern 4 / Pitfall 5 | If ChatLane reorders keys or rewrites comments, the naive assertion fails on a correct round trip; mitigated by explicitly flagging this as "confirm before finalizing" rather than presenting it as settled |
| A2 | A `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` stub returning a plain object satisfies both consumers' TypeScript types and runtime call patterns without further methods | Pattern 3 | If either component calls a canvas-context method not yet in the fake object (e.g. a font/style setter this research did not enumerate), the test throws `TypeError: ctx.someMethod is not a function`; low risk since both call sites were read in full this session, but a full method audit was not exhaustively cross-checked against every possible browser 2D context method |
| A3 | No lane calls a `window.electronAPI` method outside the `foundry` namespace during its render-test-relevant interaction path | Pattern 2 / Pitfall 2 | `AssetSourcesPanel.tsx` also calls `useAppStore((state) => state.toggleMod)` (a Zustand store action, not IPC directly) for the enable/disable button — this is a real store call, not a stub target, but a test exercising that button needs to consider whether the store itself needs isolation; not fully traced into `appStore.ts` this session |

## Open Questions

1. **Shared `window.electronAPI` stub helper vs. fully inline per test file**
   - What we know: CONTEXT.md leaves "whether the six render tests share a fixture module or keep the codebase's existing inline-factory convention" to Claude's discretion, and `TESTING.md` documents no shared `fixtures/` directory today.
   - What's unclear: `window.electronAPI` stubbing is a new pattern with no existing precedent either way, so there's no established convention to extend (unlike inline data factories, which do have one).
   - Recommendation: Default to inline per-file stubs (Pattern 2) to match the documented convention exactly; if the same three or four `foundry` methods turn out to repeat verbatim across three or more of the six test files, promote just that overlap to a tiny local helper — do not build a generic IPC-mocking utility up front.

2. **Exact ChatLane YAML round-trip fidelity**
   - What we know: `buildChatWheelVpk`/`readChatWheelVpk` signatures and the starter YAML's content (Pattern 4).
   - What's unclear: Whether ChatLane preserves comments/ordering byte-for-byte or only semantically; this was not run this session (would require actually invoking `ChatLane.exe`, which is an execution step better done by the plan's implementer than by research).
   - Recommendation: The plan should include a first sub-step of "run the round trip once, inspect the diff, then write the assertion to match what's actually preserved" rather than committing to byte-equality up front.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Windows OS | Chat Wheel round-trip test (D-06 runs it on Windows, skips on CI `ubuntu-latest`) | Yes [VERIFIED: `env.Platform: win32`, this session] | Windows 11 | — |
| `resources/chatlane/ChatLane.exe` | Chat Wheel round-trip test | Yes [VERIFIED: `ls resources/chatlane/`, this session — `ChatLane.exe`, `LICENSE`, `TinyEXR.Native.dll`, `libSkiaSharp.dll`, `starter.yml` all present] | bundled, tracked in git | Test guards on `chatLaneBinaryPath()` throwing and skips (D-06) |
| `node`/`pnpm` toolchain | All automated work | Yes [VERIFIED: `node --version` -> `v22.22.3`, `vitest/4.1.9 win32-x64 node-v22.22.3`, this session] | Node 22.22.3, Vitest 4.1.9 | — |
| Native `canvas` npm package | Real (non-stubbed) canvas drawing in jsdom | No [VERIFIED: `ls node_modules/canvas` -> not found, this session] | — | Stub `HTMLCanvasElement.prototype.getContext` per Pattern 3; deliberately not installing this package (see Alternatives Considered) |
| Running Deadlock build + GPU | REQ-ingame-verification-sweep, REQ-rigged-preview-release-gate (fps measurement) | Not available in this research/planning environment, and not expected to be — these are explicitly human-gated per CONTEXT.md D-09/D-10 | — | None needed: the deliverable here is a scaffolded, empty-verdict record doc, not an automated check |

**Missing dependencies with no fallback:** None — the one thing genuinely unautomatable (a running Deadlock build) is handled by design (human fills in the scaffold), not worked around.

**Missing dependencies with fallback:** `canvas` npm package — fallback is the `getContext` stub in Pattern 3, which is the recommended approach on its own merits, not a compromise.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 [VERIFIED: package.json:112, node_modules check this session] |
| Config file | `vitest.config.ts` (unmodified per D-03) |
| Quick run command | `pnpm exec vitest run <path-to-new-test-file>` |
| Full suite command | `pnpm test` (= `vitest run`, `package.json:32`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-ingame-verification-sweep | Human runs each scaffolded check against a real Deadlock build and fills in the verdict | manual-only (cannot be automated; no agent can run Deadlock) | n/a — deliverable is the scaffolded doc itself | ❌ Wave 0 (create the doc) |
| REQ-renderer-test-harness | Pool cards render + interact | render (jsdom) | `pnpm exec vitest run src/components/foundry/ChangePools.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Alternatives gallery render + audition button | render (jsdom) | `pnpm exec vitest run src/components/foundry/AlternativesGallery.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Audition preview (`AssetSourcesPanel`) matches inspection result | render (jsdom) | `pnpm exec vitest run src/components/foundry/AssetSourcesPanel.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Sound trim/gain badges render from `SoundTuningState` | render (jsdom) | `pnpm exec vitest run src/components/foundry/MySoundChanges.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Seeded `SoundImportEditor` opens on recorded trim/gain | render (jsdom) | `pnpm exec vitest run src/components/foundry/SoundImportEditor.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Portrait editor crop-and-apply | render (jsdom) | `pnpm exec vitest run src/components/foundry/PortraitEditor.test.tsx` | ❌ Wave 0 |
| REQ-renderer-test-harness | Chat Wheel `chat-wheel:read`/`chat-wheel:starter` VPK round trip | integration (node, real binary) | `pnpm exec vitest run electron/main/services/chatWheel.roundtrip.test.ts` | ❌ Wave 0 |
| REQ-rigged-preview-release-gate | Seven fps measurement on rigged vs static | manual-only | n/a — human runs `docs/rigged-preview-spike.md` §8 check 3 | n/a (spike doc exists; scaffold row references it) |
| REQ-performance-convar-safer-experimentation | `computeConvarStates` threads `engineDefault` through correctly given a fixture `HUD_CONVARS`/`ADVANCED_GAMEINFO_CONVARS` entry | unit (node, existing pattern) | `pnpm exec vitest run electron/main/services/performanceConfig.test.ts` (extend) | ✅ file exists, extend it |

### Sampling Rate
- **Per task commit:** run the specific new/changed test file(s) via `pnpm exec vitest run <file>`
- **Per wave merge:** `pnpm test` (full suite)
- **Phase gate:** Full suite green, plus every row in the scaffolded verification doc either filled with a verdict or explicitly `blocked` with a reason (D-10) — the automated gate alone is not sufficient to close this phase, by design.

### Wave 0 Gaps
- [ ] `package.json` — add `"jsdom": "24.1.3"` to `devDependencies`
- [ ] Six new `*.test.tsx` files under `src/components/foundry/` (see Recommended Project Structure)
- [ ] `electron/main/services/chatWheel.roundtrip.test.ts` — new file, existing `chatWheel.test.ts` untouched
- [ ] `docs/<verification-record>.md` — new fork-only doc, filename Claude's discretion, scaffolded with every row present and empty per D-09
- [ ] No shared fixture/helper module planned by default (see Open Question 1) — only add one if genuine duplication appears during implementation

## Security Domain

This phase adds no new input-parsing surface, no new IPC handler, no new network call, and no new file-write path. It adds test infrastructure (dev-only), one data field (`engineDefault`, populated by a human typing in console output, not by parsing untrusted input), and a written record doc. The existing ASVS-relevant surfaces this phase touches (VPK build/read for the Chat Wheel round trip, `gameinfo.gi` ConVar writing) already have their controls; this phase does not change them.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | Marginal | `buildChatWheelVpk` already rejects empty YAML (`chatWheel.ts:53`, `'Chat Wheel YAML cannot be empty.'` — quoted verbatim, read this session) and `readChatWheelVpk` already validates the `.vpk` extension and file existence (`chatWheel.ts:40`) before spawning `ChatLane.exe`; the new round-trip test exercises this existing validation, it does not add new validation |
| V6 Cryptography | No | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed VPK fed to `readChatWheelVpk` | Tampering | Already mitigated: extension + existence check before spawn, `ChatLane.exe` is invoked with `windowsHide: true` and its own exit-code handling (`chatWheel.ts:25-37`, read this session) — no change needed, the new test only exercises the happy path plus the existing empty-YAML guard |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/components/common/HeroSelect.test.tsx` — the render-test template
- `electron/main/services/chatWheel.ts`, `electron/main/services/chatWheel.test.ts` — Chat Wheel service and existing stubbed test
- `electron/main/services/performanceUserControls.ts`, `electron/main/services/configKeyIndex.ts`, `electron/main/services/performanceConfig.ts`, `src/types/electron.ts` — full `engineDefault` data-flow chain
- `docs/rigged-preview-spike.md` — full spike report, sections 0-10
- `src/components/locker/heroPoseRenderFeatures.ts`, `src/components/locker/HeroPoseViewer.tsx` (lines 100-130), `src/components/locker/HeroPoseViewer.test.ts` (lines 140-170) — `RELEASE_RENDER_FLAGS.rigged` and its existing decoupling test
- `src/components/foundry/ChangePools.tsx`, `AlternativesGallery.tsx`, `AssetSourcesPanel.tsx`, `MySoundChanges.tsx` (lines 280-350), `SoundImportEditor.tsx`, `PortraitEditor.tsx`, `src/components/locker/LockerImageCropper.tsx`, `src/components/foundry/poolView.ts`, `soundTuning.ts` — all six render-test lanes
- `src/lib/api.ts` — confirmed every lane's IPC surface bottoms out in `window.electronAPI`
- `node_modules/jsdom/lib/jsdom/living/nodes/HTMLCanvasElement-impl.js`, `HTMLMediaElement-impl.js`, `node_modules/jsdom/lib/jsdom/browser/not-implemented.js` — exact jsdom stub behavior for canvas and media
- `.planning/phases/01-verified-against-the-game/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/codebase/TESTING.md`, `package.json`, `vitest.config.ts`

### Secondary (MEDIUM confidence)
- `gsd-tools query package-legitimacy check` result for `jsdom` (npm registry data, `too-new` heuristic on latest release, explained above as a false positive for this package)

### Tertiary (LOW confidence)
- None used — this phase required no external web research; every claim traces to a file read in this repo this session or a tool invocation (`npm view`, `node -e`, `ls`) run this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — jsdom version and vitest version both confirmed by direct inspection, no external library research needed
- Architecture: HIGH — every integration point (electronAPI, canvas, media, ConVar chain) traced by reading the actual source files, with line numbers and verbatim quotes
- Pitfalls: HIGH — all five pitfalls are derived from jsdom's own implementation source and this repo's actual component code, not general knowledge about jsdom

**Research date:** 2026-08-06
**Valid until:** Stable for the life of this phase; re-check `jsdom` registry version if the `pnpm add -D jsdom@24.1.3` step is delayed more than ~30 days, in case a newer hoisted transitive version has since replaced `24.1.3` in the lockfile.
