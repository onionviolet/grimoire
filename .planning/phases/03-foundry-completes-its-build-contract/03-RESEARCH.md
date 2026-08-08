# Phase 3: Foundry Completes Its Build Contract - Research

**Researched:** 2026-08-08
**Domain:** In-repo TypeScript/Electron refactor — widening a discriminated union (`FoundryForgeEdit`) across a main-process build pipeline and a renderer staging layer, plus extracting a small piece of shared UI state wiring. No new external library, no new package.
**Confidence:** HIGH — every claim below was verified by reading the live file this session (path + line range cited), not inferred from CONTEXT.md or training knowledge.

## Summary

This phase is pure in-repo plumbing: no new dependency, no new IPC surface family, no new architecture. The two things CONTEXT.md already fully specifies (recolor widening the `FoundryForgeEdit` union, sound-shuffle surfacing extraction) are real and its D-01 through D-11 record is accurate against the tree — confirmed by reading every file it cites. This research's job is the layer under that: exact signatures, an existing builder Foundry can reuse instead of writing a new one, a type-widening cascade CONTEXT.md's file list does not mention, and a navigation contract that already exists and already has a doc comment naming Foundry as its caller.

**The single most consequential finding:** `buildHeroEffectVpkForExport(deadlockPath, req: HeroEffectExportRequest)` (`electron/main/services/heroColors.ts:560-604`) already builds exactly the VPK a Foundry recolor edit needs to forge, by delegating to the same cached `ensureHero*Bake` functions the "Apply" button and the "Export to disk" button both already use. D-02's ask for "a new builder ... paralleling `buildTextureReplacementVpk`/`buildHeroSoundSwapVpk`" does not need a new `vpkmerge` invocation — it needs a thin adapter around a function that already exists. The one adaptation required: that function returns a persistent **cache** path (`userData/ability-colors/...`), not a throwaway temp dir, so the `{ vpkPath, cleanup }` shape `buildFoundryForgeVpk`'s `built` array expects must get a **no-op** `cleanup` for the recolor case — deleting the returned path would corrupt the shared bake cache the Locker's own Apply/Export buttons also read from.

**Second finding, load-bearing for the plan's task breakdown:** unlike sound (`assignments[].clipPath`) and texture (`entryPath`), the entry paths a recolor edit writes are **not known to the renderer at staging time**. They come from a per-hero recipe (`particle_prefixes`/`texture_entries`/`material_entries`/`model_entries`, `vpkmerge-core/src/hero_recolor.rs`, not exposed to TypeScript) baked into the VPK by the Rust engine. `reviewFoundryForge` and the renderer's `serializeSoundStagedEdit`/`serializeVisualReplacement` both compute `affectedFiles` purely and synchronously from the request — there is no such synchronous source for recolor. The precedent for solving this already exists in the same file family: `prepareVisualStagedEdit` (`src/components/foundry/visualEdits.ts:65-80`) is already **async** and already calls into main (`context.inspect`) before staging. The recommended shape: an async `prepareRecolorStagedEdit` that calls a (new, thin) main-process step wrapping `buildHeroEffectVpkForExport` + `parseVpkDirectory(vpkPath)` to learn the entry list, then stages with that list attached. Because the bake is cached by `(codename, hue, sat, brightness[, mode-specific fields])`, forging later re-invokes the identical cached path — no double work.

**Third finding:** the recolor request is not just `{ hue, saturation, brightness, heroName }` as D-01/D-02's prose suggests. `HeroColorPicker.tsx`'s `handleApply` (`src/components/locker/HeroColorPicker.tsx:316-374`) branches into **three** different main-process calls depending on `mode: 'hue' | 'prism' | 'gradient' | 'trippy'` (`applyHeroColor`, `applyHeroPrism`, `applyTrippyVfx`), each with a different result shape. The type that already unifies all four modes into one request shape is `HeroEffectExportRequest` (`src/types/foundry.ts:194-203`) — it exists specifically because the export-to-disk flow needed the same union. The recolor `FoundryForgeEdit` member's `request` should almost certainly be `HeroEffectExportRequest` (plus the entries list from the finding above), not a hand-rolled `{ hue, saturation, brightness }` shape.

**Fourth finding, scope boundary:** `HeroEffectsPanel.tsx` (mounted unmodified by `RecolorTool.tsx`) shows **two independent one-per-hero slots**: Abilities (`HeroColorPicker`, the one D-01 stages) and Body+Gun (`TrippySkinPanel`, its own `handleApply` → `applyTrippySkin`, a wholly separate VPK/pak04). CONTEXT.md's D-01 names only `HeroColorPicker.tsx`'s call site. `TrippySkinPanel` is not mentioned anywhere in CONTEXT.md and reading it confirms it has its own, separate, unaffected apply path. The plan must make this explicit: within the same mounted panel, Abilities becomes "stage then Forge" and Body+Gun stays "click Apply, done immediately" — two different interaction models sitting in two tabs of one component. This needs a line of UI copy distinguishing them, or a user will reasonably expect both tabs to behave the same way.

**Fifth finding:** the sound-shuffle Locker link Foundry needs (D-09) already exists as a documented contract with Foundry named as a caller. `src/lib/lockerMode.ts:61-66` reads: `"/locker/sounds?hero=<display name>" is how Foundry's My changes panel links a hero's sounds`. `MyChanges.tsx:309-310` already does exactly this: `navigate(scope ? \`/locker/sounds?hero=${encodeURIComponent(scope)}\` : '/locker/sounds/global')`. No new routing code is needed — `HeroWorkshop.tsx`/`SoundBrowse.tsx` need only call `navigate` (or render an `<a>`/`Link`) with that same string, using the hero display name they already have.

**Primary recommendation:** widen `FoundryForgeEdit` to include a `recolor` member whose `request` is `HeroEffectExportRequest & { entries: string[] }` (entries populated at staging time, not derivable from hue/sat/bright alone); implement the recolor builder as a ~10-line wrapper over the existing `buildHeroEffectVpkForExport`, returning a no-op `cleanup`; widen `FoundryBuildPart.kind` (`src/types/mod.ts:730`) and `FoundryChangeKind` (`src/components/foundry/changeList.ts:27`) alongside `FoundryForgeEdit` since `describeFoundryBuild`'s output flows directly into both; and wire the Locker link with the exact, already-load-bearing `/locker/sounds?hero=<name>` string rather than inventing a new route.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recolor staging (renderer state) | Browser/Client (Renderer) | — | `buildTray.ts`/`RecolorTool.tsx` hold staged-edit state in React/Zustand only; nothing persists until Forge |
| Recolor entry-path discovery | API/Backend (Main process) | — | Only the bundled `vpkmerge` binary knows a hero's recipe entries; main must be asked, even at staging time |
| Recolor VPK bake | API/Backend (Main process) | — | `ensureHero*Bake` / `buildHeroEffectVpkForExport` in `heroColors.ts`; shared cache under `userData/ability-colors` |
| Combined build review/merge | API/Backend (Main process) | — | `foundryForge.ts`'s `reviewFoundryForge`/`buildFoundryForgeVpk`; must stay the sole source of truth the renderer's confirmation is checked against |
| Sound-shuffle pool membership (state) | Browser/Client (Renderer, Zustand store) | — | `appStore.soundShuffleIncluded`, already global — no main-process round trip needed for the toggle itself |
| Sound-shuffle pool membership (persistence) | Browser/Client (Renderer, `localStorage`) | — | `SOUND_SHUFFLE_INCLUDED_KEY` in `lockerRandomizer.ts`; unchanged by this phase |
| Cross-page navigation (Foundry → Locker) | Browser/Client (React Router) | — | `/locker/sounds?hero=<name>` is resolved entirely client-side by `resolveLockerRoute` |
| Pool audition playback | Browser/Client (Renderer) | — | `useClipPlayer.ts`'s `advancePoolCursor`; already correct, no change needed (D-06/D-07) |

## User Constraints

<user_constraints>
### Locked Decisions

- **D-01:** Recolor authoring becomes a staged, deferred `FoundryForgeEdit` — matching the sound/texture pattern — rather than keeping its current immediate-apply behavior. `HeroColorPicker.tsx`'s `handleApply` stops calling `applyHeroColor(heroName, hue, saturation, brightness)` directly; instead it produces a staged edit (`{id, kind: 'recolor', precedence, request}`, where `request` carries hue/saturation/brightness + hero name) that only bakes into real bytes when the combined build is forged. — **Reversibility:** costly — this changes the Locker recolor UI's core interaction model from "click Apply, it's baked" to "click Apply, it's staged until Forge", which existing users' muscle memory and any doc referencing immediate-apply depend on.
- **D-02:** This requires: a new recolor request type beside `TextureReplacementRequest`/`HeroSoundSwapRequest` in `src/types/foundry.ts`; a new builder in the main process paralleling `buildTextureReplacementVpk`/`buildHeroSoundSwapVpk`; and `foundryForge.ts`'s `reviewFoundryForge`, `describeFoundryBuild`, and `buildFoundryForgeVpk` each gaining a `'recolor'` branch. The `built` array in `buildFoundryForgeVpk` (line ~94-104) only pushes for `sound`/`texture` today via an `if/else if` — this must extend to three branches or a recolor edit silently misaligns `built[index]` against `request.edits[index]`, exactly the trap the ROADMAP's own notes call out.
- **D-03:** The staged-edit shape stays a plain discriminated union member (`{id, kind, precedence, request}`), matching sound/texture exactly, so a future edit kind (if one is ever scoped) slots in the same way rather than inventing its own wiring. This is a design-generalization note, not a license to build anything for that future now.
- **D-04:** `FoundryForgeEdit` widens to `sound | texture | recolor` only. No `'model'` union member, no type stub, no authoring UI, no backend builder. `buildTray.ts`'s existing `FoundryEditKind` type (which already lists `'recolor' | 'model'`) does not need to change — it is a renderer-only staging type already wider than the backend union, and its `'model'` case remains permanently caught by `unsupportedStagedEditKind` until a future phase decides otherwise.
- **D-05:** Rationale: ROADMAP's Phase 3 success criteria test only recolor entering the build, never model. Building a type-only stub for a kind with zero consumers would be speculative scaffolding the project's house style avoids. — **Reversibility:** reversible — adding `'model'` later is a small, additive type change whenever a model-authoring flow is actually scoped.
- **D-06:** REQ-foundry-pool-audition-fidelity and ROADMAP's Phase 3 success criterion 3 are treated as already delivered, not open work. `src/components/foundry/useClipPlayer.ts` already cycles through the whole pool on repeated presses of the same row (`advancePoolCursor`), gated by the existing `forkPoolCycling` setting (`ForkBuildCard.tsx`, default on). This shipped in commit `9b01c63` on 2026-07-26 — eleven days before REQUIREMENTS.md was authored (2026-08-05). **Confirmed accurate this session**: `useClipPlayer.ts` (read in full) implements exactly this; `ForkBuildCard.tsx:47-48` confirms `checked={settings?.forkPoolCycling !== false}` (default-on).
- **D-07:** No code ships for audition fidelity in Phase 3. A stronger "one press plays every clip back-to-back" was considered and rejected in favor of the existing per-press cycling.
- **D-08:** `REQUIREMENTS.md`'s traceability row for `REQ-foundry-pool-audition-fidelity` should be corrected to reflect delivery predates the phase (doc-drift correction), not left as "Phase 3 / Pending". Planning-and-verification bookkeeping, not implementation work.
- **D-09:** Foundry gets an inline add/remove toggle for a hero's sound launch-shuffle pool membership, plus a link to the Locker's fuller pool view for that hero — not a link-only surface. The add/remove action itself must work without leaving Foundry.
- **D-10:** The toggle currently lives only inside `src/pages/Locker.tsx`, prop-drilled (`soundShuffleIncluded`, `toggleSoundShuffleIncluded`, `shuffleKeyFor`) into a shared hero list-render component (`HeroSkinsPanel`), reading/writing `appStore`'s `soundShuffleIncluded` Set and `SOUND_SHUFFLE_INCLUDED_KEY` via `toggleSoundShuffleIncluded`. This needs extracting into a small shared component or hook both `Locker.tsx` and Foundry's `HeroWorkshop.tsx`/`SoundBrowse.tsx` can call against the same `appStore` state, rather than duplicating the toggle logic. **Correction/nuance found this session:** the *state* does not actually need extracting — `appStore` is a global Zustand store, already imported directly by `HeroWorkshop.tsx` (`useAppStore`) for unrelated purposes (`mods`, `toggleMod`). Locker.tsx's prop-threading is internal to how it feeds `HeroSkinsPanel`, not a barrier Foundry needs to route through. What is actually missing and worth extracting is the **presentational toggle button** (the `aria-pressed` `Shuffle`-icon button currently inlined twice inside `HeroSkinsPanel.tsx`'s card renderers, ~lines 650-670 and ~850-870) so Foundry's new sound rows render the same control rather than a re-invented one.
- **D-11:** The identity key for pool membership is `shuffleSoundKey(mod)` (`src/lib/lockerRandomizer.ts:55`), namespaced separately from skin/card pools. Reuse this as-is; no new key scheme. **Confirmed this session:** `shuffleSoundKey` takes a `Mod`, not a catalog `HeroSound`/`GlobalSound` entry — the Foundry toggle only applies to a hero's already-installed sound-swap `Mod`s (those with `mod.soundSwap` set), not to unauthored catalog rows. `HeroWorkshop.tsx` already loads `mods` from `appStore`, so filtering to the hero's sound-swap mods is a local `.filter()`, no new IPC.

### Claude's Discretion

- Exact component/hook boundary for the extracted shuffle-toggle (D-10) — a shared presentational component with store access passed as props, or a small custom hook wrapping the `appStore` selectors, whichever is the smaller diff against `Locker.tsx`'s existing prop-threading shape.
- The recolor request type's exact field names in `src/types/foundry.ts` (D-01/D-02) — match `TextureReplacementRequest`'s existing conventions (optional `heroName` for grouping/cross-link, `thumbnailDataUrl` if a preview makes sense in the tray).
- Where the recolor builder function lives in the main process (own file vs. extending `foundryTextureReplace.ts` or a sibling) — lean toward its own fork-only file unless it is trivially small, matching the sound/texture split.
- Copy/wording for any new tray labels, the Foundry-side shuffle toggle, and the "recolor is now staged, not immediate" UX change (all i18n keys per house style).

### Deferred Ideas (OUT OF SCOPE)

- **`'model'` as a Foundry edit kind.** Explicitly declined for this phase (D-04/D-05): no authoring surface or request type exists anywhere in the codebase, ROADMAP's success criteria never test it, and "Foundry models... (slice G)" is out of scope pending a trustworthy path catalog. Revisit only when that catalog work is scoped.
- **One-press-plays-everything pool audition.** Considered and rejected in favor of the existing per-press cycling (D-07). If a future user need for it emerges beyond this phase, it is new sequencing/interrupt-handling work, not a bug fix.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-foundry-forge-edit-kinds | `FoundryForgeEdit` admits recolor edits; `foundryForge.ts`'s `built` array must stay aligned once a third kind exists | See "Recolor Builder — Reuse, Don't Reinvent", "The `built[index]` Alignment Trap", and "Type-Widening Cascade" below — identifies the exact reusable builder, the exact array-alignment fix location, and every type beyond `FoundryForgeEdit` that must widen in lockstep for the codebase to typecheck |
| REQ-foundry-sound-shuffle-surfacing | Existing hero sound launch-shuffle controls reachable from Foundry, with a link back to the Locker | See "Sound-Shuffle Surfacing" below — confirms the store is already globally reachable (no prop-drilling), identifies the exact presentational component to extract, the exact identity-key function and its `Mod`-shaped input, and the exact, already-documented Locker navigation string Foundry should reuse verbatim |
| REQ-foundry-pool-audition-fidelity | Auditioning a pool plays every clip | See "Pool Audition Fidelity — Confirmed Delivered" below — independently re-verifies D-06/D-07/D-08's doc-drift claim against the live `useClipPlayer.ts` and `ForkBuildCard.tsx` source; no code task needed, only the REQUIREMENTS.md traceability correction |
</phase_requirements>

## Standard Stack

No new library or package is introduced by this phase. Every mechanism used already exists in the tree:

| Mechanism | Location | Purpose | Why reuse, not new |
|-----------|----------|---------|---------------------|
| `buildHeroEffectVpkForExport` | `electron/main/services/heroColors.ts:560-604` | Bakes (or reads from cache) a hero's recolor/prism/gradient/trippy VPK, returns `{ vpkPath, suggestedName }` | Already does exactly what the recolor `FoundryForgeEdit` builder needs; reuse avoids a second `vpkmerge` invocation path with its own cache/race semantics |
| `parseVpkDirectory` | `electron/main/services/vpk.ts:417` | Read a VPK's entry list, `string[] \| null` | Already imported into `foundryForge.ts`; the only way to learn a recolor edit's affected paths, since the recipe entry list is not exposed to TypeScript |
| `HeroEffectExportRequest` | `src/types/foundry.ts:194-203` | Unifies hue/prism/gradient/trippy into one request shape | Already the type the export-to-disk flow uses for the same four modes; avoids re-deriving a narrower shape that then needs widening again later |
| `shuffleSoundKey` | `src/lib/lockerRandomizer.ts:55` | Identity key for a `Mod`'s shuffle-pool membership | D-11 requires reuse as-is |
| `resolveLockerRoute` / `legacySoundTarget` | `src/lib/lockerMode.ts` | Resolves `/locker/sounds?hero=<name>` to the canonical hero+section route | Already documented as "how Foundry's My changes panel links a hero's sounds" (`lockerMode.ts:61-66`); zero new routing code needed |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Renderer (React) ───────────────────────────┐
│                                                                          │
│  RecolorTool.tsx ──mounts──▶ HeroEffectsPanel.tsx                       │
│                                 ├─ Abilities tab: HeroColorPicker.tsx    │
│                                 │    handleApply() [D-01: stops calling  │
│                                 │    applyHeroColor/Prism/Trippy direct] │
│                                 │        │                               │
│                                 │        ▼                               │
│                                 │   stage as FoundryStagedEdit           │
│                                 │   (kind:'recolor') via a new           │
│                                 │   prepareRecolorStagedEdit() — ASYNC,  │
│                                 │   calls main once to learn entries     │
│                                 │        │                               │
│                                 └─ Body+Gun tab: TrippySkinPanel.tsx     │
│                                      handleApply() → applyTrippySkin     │
│                                      [UNCHANGED — separate slot, out    │
│                                       of scope, still immediate-apply]  │
│                                                                          │
│  buildTray.ts (FoundryStagedEdit[]) ──review──▶ toForgeRequest()        │
│       │                                              │                  │
│       ▼                                              ▼                  │
│  HeroWorkshop.tsx / SoundBrowse.tsx           FoundryForgeRequest       │
│  ┌─ new: sound-shuffle toggle row                    │                  │
│  │   useAppStore(s.soundShuffleIncluded)              │                  │
│  │   useAppStore(s.toggleSoundShuffleIncluded)         │                  │
│  │   shuffleSoundKey(mod)  [D-11, reused as-is]        │                  │
│  │   navigate('/locker/sounds?hero=' + heroName)       │                  │
│  │   [D-09, exact string already documented as the    │                  │
│  │    Foundry→Locker contract in lockerMode.ts]        │                  │
│  └──────────────────────────────────────────────────────┘               │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │ IPC (foundry:forge, new: foundry:stageRecolor-ish)
┌─────────────────────────────── Main process ───────────────────────────┐
│                                                                          │
│  NEW: buildRecolorStagedEntries(deadlockPath, req)                      │
│     → buildHeroEffectVpkForExport(deadlockPath, req)  [REUSED]          │
│     → parseVpkDirectory(vpkPath)                       [REUSED]         │
│     → returns entries[] to renderer for staging                        │
│                                                                          │
│  foundryForge.ts                                                        │
│   ├─ reviewFoundryForge(edits)        [+recolor branch: read            │
│   │                                    edit.request.entries directly,   │
│   │                                    no rebake needed]                │
│   ├─ describeFoundryBuild(request)    [+recolor branch → FoundryBuildPart│
│   │                                    with kind:'recolor', widened     │
│   │                                    type at src/types/mod.ts:730]    │
│   └─ buildFoundryForgeVpk(...)        [+recolor branch in the built[]   │
│       loop: buildHeroEffectVpkForExport again (cache hit, fast) →       │
│       { path: vpkPath, cleanup: async () => {} }  — NO-OP cleanup,      │
│       the path is a shared persistent cache, not a throwaway temp]      │
│                                                                          │
│  runVpkmerge (merge step, unchanged) → verifyVpkOutput → parseVpkDirectory│
│  (final actual-vs-reviewed write-set check, unchanged, already generic) │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new directories. New/changed files only:

```
src/types/foundry.ts                         # +recolor member on FoundryForgeEdit; new request type
src/types/mod.ts                             # FoundryBuildPart.kind widens to include 'recolor'
src/components/foundry/buildTray.ts          # +isStagedRecolorEdit guard; unsupportedStagedEditKind unaffected list
src/components/foundry/recolorStagedEdit.ts  # NEW — mirrors soundStagedEdit.ts/visualEdits.ts shape
src/components/foundry/changeList.ts         # FoundryChangeKind widens ('sound'|'texture'|'recolor')
src/components/locker/HeroColorPicker.tsx    # handleApply: stage instead of apply (Abilities tab only)
src/components/foundry/RecolorTool.tsx       # tray-awareness (mount point per CONTEXT.md canonical_refs)
electron/main/services/foundryRecolor.ts     # NEW (or extend heroColors.ts) — thin builder wrapping
                                              # buildHeroEffectVpkForExport + parseVpkDirectory
electron/main/services/foundryForge.ts       # +recolor branch in reviewFoundryForge/describeFoundryBuild/
                                              # buildFoundryForgeVpk; built[] alignment fix (3 branches)
electron/main/ipc/foundry.ts                 # +IPC for staging-time entry discovery (if not folded into
                                              # an existing handler)
src/components/foundry/ShuffleToggleButton.tsx  # NEW — extracted from HeroSkinsPanel.tsx's inlined button
src/components/locker/HeroSkinsPanel.tsx     # uses the extracted button (no behavior change)
src/components/foundry/HeroWorkshop.tsx      # +sound-shuffle toggle row + Locker link
src/components/foundry/SoundBrowse.tsx       # +sound-shuffle toggle row + Locker link
.planning/../REQUIREMENTS.md                 # traceability correction only (D-08), no code
```

### Pattern 1: Async staging with a main-process pre-check (already established)

**What:** A staging function is not required to be pure/sync. `prepareVisualStagedEdit` is already `async` and already calls into main before producing a `FoundryStagedEdit`.
**When to use:** When a staged edit's `affectedFiles` cannot be derived from data the renderer already has (recolor's case).
**Example (existing precedent, verbatim):**
```typescript
// Source: src/components/foundry/visualEdits.ts:65-80 (read this session)
export async function prepareVisualStagedEdit(context: VisualStageContext): Promise<VisualStagedEdit | null> {
  const sources = await context.inspect(visualAssetInspectionPaths(context.item, context.catalog));
  if (sources.unreadableMods.length > 0) throw new Error(context.unreadableMessage);
  const enabled = sources.sources.filter((source) => source.enabled);
  if (enabled.length > 0 && !(await context.confirm(enabled.map((source) => source.modName)))) return null;
  return serializeVisualReplacement({ /* ... */ });
}
```
A `prepareRecolorStagedEdit` should follow this exact shape: call main once (bake-and-list), then the existing ownership-inspection/confirm step (recolor edits can also collide with an existing enabled owner of the same particle/texture/model paths — the same "layering over an enabled owner needs acknowledgement" invariant CONTEXT.md's Phase Boundary calls out applies here too, and `visualEdits.ts`'s `inspect`/`confirm` fields are the exact existing mechanism).

### Pattern 2: Builder returns `{ path, cleanup }`; `cleanup` may be legitimately a no-op

**What:** `buildFoundryForgeVpk`'s `built` array (`electron/main/services/foundryForge.ts:94-104`) expects every part to expose `cleanup(): Promise<void>`.
**When to use:** Recolor's builder, because its underlying `vpkPath` is a shared, cached, persistent file (`userData/ability-colors/...`), not a fresh temp directory like sound/texture's builders create.
**Example:**
```typescript
// New file, e.g. electron/main/services/foundryRecolor.ts — pattern only, not verbatim source
export async function buildRecolorVpk(
    deadlockPath: string,
    req: HeroEffectExportRequest,
): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    const { vpkPath } = await buildHeroEffectVpkForExport(deadlockPath, req); // cached, reused
    return { vpkPath, cleanup: async () => {} }; // never delete: it's the shared bake cache
}
```
Confirmed safe against `buildFoundryForgeVpk`'s existing contract: cleanup failures are already swallowed (`.catch(() => {})`, `foundryForge.ts:125`), so a no-op cleanup changes nothing about error handling; it just correctly never attempts deletion.

### Anti-Patterns to Avoid

- **Re-deriving recolor's affected entries client-side by guessing a path convention.** The 9-entry texture table and the 267-particle-file count in `docs/ability-vfx-recolor.md` are hero-specific and recipe-driven (Rust-side, `hero_recolor.rs`), not a fixed pattern per hero. Any renderer-side path guess will drift from what the engine actually bakes. Always source entries from `parseVpkDirectory` on the real bake output.
- **Deleting the recolor builder's `vpkPath` in `cleanup`.** It is the same cache file the Locker's "Apply" button and "Export to disk" button read from (`ensureHeroColorBake`/`ensureHeroPrismBake`/`ensureHeroTrippyVfxBake`, all keyed by `(codename, params...)`). Deleting it after a Foundry forge would silently break a subsequent Locker apply/export for the same hero+params until the cache is rebuilt.
- **Assuming `TrippySkinPanel`'s Body+Gun apply needs staging too.** It is a separate slot (`applyTrippySkin`, pak04) with its own independent apply path; nothing in D-01 through D-11 or the ROADMAP success criteria mentions it, and widening scope to it is not part of this phase.
- **Prop-drilling the sound-shuffle state into Foundry through Locker.tsx.** `appStore` is a Zustand store already imported directly by both pages; there is no ownership boundary requiring the state to pass through `Locker.tsx`'s props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recolor VPK bake | A second `vpkmerge recolor-hero`/`prism`/`trippy-vfx` invocation path in a new builder | `buildHeroEffectVpkForExport` (`heroColors.ts:560`) | Already caches, already handles all four modes, already used by two other call sites (Apply, Export) — a second path risks the cache key drifting out of sync |
| Recolor entry-path discovery | A hardcoded per-hero path table in TypeScript | `parseVpkDirectory` on the real bake output | The recipe is Rust-side and hero-specific (see `docs/ability-vfx-recolor.md`'s 9-entry Paige table — not the same for every hero); only the actual VPK is authoritative |
| Sound-shuffle pool membership | A parallel Foundry-only shuffle Set/localStorage key | `appStore.soundShuffleIncluded` / `toggleSoundShuffleIncluded` (D-11) | Two Sets for the same concept would desync the moment either surface toggles independently |
| Foundry→Locker hero-sounds navigation | A new route or query param scheme | `/locker/sounds?hero=<display name>` (`lockerMode.ts:61-66`, already resolved by `resolveLockerRoute`) | This string is already documented as the Foundry handoff contract and already has route-resolution + tests behind it |

**Key insight:** almost everything this phase needs already exists somewhere in the tree under a different door (the export flow's builder, the store's global reachability, the legacy-URL resolver's Foundry-aware comment). The work is mostly plumbing a `'recolor'` branch through existing functions and wiring two already-existing pieces together, not building new mechanism.

## Common Pitfalls

### Pitfall 1: Widening `FoundryForgeEdit` without widening its downstream siblings

**What goes wrong:** `describeFoundryBuild`'s recolor branch returns a `FoundryBuildPart` with `kind: 'recolor'`, but `FoundryBuildPart.kind` (`src/types/mod.ts:730`) is typed `'sound' | 'texture'`. TypeScript strict mode will reject the assignment. Separately, `changeList.ts:109` does `kind: part.kind` directly onto `FoundryChangeEntry.kind`, typed `FoundryChangeKind = 'sound' | 'texture'` (`changeList.ts:27`) — this too fails to typecheck once `FoundryBuildPart.kind` widens.
**Why it happens:** CONTEXT.md's canonical_refs list names only `src/types/foundry.ts` and `electron/main/services/foundryForge.ts` as the touch points for D-01/D-02. `types/mod.ts:730` and `changeList.ts:27` are downstream consumers of `describeFoundryBuild`'s output that CONTEXT.md does not mention, discovered this session by grepping every `kind === 'sound'`/`kind === 'texture'` site in the repo.
**How to avoid:** Widen `FoundryBuildPart.kind` and `FoundryChangeKind` in the same task/commit as `FoundryForgeEdit`. `tsc -b` (the project's `typecheck` script) will catch any missed site immediately — run it before considering the recolor plumbing done.
**Warning signs:** A `tsc` error on `kind: part.kind` in `changeList.ts` or on the `describeFoundryBuild` recolor branch's return object.

### Pitfall 2: Assuming recolor's staged edit can be built the same way sound/texture's are (pure, sync)

**What goes wrong:** Writing `serializeRecolorStagedEdit` as a pure function mirroring `serializeSoundStagedEdit`/`serializeVisualReplacement` will compile, but `affectedFiles` will have nothing correct to compute from — hue/saturation/brightness carry no path information.
**Why it happens:** The sound/texture precedent (both purely derive `affectedFiles` from data already in the request) is the obvious pattern to copy, and CONTEXT.md's discretion note about "the recolor request type's exact field names" doesn't flag that the entries themselves are the hard part, not the field names.
**How to avoid:** Follow the `prepareVisualStagedEdit` precedent instead (async, calls main first) — see "Pattern 1" above.
**Warning signs:** A recolor staged edit whose `affectedFiles` is empty or a guessed static list; the tray's collision detection and write-set preview would silently be wrong for every recolor edit.

### Pitfall 3: Recolor builder's `cleanup` deleting the shared bake cache

**What goes wrong:** Copying the sound/texture builders' `cleanup: () => fs.rm(dir, { recursive: true, force: true })` pattern verbatim for recolor deletes `userData/ability-colors/<cache file>`, which is shared, persistent, and read by the Locker's unrelated Apply/Export buttons.
**Why it happens:** Every existing builder in `foundryForge.ts`'s `built` array does exactly this cleanup shape; it's the natural thing to copy without checking where the recolor builder's `vpkPath` actually lives.
**How to avoid:** Recolor's `cleanup` must be `async () => {}` — see "Pattern 2" above. Confirm by reading `ensureHeroColorBake` (`heroColors.ts:167-202`): it writes to `join(app.getPath('userData'), 'ability-colors')`, not a `tmpdir()`-based throwaway.
**Warning signs:** A Locker recolor Apply or Export starting to re-bake (slow) after a Foundry forge that included a recolor edit for the same hero — the sign the cache file was deleted.

### Pitfall 4: Forgetting the Abilities/Body+Gun split inside `HeroEffectsPanel`

**What goes wrong:** D-01's staging change is implemented only in `HeroColorPicker.tsx`, which is correct — but if the UI copy or the tray's "recolor is now staged" messaging is written as if it applies to "the recolor panel" generally, users on the Body+Gun tab will be confused when their trippy-skin paint applies immediately with no staging step, contradicting what they just read.
**Why it happens:** `RecolorTool.tsx` mounts `HeroEffectsPanel` as one unit; the staged/immediate split is invisible at that mount point and only visible inside the panel's own surface toggle.
**How to avoid:** Scope any new copy explicitly to "Abilities" (or wherever the Apply button in question lives), and confirm `TrippySkinPanel.tsx`'s own copy/button still reads correctly as immediate-apply once its sibling tab changes behavior.
**Warning signs:** A UAT tester reporting "the Body+Gun tab still applies immediately, is that a bug?"

### Pitfall 5: Trusting a synchronous `reviewFoundryForge` at Forge time as the only place entries are computed

**What goes wrong:** If `reviewFoundryForge`'s recolor branch tries to call `buildHeroEffectVpkForExport` itself (to learn entries at review/forge time), `reviewFoundryForge` stops being synchronous, breaking its current signature and every caller that treats it as pure (including the renderer's own re-derivation of the review for display, and the `sameReview` staleness check in `buildFoundryForgeVpk`).
**Why it happens:** It looks like the "obvious" place to resolve entries if the earlier staging-time discovery is skipped.
**How to avoid:** Entries must already be present on `edit.request.entries` by the time `reviewFoundryForge` runs (populated at staging time per Pitfall 2's fix). `reviewFoundryForge`'s recolor branch then reads `edit.request.entries` exactly the way it reads `edit.request.assignments`/`edit.request.entryPath` today — no IO, stays synchronous.
**Warning signs:** `reviewFoundryForge` or `sameReview` needing to become `async`, which would ripple through every caller including the two-line renderer callers that currently treat it as pure.

## Code Examples

### The exact `built[]` alignment trap location and required fix shape

```typescript
// Source: electron/main/services/foundryForge.ts:94-104 (read this session, verbatim)
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
        // MISSING today: no `else if (edit.kind === 'recolor')` branch. If one is added
        // that DOESN'T push to `built`, the later `ordered` derivation
        // (`request.edits.map((edit, index) => ({ ..., path: built[index].path }))`, line 107)
        // reads `built[index]` for the WRONG edit for every edit after the unhandled one —
        // built.length < request.edits.length, so indices desync silently (no throw).
    }
```
The fix is a third `else if (edit.kind === 'recolor')` branch that always pushes exactly one entry to `built`, keeping `built[i]` aligned with `request.edits[i]` for every `i`, matching the invariant the existing two branches already (implicitly) maintain.

### Existing test pattern to extend (`foundryForge.test.ts`)

```typescript
// Source: electron/main/services/foundryForge.test.ts:14-25 (read this session, verbatim)
const soundEdit: FoundryForgeEdit = {
    id: 'sound', kind: 'sound', precedence: 2,
    request: {
        heroCodename: 'hero', heroName: 'Hero', name: 'Dash audio', audioPath: 'dash.mp3',
        assignments: [{ clipPath: 'SOUNDS/dash.vsnd', audioPath: 'dash.mp3' }],
    },
};

const textureEdit: FoundryForgeEdit = {
    id: 'visual', kind: 'texture', precedence: 1,
    request: { entryPath: 'Sounds\\Dash.VSND_C', imagePath: 'dash.png', name: 'Dash', category: 'ability-icon' },
};
```
A `recolorEdit` fixture following this exact shape (with a fabricated `entries: [...]` list on its `request`) is the natural addition to `reviewFoundryForge`'s and `describeFoundryBuild`'s existing `describe` blocks, plus a new `it('builds one part per recolor edit and keeps built[] aligned with three kinds')` style case for `buildFoundryForgeVpk` — the existing "stale confirmation" and "wrong collision winner" tests should be duplicated with a three-edit (`sound`, `texture`, `recolor`) request to actually exercise the alignment fix.

### The exact Locker navigation contract Foundry should call verbatim

```typescript
// Source: src/components/foundry/MyChanges.tsx:309-310 (read this session, verbatim — existing precedent)
navigate(
  scope ? `/locker/sounds?hero=${encodeURIComponent(scope)}` : '/locker/sounds/global'
);
```
```typescript
// Source: src/lib/lockerMode.ts:61-66 (read this session, verbatim — documents this is the Foundry contract)
// `/locker/sounds?hero=<display name>` is how Foundry's My changes panel
// links a hero's sounds. The path alone reads as the old landing page, so
// without the query it would rewrite to the grid and silently drop the
// hero the user asked for.
const hero = legacy.kind === 'locker' ? new URLSearchParams(search).get('hero') : null;
return { drillIn: 'legacy', section: null, legacy: hero ? { kind: 'hero', hero } : legacy };
```
`HeroWorkshop.tsx`/`SoundBrowse.tsx` already have `heroName`/hero display name in scope; the D-09 Locker link is a one-line `navigate` call with the string above, reusing an already-tested resolution path (`resolveLockerRoute` in `lockerMode.ts`).

### The `ShuffleToggleButton` extraction target

```typescript
// Source: src/components/locker/HeroSkinsPanel.tsx (read this session; two near-identical
// inline renders exist at ~lines 653-670 and ~853-870, confirmed via grep)
// Both blocks render:
<button
  type="button"
  aria-pressed={isIncluded}
  title={isIncluded
    ? t('locker.randomize.removeFromShuffle', { name: primary.name })
    : t('locker.randomize.addToShuffle', { name: primary.name })}
  // ...
>
  <Shuffle className="h-3.5 w-3.5" />
</button>
```
The i18n keys (`locker.randomize.addToShuffle`/`removeFromShuffle`, confirmed present at `src/locales/en/translation.json:2020-2021`, both taking a `{{name}}` interpolation) are generic enough to reuse verbatim from Foundry — no new key is required for the toggle's accessible label/title, only (per Claude's Discretion) for anything Foundry-specific around it.

## State of the Art

Not applicable in the "library evolved" sense — this is entirely in-repo. The one relevant "state of the art" fact: the export-to-disk flow (`buildHeroEffectVpkForExport`) is **newer** than the original sound/texture Foundry builders and was written specifically to unify all four recolor modes into one request/build path — it is the more current pattern to follow for a new recolor consumer, not the older `applyHeroColor`/`applyHeroPrism`/`applyHeroTrippyVfx` trio `HeroColorPicker.tsx` currently calls directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `vpkmerge` CLI flag exists to list a hero's recolor recipe entries without a full bake (e.g. no `recolor-hero --list`/`--dry-run`). This session could only verify the TypeScript/Electron side; `vpkmerge-core` is a sibling Rust repo not in this working tree. | "Second finding" (Summary), Pattern 1, Pitfall 2 | If such a flag exists, the staging-time discovery step could be cheaper (list-only, no bake) instead of always baking eagerly. If it does not exist (as assumed), eager-bake-at-stage is the only option and should be the plan's default; a planner should spend a few minutes checking `vpkmerge --help` / `vpkmerge recolor-hero --help` on the bundled binary before committing to the eager-bake design, but should not block on it — the eager-bake path is correct either way, just possibly slower for VFX-heavy heroes on first stage. |
| A2 | The recolor request type should be `HeroEffectExportRequest` (or a supertype of it) rather than a narrower `{ hue, saturation, brightness, heroName }` shape, based on `HeroColorPicker.tsx`'s three-branch `handleApply`. | "Third finding" (Summary) | If the planner instead ships only `hue`/`saturation`/`brightness` per D-02's literal prose, `mode: 'prism'`/`'gradient'`/`'trippy'` recolors would have no staged-edit representation, silently under-delivering "a recolor staged in Foundry" for 3 of the picker's 4 modes (only plain hue would stage correctly) — this is a testable gap a UAT pass on the Prism/Gradient/Trippy tabs would catch immediately. |

## Open Questions

1. **Where does the staging-time bake-and-list IPC live?**
   - What we know: it needs to call `buildHeroEffectVpkForExport` + `parseVpkDirectory`, both already importable in the main process; `electron/main/ipc/foundry.ts` already hosts `foundry:exportHeroEffect` as an adjacent precedent.
   - What's unclear: whether it's a new named IPC channel (e.g. `foundry:prepareRecolorStage`) or whether the existing `foundry:exportHeroEffect` handler's underlying builder can be reused directly from a new handler with a different return shape (`{ entries }` instead of `{ vpkPath, suggestedName }` after a save dialog).
   - Recommendation: new, narrow IPC handler dedicated to staging (returns `{ entries: string[] }`, no save dialog), calling the same `buildHeroEffectVpkForExport`, to keep the export-to-disk flow's contract untouched.

2. **Does the recolor staging step need the same "layering over an enabled owner" acknowledgement `visualEdits.ts`'s `confirm` step provides?**
   - What we know: `prepareVisualStagedEdit` blocks on an unreadable inspection and asks for acknowledgement when staging would layer over an already-enabled mod owning the same paths — this mirrors CONTEXT.md's Phase Boundary invariant ("a failed or unreadable inspection still blocks the ambiguous action").
   - What's unclear: whether a hero's ability-VFX particle/texture/model paths can realistically already be owned by another enabled mod in practice (a third-party VFX recolor mod would collide) — this session did not verify how common that is.
   - Recommendation: reuse the exact same `inspect`/`confirm` mechanism `visualEdits.ts` already has (it's already generic over any entry-path list) rather than deciding this is out of scope; the cost is near-zero since the entries are already being fetched from main at staging time anyway.

## Environment Availability

Skipped — this phase has no new external dependency; the bundled `vpkmerge` binary and Vitest/TypeScript toolchain are already required and present for every other Foundry phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`package.json` devDependency; version not re-verified this session, already in use) |
| Config file | `vitest.config.ts` — `environment: 'node'`, includes `src/**/*.test.ts(x)`, `electron/**/*.test.ts`, `scripts/**/*.test.ts` |
| Quick run command | `pnpm exec vitest run electron/main/services/foundryForge.test.ts src/components/foundry/buildTray.test.ts` |
| Full suite command | `pnpm test` (= `vitest run`, confirmed at `package.json` line 32) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-foundry-forge-edit-kinds | `reviewFoundryForge`/`describeFoundryBuild` handle a `recolor` edit correctly (entries, collisions, provenance) | unit | `pnpm exec vitest run electron/main/services/foundryForge.test.ts` | ✅ file exists (`foundryForge.test.ts`), extend with recolor fixtures |
| REQ-foundry-forge-edit-kinds | `buildFoundryForgeVpk`'s `built[]` stays aligned across all three kinds (the alignment trap) | unit | `pnpm exec vitest run electron/main/services/foundryForge.test.ts` | ✅ same file — needs a new 3-edit-request test case, none exists today |
| REQ-foundry-forge-edit-kinds | `isStagedRecolorEdit`/`unsupportedStagedEditKind` correctly classify a recolor staged edit | unit | `pnpm exec vitest run src/components/foundry/buildTray.test.ts` | ✅ file exists |
| REQ-foundry-forge-edit-kinds | Recolor request → staged edit serialization (`prepareRecolorStagedEdit`/`serializeRecolorStagedEdit`) | unit | new file, e.g. `pnpm exec vitest run src/components/foundry/recolorStagedEdit.test.ts` | ❌ Wave 0 — mirror `soundStagedEdit.test.ts`/`visualEdits.test.ts` |
| REQ-foundry-sound-shuffle-surfacing | `shuffleSoundKey`/toggle wiring behaves identically from Foundry as from Locker | unit | existing `lockerRandomizer` tests if present, else new | check for `lockerRandomizer.test.ts` before assuming a gap |
| REQ-foundry-sound-shuffle-surfacing | Foundry→Locker navigation string resolves to the hero+sounds route | unit (already covered) | `pnpm exec vitest run src/lib/lockerMode.test.ts` (if exists) — the resolution logic is already generic, no new test strictly required unless Foundry passes something the existing suite doesn't cover | check existence |
| REQ-foundry-pool-audition-fidelity | No new test — already covered per D-06/D-07 | n/a | n/a | n/a (doc-only requirement per D-08) |

### Sampling Rate
- **Per task commit:** targeted `vitest run` on the touched test file(s)
- **Per wave merge:** `pnpm test` (full suite) + `pnpm typecheck` (`tsc -b`) — typecheck is not optional for this phase given the Pitfall 1 type-widening cascade
- **Phase gate:** full suite green + `pnpm typecheck` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/foundry/recolorStagedEdit.test.ts` — covers REQ-foundry-forge-edit-kinds (staging serialization)
- [ ] `electron/main/services/foundryForge.test.ts` — extend with a `recolorEdit` fixture and a 3-kind `built[]` alignment test; covers REQ-foundry-forge-edit-kinds
- [ ] Confirm whether `src/lib/lockerMode.test.ts` / a `lockerRandomizer` test file already exists before assuming either is a gap (not checked this session — low risk, both are small pure-function modules well suited to the existing test style)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | not applicable — local desktop app, no auth surface touched |
| V3 Session Management | no | not applicable |
| V4 Access Control | no | not applicable — no new privilege boundary |
| V5 Input Validation | yes | Unchanged pattern: `buildFoundryForgeVpk` already re-derives `reviewFoundryForge` main-side and rejects a stale/tampered `confirmation` (`sameReview`, `foundryForge.ts:76-82`) rather than trusting renderer-supplied write sets — this invariant must extend unchanged to the recolor branch (entries come from `edit.request.entries`, which the recolor staging step populates from main's own bake output, not from arbitrary renderer input) |
| V6 Cryptography | no | not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer supplies a fabricated `entries` list on a staged recolor edit to make the tray display (and the pre-write disclosure) disagree with what actually gets forged | Tampering | Already generically handled: `buildFoundryForgeVpk`'s final step re-parses the actual output VPK (`parseVpkDirectory(output)`) and rejects the build if `actualWriteSet` disagrees with the reviewed `writeSet` (`foundryForge.ts:112-116`) — this check is kind-agnostic and needs no recolor-specific change, but the plan must not accidentally special-case recolor out of it |
| A hostile/malformed hero name or mode value reaching `buildHeroEffectVpkForExport` | Tampering / Denial of Service | Already handled: `colorCodenameForHero(req.heroName)` returns `null`/throws for an unsupported hero (`heroColors.ts:565-567`); `normalizeTrippyVfxChoice` clamps/falls back on unknown style/animation values (`heroColors.ts:257-`) rather than passing raw input to the CLI |

## Sources

### Primary (HIGH confidence) — all read directly this session, in this working tree
- `electron/main/services/foundryForge.ts` (full file)
- `src/types/foundry.ts` (full file)
- `src/components/foundry/buildTray.ts` (full file)
- `electron/main/services/foundryTextureReplace.ts` (builder signature)
- `electron/main/services/foundryCatalog.ts` (`buildHeroSoundSwapVpk`, `cleanupHeroSoundSwapBuild`)
- `src/components/foundry/RecolorTool.tsx` (full file)
- `src/components/locker/HeroEffectsPanel.tsx` (full file)
- `src/components/locker/HeroColorPicker.tsx` (lines 1-374, imports + `handleApply` + surrounding state)
- `electron/main/services/heroColors.ts` (lines 160-639: `ensureHeroColorBake`, `ensureHeroPrismBake`, `applyHeroColor`, `applyHeroPrism`, `applyHeroTrippyVfx`, `buildHeroEffectVpkForExport`, `revertHeroColor`, `getActiveHeroColor`)
- `src/types/mod.ts` (lines 210-390, 700-754: `LockerColorSelection`, `ActiveHeroColor`, `ApplyHeroColorResult`, `TrippyVfxChoice`, `FoundryBuildPart`, `FoundryBuildInfo`)
- `electron/main/ipc/foundry.ts` (lines 375-420: `foundry:exportHeroEffect` handler)
- `docs/ability-vfx-recolor.md` (full file — three color mechanisms, per-hero recipe entries, cache mechanism)
- `src/components/foundry/soundStagedEdit.ts`, `src/components/foundry/visualEdits.ts` (full files — staging pattern precedent)
- `src/components/foundry/changeList.ts` (lines 1-170 — `FoundryChangeKind`, `collectFoundryChanges`)
- `src/pages/Locker.tsx` (lines 250-500, 1190-1360, 2880-2940 — shuffle prop-threading, legacy-route rewrite effects)
- `src/stores/appStore.ts` (lines 200-320, 740-770 — `soundShuffleIncluded` state + `toggleSoundShuffleIncluded`)
- `src/lib/lockerRandomizer.ts` (`SOUND_SHUFFLE_INCLUDED_KEY`, `shuffleSoundKey`)
- `src/lib/lockerUtils.ts` (lines 1-40 — `HeroCategory` shape)
- `src/lib/lockerMode.ts` (full file — `legacySoundTarget`, `resolveLockerRoute`)
- `src/components/foundry/MyChanges.tsx` (navigation call sites, lines 145, 305-322)
- `src/components/locker/HeroSkinsPanel.tsx` (shuffle-toggle button render sites, grepped + spot-read)
- `src/components/foundry/HeroWorkshop.tsx` (lines 1-120 — props, `useAppStore` usage)
- `src/components/foundry/SoundBrowse.tsx` (imports, `useAppStore` usage — spot-read)
- `src/components/foundry/useClipPlayer.ts` (full file — pool cycling confirmation)
- `src/components/settings/ForkBuildCard.tsx` (line 47-48 — `forkPoolCycling` default)
- `electron/main/services/foundryForge.test.ts` (full file — existing test pattern)
- `vitest.config.ts`, `package.json` (test/lint/typecheck scripts)
- `src/locales/en/translation.json` (i18n key locations: `locker.randomize.*`, `foundry.*` namespace roots)
- `.planning/phases/03-foundry-completes-its-build-contract/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- None used — this phase required no external documentation lookup; everything needed was in the working tree.

### Tertiary (LOW confidence)
- A2 in the Assumptions Log (whether a `vpkmerge --list`-style flag exists for recolor recipes) — the sibling `vpkmerge`/`vpkmerge-core` Rust repo was not available to inspect in this session; the assumption is that no such flag is confirmed, so the plan should default to the eager-bake design rather than block on checking.

## Metadata

**Confidence breakdown:**
- Standard stack / reuse-vs-build: HIGH — every reused function's exact signature and cache behavior was read from source this session
- Architecture (type-widening cascade, builder cleanup semantics, staging async precedent): HIGH — verified against live code, including files CONTEXT.md's own file list does not mention
- Pitfalls: HIGH — each pitfall traces to a specific line range read this session, not a general pattern guess
- Sound-shuffle navigation contract: HIGH — found a code comment explicitly naming Foundry as the intended caller of the exact string recommended

**Research date:** 2026-08-08
**Valid until:** 30 days (stable in-repo code; re-verify if `foundryForge.ts`, `heroColors.ts`, or `buildTray.ts` change materially before planning executes)
