# Phase 3: Foundry Completes Its Build Contract - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 13 (new + modified)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/foundry.ts` (widen `FoundryForgeEdit`, add `RecolorRequest`-ish type) | model/type | transform | `TextureReplacementRequest` + `HeroSoundSwapRequest` in same file | exact |
| `electron/main/services/foundryRecolor.ts` (NEW builder) | service | file-I/O | `electron/main/services/foundryTextureReplace.ts` (`buildTextureReplacementVpk`) | exact |
| `electron/main/services/foundryForge.ts` (`reviewFoundryForge`, `describeFoundryBuild`, `buildFoundryForgeVpk` — add `'recolor'` branch) | service | batch/transform | itself (existing `sound`/`texture` branches) | exact — modify in place |
| `electron/main/ipc/foundry.ts` (new staging-time IPC, e.g. `foundry:prepareRecolorStage`) | route (IPC handler) | request-response | existing `foundry:exportHeroEffect` handler (same file, ~line 375-420) | exact |
| `src/components/foundry/recolorStagedEdit.ts` (NEW) | utility/model | transform | `src/components/foundry/soundStagedEdit.ts` (`serializeSoundStagedEdit`) and `visualEdits.ts` (`prepareVisualStagedEdit`, async variant) | exact |
| `src/components/foundry/buildTray.ts` (add `isStagedRecolorEdit`, extend `unsupportedStagedEditKind`/`toForgeRequest`) | utility | transform | itself (`isStagedSoundEdit`/`isStagedVisualEdit`) | exact — modify in place |
| `src/components/foundry/changeList.ts` (widen `FoundryChangeKind`) | utility | transform | itself | exact — modify in place |
| `src/types/mod.ts` (widen `FoundryBuildPart.kind`) | model | transform | itself | exact — modify in place |
| `src/components/locker/HeroColorPicker.tsx` (`handleApply`, Abilities/hue-prism-gradient branches only) | component | event-driven | `TrippySkinPanel.tsx`'s own `handleApply` (sibling, stays immediate — do NOT copy its pattern for the staged branches) | role-match (contrast case, not a copy source) |
| `src/components/foundry/RecolorTool.tsx` | component | request-response | `src/components/foundry/TextureBrowse.tsx` / `SoundBrowse.tsx` (mount tray-aware staging into a Locker-borrowed panel) | role-match |
| `src/components/foundry/ShuffleToggleButton.tsx` (NEW, extracted) | component | event-driven | inline button in `src/components/locker/HeroSkinsPanel.tsx` (~lines 646-672 and ~846-872) | exact (extraction source) |
| `src/components/locker/HeroSkinsPanel.tsx` (use extracted button) | component | event-driven | itself, pre-extraction | exact — modify in place |
| `src/components/foundry/HeroWorkshop.tsx` (+ shuffle toggle row + Locker link) | component | event-driven | `src/components/foundry/MyChanges.tsx` (navigate-to-Locker call site) + `HeroSkinsPanel.tsx` (toggle wiring) | exact |
| `src/components/foundry/SoundBrowse.tsx` (+ shuffle toggle row + Locker link) | component | event-driven | same as `HeroWorkshop.tsx` above | exact |

## Pattern Assignments

### `src/types/foundry.ts` (widen `FoundryForgeEdit`)

**Analog:** same file, `TextureReplacementRequest` (lines 387-399) and the union itself (lines 401-405)

**Existing union to extend** (lines 401-405):
```typescript
/** A deferred Foundry edit. It contains the authoring input, not a generated
 * VPK, so reviewing or cancelling a tray never changes the mod library. */
export type FoundryForgeEdit =
    | { id: string; kind: 'sound'; precedence: number; request: HeroSoundSwapRequest }
    | { id: string; kind: 'texture'; precedence: number; request: TextureReplacementRequest };
```
Add a third member: `| { id: string; kind: 'recolor'; precedence: number; request: RecolorForgeRequest }`.

**Field-naming precedent to follow** (`TextureReplacementRequest`, lines 387-399):
```typescript
export interface TextureReplacementRequest {
    entryPath: string;
    imagePath: string;
    name: string;
    category: TextureCategory;
    heroName?: string;
    thumbnailDataUrl?: string;
}
```

**Existing request type to build the recolor request from** (`HeroEffectExportRequest`, lines 194-203 — per research, the recolor request should be this type plus a discovered `entries: string[]`, not a hand-rolled `{hue,saturation,brightness}` shape):
```typescript
export interface HeroEffectExportRequest {
    heroName: string;
    mode: 'hue' | 'prism' | 'gradient' | 'trippy';
    hue: number;
    saturation: number;
    brightness: number;
    animated?: boolean;
    gradient?: string | null;
    trippy?: import('./mod').TrippyVfxChoice;
}
```
Recommended shape: `interface RecolorForgeRequest extends HeroEffectExportRequest { entries: string[]; thumbnailDataUrl?: string }`.

---

### `electron/main/services/foundryRecolor.ts` (NEW builder)

**Analog:** `electron/main/services/foundryTextureReplace.ts` (builder shape: `{ vpkPath, cleanup }`), but the body delegates to `buildHeroEffectVpkForExport`.

**The function to wrap** (`electron/main/services/heroColors.ts:560-604`, verbatim):
```typescript
export async function buildHeroEffectVpkForExport(
    deadlockPath: string,
    req: HeroEffectExportRequest
): Promise<{ vpkPath: string; suggestedName: string }> {
    vpkmergeBinaryPath();
    const codename = colorCodenameForHero(req.heroName);
    if (!codename) {
        throw new Error(`Ability color recolor isn't available for ${req.heroName} yet.`);
    }
    const pak01 = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
    if (!existsSync(pak01)) {
        throw new Error('Base game pak01_dir.vpk not found; check the Deadlock path in Settings.');
    }
    let vpkPath: string;
    let tag: string;
    if (req.mode === 'trippy') {
        const choice = normalizeTrippyVfxChoice(req.trippy ?? {});
        vpkPath = await ensureHeroTrippyVfxBake(pak01, codename, choice);
        tag = `trippy_${choice.style}`;
    } else if (req.mode === 'prism' || req.mode === 'gradient') {
        const grad = req.gradient && req.gradient.trim() ? req.gradient.trim() : null;
        vpkPath = await ensureHeroPrismBake(pak01, codename, normalizeHue(req.hue), normalizeSaturation(req.saturation), normalizeBrightness(req.brightness), req.animated ?? false, grad);
        tag = grad ? 'gradient' : req.animated ? 'prism_animated' : 'prism';
    } else {
        vpkPath = await ensureHeroColorBake(pak01, codename, normalizeHue(req.hue), normalizeSaturation(req.saturation), normalizeBrightness(req.brightness));
        tag = `hue${normalizeHue(req.hue)}`;
    }
    return { vpkPath, suggestedName: `${codename}_${tag}_dir.vpk` };
}
```

**Required wrapper shape (per research Pattern 2 — cleanup MUST be a no-op, not a delete):**
```typescript
// electron/main/services/foundryRecolor.ts — pattern, not verbatim
import { buildHeroEffectVpkForExport } from './heroColors';
import { parseVpkDirectory } from './vpk';
import type { RecolorForgeRequest } from '../../../src/types/foundry';

export async function buildRecolorVpk(
    deadlockPath: string,
    req: RecolorForgeRequest,
): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    const { vpkPath } = await buildHeroEffectVpkForExport(deadlockPath, req);
    // NEVER delete: vpkPath is userData/ability-colors/<cache>, shared with the
    // Locker's own Apply/Export buttons (see foundryForge.ts's sound/texture
    // builders for the DELETE pattern this must NOT copy).
    return { vpkPath, cleanup: async () => {} };
}

// Staging-time entry discovery (separate export, called from IPC):
export async function discoverRecolorEntries(deadlockPath: string, req: RecolorForgeRequest): Promise<string[]> {
    const { vpkPath } = await buildHeroEffectVpkForExport(deadlockPath, req);
    const entries = parseVpkDirectory(vpkPath);
    if (!entries) throw new Error('Could not read the recolor bake output.');
    return entries;
}
```

---

### `electron/main/services/foundryForge.ts` (add `'recolor'` branch — the alignment trap)

**Analog:** itself. Read in full this session (lines 1-140 shown; `reviewFoundryForge` 15-34, `describeFoundryBuild` 48-74, `buildFoundryForgeVpk` 86-127).

**`reviewFoundryForge`'s sound/texture branch to extend** (lines 15-24):
```typescript
export function reviewFoundryForge(edits: readonly FoundryForgeEdit[]) {
    const writers = new Map<string, Array<{ id: string; precedence: number; index: number }>>();
    edits.forEach((edit, index) => {
        const entries = edit.kind === 'sound'
            ? (edit.request.assignments ?? []).map(({ clipPath }) => soundEntry(clipPath))
            : [normalize(edit.request.entryPath)];
        // Recolor branch adds: `: edit.kind === 'recolor' ? edit.request.entries.map(normalize) : [...]`
        // reviewFoundryForge MUST stay synchronous (per research Pitfall 5) — entries
        // are already on edit.request.entries by the time this runs, never rebaked here.
        for (const entry of new Set(entries.filter(Boolean))) { /* unchanged */ }
    });
    /* ... */
}
```

**`describeFoundryBuild`'s if/return-object branch to extend** (lines 52-72):
```typescript
const parts: FoundryBuildPart[] = request.edits.map((edit) => {
    if (edit.kind === 'sound') { /* ... existing ... */ }
    // MISSING today: falls through to a bare `return { kind: 'texture', ... }` for
    // anything not 'sound'. This must become an explicit if/else-if/else-if chain
    // with a 'recolor' branch producing { kind: 'recolor', entries: edit.request.entries, heroName, ... }
    return { kind: 'texture', /* ... */ };
});
```

**THE alignment trap — `buildFoundryForgeVpk`'s `built[]` loop (lines 94-104, verbatim, the exact fix location):**
```typescript
const built: Array<{ path: string; cleanup: () => Promise<void> }> = [];
try {
    for (const edit of request.edits) {
        if (edit.kind === 'sound') {
            const part = await buildHeroSoundSwapVpk(deadlockPath, { ...edit.request, loop: edit.request.loop ?? 'auto' });
            built.push({ path: part.vpkPath, cleanup: () => cleanupHeroSoundSwapBuild(part.vpkPath) });
        } else if (edit.kind === 'texture') {
            const part = await buildTextureReplacementVpk(deadlockPath, edit.request.entryPath, edit.request.imagePath);
            built.push({ path: part.vpkPath, cleanup: () => cleanupTextureReplacementBuild(part.vpkPath) });
        }
        // FIX: add `else if (edit.kind === 'recolor') { const part = await buildRecolorVpk(deadlockPath, edit.request);
        //   built.push({ path: part.vpkPath, cleanup: part.cleanup }); }`
        // Every branch MUST push exactly one entry or built[index] desyncs against
        // request.edits[index] at line 107 with no throw — silent misalignment.
    }
    const ordered = request.edits.map((edit, index) => ({ edit, index, path: built[index].path }))
        .sort((a, b) => a.edit.precedence - b.edit.precedence || a.index - b.index);
    /* ... */
}
```

**Import to add at top of file** (alongside existing lines 7-8):
```typescript
import { buildRecolorVpk } from './foundryRecolor'; // new
```

---

### `src/components/foundry/recolorStagedEdit.ts` (NEW)

**Analog A — sync serializer shape** (`soundStagedEdit.ts`, full file, sync pattern — NOT sufficient alone for recolor per research Pitfall 2, but the output-shape precedent):
```typescript
export interface FoundryStagedSoundEdit extends FoundryStagedEdit {
  kind: 'sound';
  request: HeroSoundSwapRequest;
}
export function serializeSoundStagedEdit(input: SoundStagedEditInput): FoundryStagedSoundEdit {
  /* validates id/title/assignments, then returns { id, kind: 'sound', title, precedence, affectedFiles, request } */
}
```

**Analog B — async staging with main-process pre-check (the pattern recolor MUST follow, `visualEdits.ts:65-80`, verbatim):**
```typescript
export async function prepareVisualStagedEdit(context: VisualStageContext): Promise<VisualStagedEdit | null> {
  const sources = await context.inspect(visualAssetInspectionPaths(context.item, context.catalog));
  if (sources.unreadableMods.length > 0) throw new Error(context.unreadableMessage);
  const enabled = sources.sources.filter((source) => source.enabled);
  if (enabled.length > 0 && !(await context.confirm(enabled.map((source) => source.modName)))) return null;
  return serializeVisualReplacement({ /* ... */ });
}
```

**Recommended shape for `prepareRecolorStagedEdit`:**
```typescript
// pattern only
export interface RecolorStagedEdit extends FoundryStagedEdit {
  kind: 'recolor';
  request: RecolorForgeRequest; // includes .entries
}

export interface RecolorStageContext {
  heroName: string;
  request: HeroEffectExportRequest;
  discoverEntries: (req: HeroEffectExportRequest) => Promise<string[]>; // IPC call to main
  inspect: (paths: string[]) => Promise<FoundryAssetSourcesInspection>; // reuse visualEdits.ts's contract
  confirm: (modNames: string[]) => boolean | Promise<boolean>;
  unreadableMessage: string;
}

export async function prepareRecolorStagedEdit(ctx: RecolorStageContext): Promise<RecolorStagedEdit | null> {
  const entries = await ctx.discoverEntries(ctx.request);
  const sources = await ctx.inspect(entries);
  if (sources.unreadableMods.length > 0) throw new Error(ctx.unreadableMessage);
  const enabled = sources.sources.filter((s) => s.enabled);
  if (enabled.length > 0 && !(await ctx.confirm(enabled.map((s) => s.modName)))) return null;
  return {
    id: `recolor:${ctx.heroName}:${ctx.request.mode}`,
    kind: 'recolor',
    title: `${ctx.heroName} recolor`,
    affectedFiles: entries,
    precedence: 0,
    request: { ...ctx.request, entries },
  };
}
```

---

### `src/components/foundry/buildTray.ts` (add `isStagedRecolorEdit`)

**Analog:** itself — the two existing guards (lines 103-115) and `toForgeRequest` (lines 155-171):
```typescript
export function isStagedSoundEdit(edit: FoundryStagedEdit): edit is FoundryStagedSoundEdit {
  return edit.kind === 'sound' && 'request' in edit;
}
export function isStagedVisualEdit(edit: FoundryStagedEdit): edit is VisualStagedEdit {
  return edit.kind === 'texture' && 'source' in edit;
}
export function unsupportedStagedEditKind(edits: readonly FoundryStagedEdit[]): FoundryEditKind | null {
  return edits.find((edit) => !isStagedSoundEdit(edit) && !isStagedVisualEdit(edit))?.kind ?? null;
}
```
Add `isStagedRecolorEdit` keyed the same way (`edit.kind === 'recolor' && 'request' in edit`), then extend `unsupportedStagedEditKind`'s predicate and `toForgeRequest`'s if-chain (lines 156-162) with a third branch. Note: `FoundryEditKind` (line 11) is `'sound' | 'texture' | 'recolor' | 'model'` already — no change needed there (D-04).

---

### `src/components/foundry/changeList.ts` / `src/types/mod.ts` (type-widening cascade)

**Not named in CONTEXT.md's canonical_refs — discovered via research grep.** These two are downstream of `describeFoundryBuild`'s output and MUST widen in lockstep or `tsc -b` fails:

`FoundryBuildPart.kind` (`src/types/mod.ts:730`):
```typescript
export interface FoundryBuildPart {
  kind: 'sound' | 'texture'; // widen to 'sound' | 'texture' | 'recolor'
  /* ... */
}
```

`FoundryChangeKind` (`src/components/foundry/changeList.ts:27`), consumed directly at line 109 (`kind: part.kind`):
```typescript
export type FoundryChangeKind = 'sound' | 'texture'; // widen to include 'recolor'
```

---

### `src/components/foundry/ShuffleToggleButton.tsx` (NEW, extracted)

**Analog:** `src/components/locker/HeroSkinsPanel.tsx`, inline button, two near-identical copies (~lines 646-672 and ~846-872), verbatim:
```typescript
{onToggleIncluded && (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onToggleIncluded(); }}
    aria-pressed={isIncluded}
    aria-label={
      isIncluded
        ? t('locker.randomize.removeFromShuffle', { name: primary.name })
        : t('locker.randomize.addToShuffle', { name: primary.name })
    }
    title={
      isIncluded
        ? t('locker.randomize.removeFromShuffle', { name: primary.name })
        : t('locker.randomize.addToShuffle', { name: primary.name })
    }
    className={`absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-[opacity,background-color,color] duration-150 focus-visible:opacity-100 group-hover/card:opacity-100 ${
      isIncluded
        ? 'opacity-100 bg-accent text-accent-foreground hover:bg-accent/80'
        : `${shuffleArmed ? 'opacity-100' : 'opacity-0'} bg-black/65 text-white/90 hover:bg-accent/70 hover:text-accent-foreground`
    }`}
  >
    <Shuffle className="h-3.5 w-3.5" />
  </button>
)}
```
Extract this into `ShuffleToggleButton.tsx` accepting `{ isIncluded, onToggle, label }` (or similarly small props), reuse the exact `locker.randomize.addToShuffle`/`removeFromShuffle` i18n keys (already generic, take `{{name}}`). Positioning classes (`absolute right-1.5 top-1.5`) are card-context-specific — Foundry's row usage will need its own layout wrapper, only the button internals (icon, aria-pressed, color states) are shared.

**i18n keys already present** (`src/locales/en/translation.json:2020-2021`): `locker.randomize.addToShuffle`, `locker.randomize.removeFromShuffle`, both taking `{{name}}`.

---

### `src/components/foundry/HeroWorkshop.tsx` / `SoundBrowse.tsx` (+ toggle row + Locker link)

**State-access analog — already imported, no prop-drilling needed** (`HeroWorkshop.tsx:36`):
```typescript
import { useAppStore } from '../../stores/appStore';
```
Store shape to read (`src/stores/appStore.ts:217, 306, 754-758`):
```typescript
soundShuffleIncluded: Set<string>;
toggleSoundShuffleIncluded: (soundKey: string) => void;
// action body:
toggleSoundShuffleIncluded: (soundKey: string) => {
  const next = new Set(get().soundShuffleIncluded);
  /* add/delete soundKey */
  set({ soundShuffleIncluded: next });
},
```
Identity key (`src/lib/lockerRandomizer.ts:55`): `shuffleSoundKey(mod: Mod)` — takes a `Mod`, so filter `HeroWorkshop.tsx`'s already-loaded `mods` to `mod.soundSwap` set for the hero, no new IPC.

**Navigation analog — the exact, already-documented contract** (`src/components/foundry/MyChanges.tsx:309-310`, verbatim):
```typescript
navigate(
  scope ? `/locker/sounds?hero=${encodeURIComponent(scope)}` : '/locker/sounds/global'
);
```
Doc comment naming Foundry as the intended caller (`src/lib/lockerMode.ts:61-66`):
```typescript
// `/locker/sounds?hero=<display name>` is how Foundry's My changes panel
// links a hero's sounds. The path alone reads as the old landing page, so
// without the query it would rewrite to the grid and silently drop the
// hero the user asked for.
```
`HeroWorkshop.tsx`/`SoundBrowse.tsx` need a one-line `navigate('/locker/sounds?hero=' + encodeURIComponent(heroDisplayName))` call reusing this exact string — no new route.

---

## Shared Patterns

### Async staging with a main-process pre-check
**Source:** `src/components/foundry/visualEdits.ts:65-80` (`prepareVisualStagedEdit`)
**Apply to:** `recolorStagedEdit.ts`'s `prepareRecolorStagedEdit` — this is the ONLY staging function in this phase that cannot be pure/sync, because entry paths are not derivable from hue/sat/bright without a main-process bake+list round trip.

### Builder returns `{ path, cleanup }`; cleanup may be a legitimate no-op
**Source:** `electron/main/services/foundryForge.ts:117` (`cleanup: () => fs.rm(dir, {...}).catch(() => {})`) contrasted with the shared-cache case
**Apply to:** `foundryRecolor.ts`'s `buildRecolorVpk` — MUST NOT delete `vpkPath` (it's `userData/ability-colors/...`, shared with Locker Apply/Export). `cleanup: async () => {}` is correct and safe: cleanup failures are already swallowed at the call site (`foundryForge.ts:125`).

### Discriminated-union kind branching, extend not replace
**Source:** `electron/main/services/foundryForge.ts` (`edit.kind === 'sound' | 'texture'` throughout), `src/components/foundry/buildTray.ts` (`isStagedSoundEdit`/`isStagedVisualEdit`)
**Apply to:** every file in the widening cascade — `foundry.ts` (types), `foundryForge.ts` (3 functions), `buildTray.ts`, `changeList.ts`, `mod.ts`. Run `pnpm typecheck` after touching any one of these; a missed site fails silently at runtime (Pitfall 1), not just at compile time for `describeFoundryBuild`'s fallthrough shape.

### Zustand global store, no prop-drilling required for cross-page reuse
**Source:** `src/stores/appStore.ts` (`soundShuffleIncluded`, `toggleSoundShuffleIncluded`), already consumed directly by `HeroWorkshop.tsx` for `mods`/`toggleMod`
**Apply to:** `HeroWorkshop.tsx`/`SoundBrowse.tsx`'s new shuffle toggle row — call `useAppStore` directly, do not thread through `Locker.tsx`'s props.

### Foundry -> Locker navigation contract
**Source:** `src/components/foundry/MyChanges.tsx:309-310`, documented at `src/lib/lockerMode.ts:61-66`
**Apply to:** the new "view pool in Locker" link in `HeroWorkshop.tsx`/`SoundBrowse.tsx` — reuse the literal `/locker/sounds?hero=<encoded display name>` string verbatim.

## No Analog Found

None. Every file this phase touches or creates has a direct, in-tree analog (this phase is explicitly "plumbing," per RESEARCH.md's own framing — no new mechanism is being introduced anywhere).

## Metadata

**Analog search scope:** `electron/main/services/`, `electron/main/ipc/`, `src/types/`, `src/components/foundry/`, `src/components/locker/`, `src/stores/`, `src/lib/`
**Files scanned this session:** `src/types/foundry.ts`, `src/types/mod.ts` (partial), `electron/main/services/foundryForge.ts`, `electron/main/services/heroColors.ts` (partial), `src/components/foundry/buildTray.ts`, `src/components/foundry/soundStagedEdit.ts`, `src/components/foundry/visualEdits.ts`, `src/components/foundry/changeList.ts` (partial), `src/components/locker/HeroColorPicker.tsx` (partial), `src/components/locker/HeroSkinsPanel.tsx` (grepped + spot-read), `src/stores/appStore.ts` (grepped), `src/components/foundry/HeroWorkshop.tsx` (partial) — all cross-checked against RESEARCH.md's verbatim citations from the same session's deeper reads (`foundryForge.test.ts`, `MyChanges.tsx`, `lockerMode.ts`, `ForkBuildCard.tsx`, `useClipPlayer.ts`, `foundryTextureReplace.ts`, `foundryCatalog.ts`).
**Pattern extraction date:** 2026-08-08
