# Phase 3: Foundry Completes Its Build Contract - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The Foundry's combined build accepts every kind of edit the Foundry can author today, and the two authoring gaps that make a randomizer pool feel dishonest are closed.

In scope:

- REQ-foundry-forge-edit-kinds: `FoundryForgeEdit` widens from `sound | texture` to `sound | texture | recolor`, and `foundryForge.ts`'s build loop (today only pushes to `built` for sound/texture) is fixed to stay aligned once a third kind exists.
- REQ-foundry-sound-shuffle-surfacing: the existing hero-sound launch-shuffle toggle becomes reachable from Foundry, with a link back to the Locker's fuller pool view.
- REQ-foundry-pool-audition-fidelity: resolved as already-delivered doc drift (see D-03) — no code ships for this in Phase 3, but the requirement's traceability needs correcting.

Not in scope: `'model'` as a Foundry edit kind (see D-02) — no type stub, no authoring surface, no backend builder. The invariants do not move: exact normalized VPK entry paths stay the ownership key, Installed and the Locker stay the only authority for enabled state, and a failed or unreadable inspection still blocks the ambiguous action.

</domain>

<decisions>
## Implementation Decisions

**Standing instruction carried forward from Phases 1 and 6:** least code that fully satisfies the requirement, reuse existing mechanism over inventing new abstraction, and prefer the cheap side of the upstream boundary (fork-only files) over editing a file upstream also owns.

### Recolor enters the combined build

- **D-01:** Recolor authoring becomes a staged, deferred `FoundryForgeEdit` — matching the sound/texture pattern — rather than keeping its current immediate-apply behavior. `HeroColorPicker.tsx`'s `handleApply` stops calling `applyHeroColor(heroName, hue, saturation, brightness)` directly; instead it produces a staged edit (`{id, kind: 'recolor', precedence, request}`, where `request` carries hue/saturation/brightness + hero name) that only bakes into real bytes when the combined build is forged. — **Reversibility:** costly — this changes the Locker recolor UI's core interaction model from "click Apply, it's baked" to "click Apply, it's staged until Forge", which existing users' muscle memory and any doc referencing immediate-apply depend on.
- **D-02:** This requires: a new recolor request type beside `TextureReplacementRequest`/`HeroSoundSwapRequest` in `src/types/foundry.ts`; a new builder in the main process paralleling `buildTextureReplacementVpk`/`buildHeroSoundSwapVpk`; and `foundryForge.ts`'s `reviewFoundryForge`, `describeFoundryBuild`, and `buildFoundryForgeVpk` each gaining a `'recolor'` branch. The `built` array in `buildFoundryForgeVpk` (line ~94-104) only pushes for `sound`/`texture` today via an `if/else if` — this must extend to three branches or a recolor edit silently misaligns `built[index]` against `request.edits[index]`, exactly the trap the ROADMAP's own notes call out.
- **D-03:** The staged-edit shape stays a plain discriminated union member (`{id, kind, precedence, request}`), matching sound/texture exactly, so a future edit kind (if one is ever scoped) slots in the same way rather than inventing its own wiring. This is a design-generalization note, not a license to build anything for that future now — see D-04/D-05.

### Model edits: explicitly not built this phase

- **D-04:** `FoundryForgeEdit` widens to `sound | texture | recolor` only. No `'model'` union member, no type stub, no authoring UI, no backend builder. `buildTray.ts`'s existing `FoundryEditKind` type (which already lists `'recolor' | 'model'`) does not need to change — it is a renderer-only staging type already wider than the backend union, and its `'model'` case remains permanently caught by `unsupportedStagedEditKind` until a future phase decides otherwise.
- **D-05:** Rationale: ROADMAP's Phase 3 success criteria test only recolor entering the build, never model. REQUIREMENTS.md's `REQ-foundry-forge-edit-kinds` text mentions "recolor and model edits" but that reads as forward-looking framing, not a testable obligation — `PROJECT.md`'s Out of Scope list separately blocks "Foundry models, VFX, and broad thumbnail browsing (slice G)" on a trustworthy path catalog that does not yet exist. Building a type-only stub for a kind with zero consumers would be exactly the speculative scaffolding the project's own house style avoids. — **Reversibility:** reversible — adding `'model'` later is a small, additive type change whenever a model-authoring flow is actually scoped.

### Pool audition fidelity: already satisfied, doc drift

- **D-06:** REQ-foundry-pool-audition-fidelity and ROADMAP's Phase 3 success criterion 3 are treated as already delivered, not open work. `src/components/foundry/useClipPlayer.ts` already cycles through the whole pool on repeated presses of the same row (`advancePoolCursor`), gated by the existing `forkPoolCycling` setting (`ForkBuildCard.tsx`, default on). This shipped in commit `9b01c63` on 2026-07-26 — eleven days before REQUIREMENTS.md was authored (2026-08-05), which still describes the old "plays `vsnd[0]` only" problem. This is doc drift of the kind `PROJECT.md` explicitly warns about, verified against the tree rather than assumed from the doc.
- **D-07:** No code ships for audition fidelity in Phase 3. A stronger "one press plays every clip back-to-back" was considered and rejected: the existing per-press cycling already gives the user a working, off-by-a-setting choice at zero additional code, and a sequenced back-to-back player would add real complexity (queue state, interrupt/stop-mid-sequence handling) for a marginal gain over pressing the row twice — against this phase's own "deliberately bounded" framing.
- **D-08:** `REQUIREMENTS.md`'s traceability row for `REQ-foundry-pool-audition-fidelity` should be corrected to reflect delivery predates the phase (doc-drift correction), not left as "Phase 3 / Pending". This correction is planning-and-verification bookkeeping, not implementation work.

### Sound shuffle surfacing

- **D-09:** Foundry gets an inline add/remove toggle for a hero's sound launch-shuffle pool membership, plus a link to the Locker's fuller pool view for that hero — not a link-only surface. ROADMAP's own wording ("add or remove a hero sound from its launch shuffle pool without leaving Foundry, and can reach the Locker's view of that same pool from there") requires the add/remove action itself to work without leaving Foundry; a link-only surface fails that half of the criterion.
- **D-10:** The toggle currently lives only inside `src/pages/Locker.tsx`, prop-drilled (`soundShuffleIncluded`, `toggleSoundShuffleIncluded`, `shuffleKeyFor`) into a shared hero list-render component, reading/writing `appStore`'s `soundShuffleIncluded` Set and `SOUND_SHUFFLE_INCLUDED_KEY` (`src/lib/lockerRandomizer.ts`) via `toggleSoundShuffleIncluded`. This needs extracting into a small shared component or hook both `Locker.tsx` and Foundry's `HeroWorkshop.tsx`/`SoundBrowse.tsx` can call against the same `appStore` state, rather than duplicating the toggle logic.
- **D-11:** The identity key for pool membership is `shuffleSoundKey(mod)` (`src/lib/lockerRandomizer.ts`), namespaced separately from skin/card pools. Reuse this as-is; no new key scheme.

### Claude's Discretion

- Exact component/hook boundary for the extracted shuffle-toggle (D-10) — a shared presentational component with store access passed as props, or a small custom hook wrapping the `appStore` selectors, whichever is the smaller diff against `Locker.tsx`'s existing prop-threading shape.
- The recolor request type's exact field names in `src/types/foundry.ts` (D-01/D-02) — match `TextureReplacementRequest`'s existing conventions (optional `heroName` for grouping/cross-link, `thumbnailDataUrl` if a preview makes sense in the tray).
- Where the recolor builder function lives in the main process (own file vs. extending `foundryTextureReplace.ts` or a sibling) — lean toward its own fork-only file unless it is trivially small, matching the sound/texture split.
- Copy/wording for any new tray labels, the Foundry-side shuffle toggle, and the "recolor is now staged, not immediate" UX change (all i18n keys per house style).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's requirements and goal

- `.planning/REQUIREMENTS.md` §"Foundry build contract" — REQ-foundry-forge-edit-kinds, REQ-foundry-sound-shuffle-surfacing, REQ-foundry-pool-audition-fidelity, in full
- `.planning/ROADMAP.md` §"Phase 3: Foundry Completes Its Build Contract" — goal, success criteria, and the notes warning about the `built` array alignment trap

### Combined build / forge review (D-01 through D-05)

- `src/types/foundry.ts` — `FoundryForgeEdit`, `TextureReplacementRequest`, `HeroSoundSwapRequest`; the union this phase widens
- `electron/main/services/foundryForge.ts` — `reviewFoundryForge`, `describeFoundryBuild`, `buildFoundryForgeVpk`; every function here needs a `'recolor'` branch, and the `built` array alignment is the specific trap to fix
- `src/components/foundry/buildTray.ts` — the renderer-only `FoundryStagedEdit`/`FoundryEditKind` staging layer, already wider than the backend union (`'recolor' | 'model'` both present); `unsupportedStagedEditKind`, `isStagedSoundEdit`, `isStagedVisualEdit` are the pattern a new `isStagedRecolorEdit` guard should follow
- `src/components/foundry/RecolorTool.tsx` — today embeds `HeroEffectsPanel` (the Locker recolor surface) unmodified; this is the mount point that needs to change once recolor stages instead of applying
- `src/components/locker/HeroEffectsPanel.tsx`, `src/components/locker/HeroColorPicker.tsx` — `handleApply` (around line 316-359) is the exact call site calling `applyHeroColor` that D-01 redirects into staging
- `docs/ability-vfx-recolor.md` — particle recolor is a byte-faithful in-place scalar patch, never a KV3 re-encode; three colour mechanisms not two; this constraint does not change, only when the bake happens

### Sound shuffle surfacing (D-09 through D-11)

- `src/pages/Locker.tsx` — the existing shuffle toggle wiring (`soundShuffleIncluded`, `toggleSoundShuffleIncluded`, `shuffleKeyFor` prop threading around line 1357-2928) to extract from
- `src/stores/appStore.ts` — `soundShuffleIncluded` state and `toggleSoundShuffleIncluded` action (around line 217, 306, 754-758)
- `src/lib/lockerRandomizer.ts` — `SOUND_SHUFFLE_INCLUDED_KEY`, `shuffleSoundKey`; the identity-key pattern to reuse as-is
- `src/components/foundry/HeroWorkshop.tsx`, `src/components/foundry/SoundBrowse.tsx` — where the Foundry-side toggle and Locker link need to mount

### Pool audition (D-06 through D-08)

- `src/components/foundry/useClipPlayer.ts` — `advancePoolCursor`, `poolCursor`, the existing cycling behavior gated on `forkPoolCycling`
- `src/components/settings/ForkBuildCard.tsx` — the `forkPoolCycling` setting toggle and its description, the existing user-facing choice

### Upstream cost awareness

- `docs/upstream-boundary-map.md` — which of the touched files are fork-only versus shared-and-modified; `src/pages/Locker.tsx` is large and upstream-shared in parts, so the D-10 extraction should minimize its diff there specifically
- `docs/fork-divergence-policy.md` — upstream-first, fork-selective; build additively in new files; aim a change at the cheap side before writing it

### House rules that bind this phase

- `CLAUDE.md` — no em-dashes; every visible string is an i18n key; two-process security (main owns file I/O and VPK builds, renderer never gets raw file access)
- `docs/ui-conventions.md` — tokens not raw values, shared components not ad-hoc markup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `buildTextureReplacementVpk`/`buildHeroSoundSwapVpk` (main process): the two existing per-kind builders `foundryForge.ts` orchestrates. The recolor builder (D-02) follows this exact shape: build to a temp dir, return `{ vpkPath, cleanup }`.
- `unsupportedStagedEditKind`, `isStagedSoundEdit`, `isStagedVisualEdit` (`buildTray.ts`): the guard pattern a new `isStagedRecolorEdit` should extend, keyed off the serialized payload rather than a label.
- `shuffleSoundKey` (`lockerRandomizer.ts`): the identity-key function to reuse unchanged for Foundry-side shuffle toggling.
- `forkPoolCycling` setting (`ForkBuildCard.tsx`, `types/mod.ts:1291`): already gives users a working choice over pool audition behavior — the mechanism D-06/D-07 rely on to close the audition-fidelity gap without new code.

### Established Patterns

- `FoundryForgeEdit` is a discriminated union keyed on `kind`, each member `{id, kind, precedence, request}`; `foundryForge.ts` branches on `edit.kind === 'sound' | 'texture'` throughout. D-01's recolor branch follows this exactly.
- The tray's staging layer (`buildTray.ts`) is intentionally wider/looser than the backend's `FoundryForgeEdit` union — it already anticipated `'recolor'` and `'model'` as kinds before either had backend support, catching unsupported kinds at `toForgeRequest()` with a thrown error that the UI pre-checks via `unsupportedStagedEditKind`.
- `Locker.tsx` currently owns three parallel shuffle-inclusion mechanisms (skins via `shuffleIncluded`, sounds via `soundShuffleIncluded`, cards via `cardShuffleIncluded`) all threaded through the same page component's props into a shared list renderer — the extraction in D-10 only needs to touch the sound one.

### Integration Points

- `foundryForge.ts`'s `buildFoundryForgeVpk` (line 96-104): the `if (edit.kind === 'sound') {...} else if (edit.kind === 'texture') {...}` block is the exact spot the third branch and the `built` array alignment fix land.
- `RecolorTool.tsx` mounts `HeroEffectsPanel` directly with no Foundry-tray awareness today; this is the integration point where staged-recolor state needs to reach `buildTray.ts`'s edit list instead of (or before) `applyHeroColor` fires.
- `HeroWorkshop.tsx`/`SoundBrowse.tsx` (Foundry) have no shuffle-related code at all today — this is greenfield within Foundry, not a modification of existing shuffle logic there.

</code_context>

<specifics>
## Specific Ideas

- The user's standing instruction across this discussion: "consider most optimal methods," "leaves the most options open," "most intuitive and useful" — applied here as: prefer the design that generalizes cleanly (D-03) without building for hypothetical future work (D-04/D-05), prefer the mechanism that already gives the end user a real choice over inventing a new one (D-06/D-07), and follow the ROADMAP's literal wording where it already resolves an apparent open question (D-09).
- On the recolor decision specifically, the user picked staged/deferred explicitly ("1, consider most optimal methods and more in the future") — the strongest of the four decisions, not inferred.

</specifics>

<deferred>
## Deferred Ideas

- **`'model'` as a Foundry edit kind.** Explicitly declined for this phase (D-04/D-05): no authoring surface or request type exists anywhere in the codebase, ROADMAP's success criteria never test it, and "Foundry models... (slice G)" is out of scope pending a trustworthy path catalog. Revisit only when that catalog work is scoped.
- **One-press-plays-everything pool audition.** Considered and rejected in favor of the existing per-press cycling (D-07). If a future user need for it emerges beyond this phase, it is new sequencing/interrupt-handling work, not a bug fix.

### Reviewed Todos (not folded)

None — `todo.match-phase 3` returned zero matches.

</deferred>

---

*Phase: 3-Foundry Completes Its Build Contract*
*Context gathered: 2026-08-08*
