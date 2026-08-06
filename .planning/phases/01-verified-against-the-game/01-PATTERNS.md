# Phase 1: Verified Against The Game - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 15
**Analogs found:** 12 / 15 (3 have no direct analog: the verification-record doc, the ConVar `engineDefault` field additions which extend existing structures rather than clone a sibling, and the `RELEASE_RENDER_FLAGS.rigged` value flip)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/foundry/ChangePools.test.tsx` | test (render) | request-response (IPC via `window.electronAPI`) | `src/components/common/HeroSelect.test.tsx` | exact (shape) |
| `src/components/foundry/AlternativesGallery.test.tsx` | test (render) | request-response + media playback | `src/components/common/HeroSelect.test.tsx` | exact (shape) |
| `src/components/foundry/AssetSourcesPanel.test.tsx` | test (render) | request-response (IPC) + media playback | `src/components/common/HeroSelect.test.tsx` | exact (shape) |
| `src/components/foundry/MySoundChanges.test.tsx` | test (render) | transform (pure state -> badges) | `src/components/common/HeroSelect.test.tsx` | exact (shape) |
| `src/components/foundry/SoundImportEditor.test.tsx` | test (render) | request-response + canvas draw | `src/components/common/HeroSelect.test.tsx` | exact (shape), needs canvas stub |
| `src/components/foundry/PortraitEditor.test.tsx` | test (render) | request-response + canvas draw | `src/components/common/HeroSelect.test.tsx` | exact (shape), needs canvas stub |
| `electron/main/services/chatWheel.roundtrip.test.ts` | test (integration, main process) | file-I/O (spawn + VPK build/read) | `electron/main/services/chatWheel.test.ts` (existing, stubbed) + `electron/main/services/chatWheel.ts` (real functions under test) | role-match (deliberately un-stubbed sibling) |
| `docs/<verification-record>.md` | doc / scaffold | manual (human-filled record) | `docs/rigged-preview-spike.md` | exact (shape: measured/estimated/unverifiable table) |
| `package.json` | config | n/a | existing `devDependencies` block | exact |
| `electron/main/services/performanceUserControls.ts` (modify) | config/data | CRUD (data catalogue) | itself (existing `HUD_CONVARS`/`ADVANCED_GAMEINFO_CONVARS`) | exact (add a field to each entry) |
| `electron/main/services/configKeyIndex.ts` (modify) | service (data join) | transform | itself (existing `ConfigKeyDefinition` + `userDefinitions` map blocks) | exact |
| `electron/main/services/performanceConfig.ts` (modify `computeConvarStates`) | service | transform | itself (existing function, lines 1235-1279) | exact |
| `src/types/electron.ts` (modify `PerformanceConvarState`) | model (type) | n/a | itself (existing interface, lines 139-155) | exact |
| `src/components/settings/sections/GameConvarsSection.tsx` (modify `ValueStateBadge`) | component | request-response (renders convarStates) | itself (existing badge logic, lines ~89-103, 476-618) | exact |
| `src/components/locker/HeroPoseViewer.tsx` (modify `RELEASE_RENDER_FLAGS.rigged`) | config (module constant) | n/a | itself (line 119) | exact (one-value flip, no code pattern to copy) |

## Pattern Assignments

### `src/components/foundry/ChangePools.test.tsx` / `AlternativesGallery.test.tsx` / `AssetSourcesPanel.test.tsx` / `MySoundChanges.test.tsx` / `SoundImportEditor.test.tsx` / `PortraitEditor.test.tsx` (test, render)

**Analog:** `src/components/common/HeroSelect.test.tsx` (full file read this session)

**Pragma + setup pattern** (lines 1-9):
```typescript
// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
```

**Root lifecycle pattern** (lines 68-86):
```typescript
describe('...', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    // HeroSelect additionally stubs requestAnimationFrame here when the
    // component under test schedules a rAF (portal positioning etc.) —
    // do the same if a lane needs it, omit if it does not.
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
```

**Interaction pattern** (lines 88-131, 180-207): drive the real DOM — `querySelector`, dispatch real `MouseEvent`/`KeyboardEvent`/`input` events wrapped in `act()`, assert on `textContent`/attribute state after the interaction, not just presence. This is what D-04 means by "interaction-depth, not mount-without-throwing."

**No existing precedent — new pattern needed for these six files:** `window.electronAPI` stub. None of `HeroSelect.test.tsx`'s dependencies reach IPC, so this pattern is not in the analog; it must be added fresh per RESEARCH.md Pattern 2. Every lane bottoms out through `src/lib/api.ts`, confirmed here:

```typescript
// src/lib/api.ts:1580-1594 — thin pass-through shape all `foundry.*` helpers share
export async function foundryInspectAssetSources(
  paths: string[]
): Promise<import('../types/foundry').FoundryAssetSourcesInspection> {
  return window.electronAPI.foundry.inspectAssetSources(paths);
}

export async function foundryAuditionSourceClip(
  modId: string,
  entryPath: string
): Promise<string | null> {
  return window.electronAPI.foundry.auditionSourceClip(modId, entryPath);
}
```

Stub shape (no existing file to copy; construct per RESEARCH.md Pattern 2):
```typescript
beforeEach(() => {
  (globalThis as any).window.electronAPI = {
    foundry: {
      inspectAssetSources: vi.fn().mockResolvedValue({ sources: [], winners: {}, unreadableMods: [] }),
      auditionSourceClip: vi.fn().mockResolvedValue('blob:fake-clip-url'),
      // add only the methods the specific lane under test actually calls —
      // read the full component (including useEffect-driven calls) first
    },
  };
});
```

**AssetSourcesPanel.tsx import block** (lines 1-27) — shows the project's IPC-call import convention to mirror when writing the stub:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { foundryInspectAssetSources } from '../../lib/api';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';
import type { FoundryChangeEntry } from './changeList';
import type { Mod } from '../../types/mod';
```

---

### `src/components/foundry/SoundImportEditor.test.tsx` and `PortraitEditor.test.tsx` — canvas stub addendum

**No existing analog** (no test file in the repo stubs canvas today). Both consuming components already null-guard, confirmed by reading the call sites this session:

`src/components/locker/LockerImageCropper.tsx:323,329-330` (`PortraitEditor`'s crop-apply path):
```typescript
const ctx = canvas.getContext('2d');
// ... null-guard omitted above, present in source ...
ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
onApply({ dataUrl: canvas.toDataURL('image/png'), hideHeroName, source: imageDataUrl, crop });
```

`src/components/foundry/SoundImportEditor.tsx:346,348-349` (waveform draw):
```typescript
const g = canvas.getContext('2d');
g.scale(dpr, dpr);
g.clearRect(0, 0, w, h);
```

Stub (construct per RESEARCH.md Pattern 3 — only the methods actually called above):
```typescript
const fakeCtx = {
  drawImage: vi.fn(),
  clearRect: vi.fn(),
  scale: vi.fn(),
} as unknown as CanvasRenderingContext2D;

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,fake');
```
Assert against the fake's calls (`fakeCtx.drawImage`, `.toDataURL`), not against "no crash" — a null-guarded fallback branch passing "no crash" is the exact silent-pass failure mode Pitfall 1 names.

---

### `electron/main/services/chatWheel.roundtrip.test.ts` (test, integration)

**Analog:** `electron/main/services/chatWheel.ts` (full file read this session — the functions under test) and `electron/main/services/chatWheel.test.ts` (existing sibling test file, stays untouched per D-05)

**Functions under test** (`chatWheel.ts:9-15, 39-66`):
```typescript
export function chatLaneBinaryPath(): string {
    const executable = process.platform === 'win32' ? 'ChatLane.exe' : 'ChatLane';
    const root = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
    const binary = join(root, 'chatlane', executable);
    if (!existsSync(binary)) throw new Error(`Chat Wheel converter is unavailable: ${binary}`);
    return binary;
}

export async function readChatWheelVpk(vpkPath: string): Promise<string> {
    if (!vpkPath.toLowerCase().endsWith('.vpk') || !existsSync(vpkPath)) throw new Error('Select an existing .vpk file.');
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-chatwheel-'));
    const output = join(dir, 'chatlane.yml');
    try {
        await runChatLane(vpkPath, output);
        return await fs.readFile(output, 'utf8');
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

/** Validates and converts YAML to a staging VPK. Caller owns install/replacement. */
export async function buildChatWheelVpk(yaml: string): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    if (!yaml.trim()) throw new Error('Chat Wheel YAML cannot be empty.');
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-chatwheel-'));
    const input = join(dir, 'chatlane.yml');
    const output = join(dir, 'chatlane_dir.vpk');
    try {
        await fs.writeFile(input, yaml, 'utf8');
        await runChatLane(input, output);
        if (!existsSync(output)) throw new Error('ChatLane completed without producing a VPK.');
        return { vpkPath: output, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
    } catch (err) {
        await fs.rm(dir, { recursive: true, force: true });
        throw err;
    }
}
```

**Test skeleton** (new file — RESEARCH.md Pattern 4, node environment, no jsdom pragma needed):
```typescript
import { readFileSync } from 'fs';
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
      // Run once locally first and inspect actual output before locking this
      // assertion — ChatLane may reformat (Pitfall 5 / D-05).
      expect(roundTripped.trim()).toBe(yaml.trim());
    } finally {
      await built.cleanup();
    }
  });
});
```
`describe.skipIf` must evaluate the guard eagerly (matches D-06's skip-on-CI, run-on-Windows-dev requirement).

**Do not touch:** `electron/main/services/chatWheel.test.ts` stays exactly as-is (stubs the child process via `child.emit('close', 0)`); this is a new, separate file.

---

### `docs/<verification-record>.md` (doc, manual)

**Analog:** `docs/rigged-preview-spike.md` (referenced per D-07; not re-read in full here — its shape is already summarized in CONTEXT.md/RESEARCH.md as "separates measured from estimated from unverifiable")

**Pattern to copy:** One markdown table, one row per check. Per D-09, every row must ship pre-filled with: exact steps, the mod/hero/fixture to use, what a pass looks like, and a verdict column left blank for the human to fill. Per D-10, `blocked` + a stated reason is an acceptable verdict. Filename and exact row schema are Claude's discretion (CONTEXT.md); pick something that reads naturally beside `rigged-preview-spike.md`, e.g. `docs/phase1-verification-record.md`.

Rows should cover, at minimum, every check in REQ-ingame-verification-sweep (VPK forge-and-mount, cancel-dialog no-op, forge-install rollback, merged-VPK winner, `AssetSourcesPanel` audition parity, hero/voice/global sound across four fixture types, `minimap`/`small` portrait `VARIANT_LABEL`s) plus the Seven fps measurement from REQ-rigged-preview-release-gate (referencing `docs/rigged-preview-spike.md` §8 rather than duplicating its steps).

---

### `electron/main/services/performanceUserControls.ts` (modify — add `engineDefault`)

**Analog:** itself — extend the existing literal arrays in place, `as const` intact.

**Current shape** (lines 28-54, full file read this session):
```typescript
export const HUD_CONVARS = [
    { key: 'citadel_unit_status_use_new', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_damage_offscreen_indicator_disabled', on: 'false', off: 'true', gameDefault: null },
    { key: 'citadel_damage_text_show_effectiveness', on: '1', off: '0', gameDefault: null },
    // ... 4 more entries, all gameDefault: null
] as const;

export const ADVANCED_GAMEINFO_CONVARS = [
    { key: 'citadel_hud_objective_health_enabled', min: 0, max: 2, step: 1, gameDefault: null },
    { key: 'citadel_unit_status_allies_see_thru_walls_max_distance', min: 0, max: 200, step: 5, gameDefault: 40 },
    // ... 6 more entries with numeric gameDefault
] as const;
```
Add `engineDefault: string | null` (or the literal reading, once known) beside every `gameDefault` field on every entry in both arrays. Per D-14, `citadel_damage_offscreen_indicator_disabled` is checked first and recorded as the raw console value with a comment stating the on/off inversion (`on: 'false', off: 'true'` already encodes that this key is inverted — the reading must be checked against that existing mapping, not normalized away). Per D-15, the `citadel_hud_objective_health_enabled` "unsupported" comment gets corrected based on what the reading shows.

---

### `electron/main/services/configKeyIndex.ts` (modify — thread `engineDefault`)

**Analog:** itself — the `ConfigKeyDefinition` interface and the two `.map()` blocks building `userDefinitions` (lines 15-32, 45-67, full range read this session).

**Interface to extend** (lines 15-32):
```typescript
export interface ConfigKeyDefinition {
    key: string;
    file: 'gameinfo.gi';
    type: ConfigKeyType;
    allowedValues?: readonly string[];
    min?: number;
    max?: number;
    step?: number;
    label: string;
    description: string;
    surfaces: readonly ConfigKeySurface[];
    gameDefault: string | null;
    // add: engineDefault: string | null;
}
```

**Map blocks to extend** (lines 45-67):
```typescript
const userDefinitions: ConfigKeyDefinition[] = [
    ...HUD_CONVARS.map((control) => ({
        key: control.key,
        file: 'gameinfo.gi' as const,
        type: 'boolean' as const,
        allowedValues: [control.on, control.off],
        label: humanize(control.key),
        description: 'A Game Configuration HUD control.',
        surfaces: ['game-configuration'] as const,
        gameDefault: control.gameDefault === null ? null : String(control.gameDefault),
        // add: engineDefault: control.engineDefault === null ? null : String(control.engineDefault),
    })),
    ...ADVANCED_GAMEINFO_CONVARS.map((control) => ({
        // same pattern — gameDefault line has a direct sibling to duplicate for engineDefault
    })),
];
```

---

### `electron/main/services/performanceConfig.ts` (modify `computeConvarStates`)

**Analog:** itself, lines 1235-1279 (full range read this session).

**Exact insertion points:**
```typescript
const gameDefault = control.gameDefault;
// add: const engineDefault = control.engineDefault;
...
output[key] = {
    origin,
    value,
    presetValue,
    gameDefault,
    // add: engineDefault,
    resolvedValue: autoexec?.value ?? value ?? gameDefault,
    resolvedFrom: autoexec ? 'autoexec.cfg' : value === null ? 'game-default' : 'gameinfo.gi',
    ...(autoexec ? { autoexec } : {}),
    ...(outOfRange ? { outOfRange: true } : {}),
};
```
D-16 constrains this to data threading only — `origin`/`resolvedValue`/`resolvedFrom` computation logic is unchanged; `engineDefault` is carried through, not consumed, by this function.

---

### `src/types/electron.ts` (modify `PerformanceConvarState`)

**Analog:** itself, lines 139-155 (full range read this session).

```typescript
export interface PerformanceConvarState {
    origin: PerformanceConvarOrigin;
    value: string | null;
    presetValue: string | null;
    /** The engine's stock value, or null when Grimoire does not know it. */
    gameDefault: string | null;
    // add, matching the comment convention of the sibling field:
    // /** The console-reported engine default, or null when unread. */
    // engineDefault: string | null;
    resolvedValue: string | null;
    resolvedFrom: 'game-default' | 'gameinfo.gi' | 'autoexec.cfg';
    autoexec?: AutoexecConvarConflict;
    outOfRange?: boolean;
}
```
Note `ConfigKeyDefinition` is separately declared again at lines 159-171 in this same file (mirrors `configKeyIndex.ts`'s own copy) — add `engineDefault: string | null;` there too, same file, same pattern.

---

### `src/components/settings/sections/GameConvarsSection.tsx` (modify — badge consumer, D-16)

**Analog:** itself. `ValueStateBadge` (line 103) and its call sites (lines 476, 518, 617) currently read `state.gameDefault` (confirmed via grep this session: comment at line 63 — `status.convarStates[key].gameDefault: a renderer-side default number gets ...`; origin-label map at line 89 — `'game-default': 'gameDefault'`). Extend `ValueStateBadge`'s logic to also branch on `state.engineDefault` per D-16 ("an untagged stock line stops being badged 'Your override', and an unset toggle can show what the game will do"). This phase's only UI change — no new control, no reset-to-engine-default action (deferred).

---

### `src/components/locker/HeroPoseViewer.tsx` (modify — `RELEASE_RENDER_FLAGS.rigged`)

**Analog:** itself, line 119 (full block read this session, lines 108-127).

```typescript
const RELEASE_RENDER_FLAGS = {
  unified: USE_UNIFIED_MATERIAL,
  celV2: USE_CEL_V2,
  cloth: USE_CLOTH,
  // Rigged is its own switch so the animated path can be measured without the
  // WIP cloth sim riding along. Off in released builds, like cloth.
  rigged: false,   // <- flips to true/stays false per the human fps measurement (D-17)
  bloom: USE_BLOOM,
  nprDebug: false,
  matDebug: false,
};
```
This is a one-line value change plus updating the adjacent comment to state the measured recommendation, not a code-pattern copy. `heroPoseRenderFeatures.ts:55` already decouples `rigged` from `cloth`, and `HeroPoseViewer.test.ts:162` already asserts that decoupling — no new test is required for the flag flip itself, only for whatever the fps sweep records in the doc.

---

## Shared Patterns

### Render-test harness (jsdom + createRoot + act)
**Source:** `src/components/common/HeroSelect.test.tsx` (whole file)
**Apply to:** All six `*.test.tsx` files under `src/components/foundry/`
```typescript
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
```
No testing-library, no `vi.mock()` of project modules (per `TESTING.md`, confirmed only Node/Electron built-ins are ever `vi.mock`'d, e.g. in `chatWheel.test.ts`).

### `window.electronAPI` IPC stub (new pattern, no existing precedent)
**Source:** constructed from `src/lib/api.ts:1580-1594` (the pass-through shape) — no test file does this yet.
**Apply to:** All six render-lane tests; each gets its own minimal stub object covering only the `foundry.*` methods that specific lane calls, including any automatic `useEffect`-driven calls (Pitfall 2).

### Canvas context stub (new pattern, no existing precedent)
**Source:** call sites read directly — `src/components/locker/LockerImageCropper.tsx:323-330`, `src/components/foundry/SoundImportEditor.tsx:346-349`.
**Apply to:** `SoundImportEditor.test.tsx`, `PortraitEditor.test.tsx` only (the two lanes that draw to canvas).
```typescript
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,fake');
```
Do not install the native `canvas` npm package (explicit non-goal, see RESEARCH.md Alternatives Considered).

### `gameDefault`/`engineDefault` sibling-field threading
**Source:** `electron/main/services/performanceUserControls.ts` -> `configKeyIndex.ts` -> `performanceConfig.ts` -> `src/types/electron.ts` (four files, all read this session; exact line numbers above)
**Apply to:** All four ConVar-chain files. Every insertion point has a `gameDefault` line immediately adjacent to duplicate for `engineDefault` — there is no case in this chain where the new field needs new logic, only a new line beside an existing one, except in `GameConvarsSection.tsx` where D-16 asks for an actual badge-logic branch.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `docs/<verification-record>.md` | doc | manual | Not a code file; shape is modeled on `docs/rigged-preview-spike.md` per D-07, which is close enough to count as a match, but there's no second doc of this exact schema to compare against, so treat the spike doc's table shape as the sole reference, not a hard template |
| `window.electronAPI` stub construction (cross-cutting, not a single file) | test fixture | request-response | RESEARCH.md's own Open Question 1: genuinely new ground, no existing test in the repo stubs this global; the stub in Pattern Assignments above is synthesized from `src/lib/api.ts` call shapes, not copied from a prior test |
| Canvas context stub construction (cross-cutting) | test fixture | transform | Same as above — no existing file stubs `HTMLCanvasElement.prototype.getContext` anywhere in the repo |

## Metadata

**Analog search scope:** `src/components/common/`, `src/components/foundry/`, `src/components/locker/`, `src/components/settings/sections/`, `electron/main/services/`, `src/lib/`, `src/types/`, `docs/`
**Files scanned:** ~14 read/grepped directly this session (HeroSelect.test.tsx, performanceUserControls.ts, chatWheel.ts, configKeyIndex.ts, performanceConfig.ts, electron.ts, GameConvarsSection.tsx, HeroPoseViewer.tsx, ChangePools.tsx, LockerImageCropper.tsx, SoundImportEditor.tsx, AssetSourcesPanel.tsx, api.ts, plus directory listing of `src/components/foundry/`)
**Pattern extraction date:** 2026-08-06
