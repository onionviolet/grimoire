---
phase: 03-foundry-completes-its-build-contract
verified: 2026-08-09T01:40:00Z
status: human_needed
score: 13/14
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "A user can add or remove a hero sound from its launch shuffle pool without leaving Foundry, and the Locker reflects the same membership for that hero"
    test: "In the running app, press a sound row's shuffle toggle inside Foundry for a hero with installed sound-swap mods, then open the Locker for the same hero"
    expected: "The toggle flips its aria-pressed state, membership persists under the single soundShuffleIncluded store key, and the Locker shows the identical membership"
    why_human: "No DOM test exists in this repo (Vitest runs in a node environment); the press-to-store state transition and the cross-surface sync are not exercised by any automated test"
human_verification:
  - test: "Combined forge: in Foundry, stage one sound edit, one texture edit and one recolor edit for the same hero, open the Build tray, confirm all three appear in the reviewed write set, forge, install, and open the hero in game"
    expected: "One VPK is produced, My changes lists three rows including a Recolor row, and the hero shows the recolor in-game; nothing is installed before the forge"
    why_human: "Requires the running Electron app plus a configured Deadlock install and the real vpkmerge engine; Vitest mocks the per-kind builders and the merge"
  - test: "Bake cache intact after forge: after the combined forge, open the Locker for the same hero, go to Effects, and press Apply on the Abilities tab with the same colour parameters"
    expected: "Apply returns promptly from the shared per-hero bake cache rather than re-baking; a visibly slow re-bake means the forge deleted the cache file"
    why_human: "Cache-hit timing is runtime behavior outside Vitest's reach; the automated no-op-cleanup test proves the cleanup contract, not the real cache round trip"
  - test: "Two tabs, two behaviours: in Foundry open the Effects panel for a hero; on Abilities press Stage, then switch to Body plus Gun and press Apply"
    expected: "Abilities adds a tray row and installs nothing; Body plus Gun bakes immediately with no tray row; each tab's caption matches what it just did"
    why_human: "Interaction-model distinction inside one mounted panel is a UX behavior; no DOM test infrastructure exists in this repo"
  - test: "Staging spinner: pick a VFX-heavy hero on a cold cache and press Stage"
    expected: "The button holds its spinner and staging label for the whole bake/entry-discovery wait with no idle dead time"
    why_human: "Duration and perceived responsiveness are runtime behaviors; the in-flight affordance wiring is code-verified only"
  - test: "Re-stage: stage a recolor, change the hue, stage again"
    expected: "The tray still holds exactly one recolor row for that hero (per-hero id replaces in place) and the status line reads correctly"
    why_human: "Replace-in-place across two staging entry points is an interactive flow; the id contract is unit-tested, the live tray behavior is not"
  - test: "Partial VFX detection: if a hero's ability VFX layers only partly extract, stage it and observe the button"
    expected: "The button either states which layers will be staged or stages silently; the outcome is recorded so the behavior is not assumed"
    why_human: "Whether detectVfxLayer reports per-layer partial success is not established by any artifact; this backstop (UI-SPEC E1 partial) needs an in-app observation"
  - test: "Long label: switch to the longest shipped locale and check the Stage labels"
    expected: "The mode-specific staging labels stay on one line (or wrap acceptably); the status line and caption wrap rather than clipping"
    why_human: "Localized text width is a rendering concern; no DOM/layout test exists"
  - test: "Recolor row completeness: look at the Recolor row in My changes next to a Sound and a Texture row"
    expected: "The recolor row reads as complete without a preview affordance and is the same height as the other rows"
    why_human: "Visual completeness is UI-SPEC backstop E3; no DOM test exists"
  - test: "Shuffle write failure and cross-surface sync: toggle a hero's sound into the shuffle pool from Foundry, then navigate to the Locker for that hero"
    expected: "The Locker shows the same membership; no toggle press ever leaves a pressed button whose membership did not actually change (failed write reverts aria-pressed)"
    why_human: "Cross-page Zustand sync and failure-revert are runtime behaviors; the pure helpers are unit-tested, the live surfaces are not"
  - test: "Locker link fallback: use the Open in Sound Locker link for a hero whose display name may not match the Locker roster exactly"
    expected: "It lands on the hero's Sound Locker view when the name resolves, and on the unfiltered Locker grid (never a silently empty filtered view) when it does not"
    why_human: "The route-resolution logic is unit-tested; the live navigation round trip with real roster names is UI-SPEC backstop E5"
---

# Phase 3: Foundry Completes Its Build Contract Verification Report

**Phase Goal:** The Foundry's combined build accepts every kind of edit the Foundry can author, and the two authoring gaps that make a pool feel dishonest are closed
**Verified:** 2026-08-09T01:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (no previous 03-VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A recolor staged in Foundry appears in the build tray's reviewed write set and forges into the same named VPK as a sound edit and a texture edit, rather than being refused | ✓ VERIFIED | `reviewFoundryForge`/`describeFoundryBuild`/`buildFoundryForgeVpk` branch on `kind: 'recolor'` with `never`-guarded chains (foundryForge.ts); `foundry:prepareRecolorStage` resolves `{ entries }` only; `prepareRecolorStagedEdit`/`isStagedRecolorEdit`/`toForgeRequest` stage and serialize the recolor; 3-kind merge + alignment tests pass (72/72 in phase test files) |
| 2 | A user can add or remove a hero sound from its launch shuffle pool without leaving Foundry, and the Locker reflects the same membership | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wired: SoundBrowse reads/writes the same `soundShuffleIncluded` Set via `toggleSoundShuffleIncluded` keyed by `shuffleSoundKey`; `heroSoundShuffleRows`/`soundLockerHref` covered by 10 passing unit tests. Press-to-store transition and cross-surface sync have no test (no DOM tests in repo) — see Human Verification |
| 3 | Foundry offers a link that lands on the Locker's view of that hero's sounds | ✓ VERIFIED | `soundLockerHref` builds `/locker/sounds?hero=<encoded name>`; `resolveLockerRoute` + legacy rewrite resolve the name via `canonicalHeroName` to `/locker/hero/<id>?section=sounds`; lockerMode.test.ts (13 tests) covers the route contract |
| 4 | Auditioning a randomizer pool plays every clip in the pool | ✓ VERIFIED | `poolCursor`/`advancePoolCursor` walk the pool, wrap, normalize stale/negative cursors, stay at 0 for single-clip/empty pools (useClipPlayer.ts); 8 passing unit tests exercise the transition; hook wired to playback gated on default-on `forkPoolCycling`; REQUIREMENTS.md records delivery pre-phase with commit `9b01c63` + source evidence |
| 5 | Staging a recolor installs nothing; unreadable mods, empty bakes, and declined acknowledgement are refused | ✓ VERIFIED | `prepareRecolorStagedEdit` only discovers entries, inspects sources, confirms, and returns an edit; throws on unreadable (names the mods), throws on empty entries, returns null on decline; 13 staging tests pass |
| 6 | `built[i]` corresponds to `request.edits[i]` for every kind; a future kind fails typecheck via `never` guard | ✓ VERIFIED | Each arm of the `built` loop pushes exactly one entry; `never`-typed `else` in all three kind-branching functions; named alignment test passes; `pnpm typecheck` green |
| 7 | `buildRecolorVpk` cleanup is a no-op; the shared per-hero bake cache survives a forge | ✓ VERIFIED | `cleanup: async () => {}` and no fs deletion in foundryRecolor.ts; test "invokes the recolor part cleanup and leaves the shared bake cache file in place" passes |
| 8 | Re-staging a recolor replaces in place (one tray row per hero) | ✓ VERIFIED | Staged-edit id is `recolor:<canonical hero name>`; `Foundry.tsx`/`HeroWorkshop.tsx` dedupe by id; id-derivation test passes |
| 9 | A forged build's recolor part lists as its own labelled Recolor row in My changes, with an exhaustive kind mapping and neutral fallback | ✓ VERIFIED | `KIND_ICONS` maps recolor to Palette with FileQuestion fallback; `kindLabelOf` renders accent Recolor tag / neutral Change; `changeFilterOf` returns `'other'` with compile-time `never` guard (WR-03 fix); mixed-build tests pass. Visual completeness is a human item |
| 10 | The workshop Appearance section stages into the same single tray row as the Recolor sub-tool | ✓ VERIFIED | HeroWorkshop passes `onStageRecolor={stage}`; same `prepareRecolorStagedEdit` per-hero id; tray dedupes. Interactive flow is a human item |
| 11 | The Abilities surface states it stages; the Body plus Gun surface states it applies immediately; the Locker mount says neither | ✓ VERIFIED | Captions gated on `onStageRecolor` in HeroEffectsPanel; `abilitiesStageNote`/`appliesImmediately` keys exist; LockerHero mounts without the prop; TrippySkinPanel `handleApply`/`applyTrippySkin` unchanged (WR-01 Remove guard also verified). Visual rendering is a human item |
| 12 | REQUIREMENTS.md traceability for REQ-foundry-pool-audition-fidelity corrected with commit + source evidence | ✓ VERIFIED | Row cites `9b01c63` (2026-07-26), useClipPlayer.ts, ForkBuildCard.tsx, D-06..D-08; no Pending row remains |
| 13 | One shared ShuffleToggleButton serves both surfaces; no second pool store or key | ✓ VERIFIED | Single component (import + 2 call sites in HeroSkinsPanel; used by SoundBrowse); `aria-pressed` present; no inline copy remains; no second `Set`/key in foundrySoundShuffle.ts; key-identity test passes |
| 14 | A hero with zero installed sound-swap mods renders no shuffle section and no Locker link | ✓ VERIFIED | SoundBrowse renders the block only when `heroScoped && shuffleRows.length > 0`; no empty-state banner added |

**Score:** 13/14 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `src/types/foundry.ts` | `RecolorForgeRequest` + `recolor` union member | ✓ VERIFIED | 427 lines; `RecolorForgeRequest extends HeroEffectExportRequest` with `entries: string[]`; `FoundryForgeEdit` third member |
| `electron/main/services/foundryRecolor.ts` | `buildRecolorVpk`, `discoverRecolorEntries` | ✓ VERIFIED | 45 lines; real-bake discovery via `parseVpkDirectory`; no-op cleanup; no fs deletion |
| `electron/main/services/foundryForge.ts` | Recolor branches + `never` guards | ✓ VERIFIED | 180 lines; all three kind-branching functions explicit + exhaustive |
| `src/components/foundry/recolorStagedEdit.ts` | `prepareRecolorStagedEdit` + types | ✓ VERIFIED | 81 lines; plus `findStagedRecolorForHero` (WR-02 fix); refusal paths implemented |
| `src/components/foundry/buildTray.ts` | `isStagedRecolorEdit` + third `toForgeRequest` arm | ✓ VERIFIED | 166 lines; tray guard and serialization correct; recolor adds no source file |
| `src/components/foundry/ShuffleToggleButton.tsx` | Single shared toggle | ✓ VERIFIED | 53 lines; aria-pressed, i18n labels, stopPropagation, className positioning |
| `src/lib/foundrySoundShuffle.ts` | `heroSoundShuffleRows`, `soundLockerHref` | ✓ VERIFIED | 46 lines; canonical-hero filter, exact `shuffleSoundKey` reuse, encoded href |
| `src/components/foundry/SoundBrowse.tsx` | Hero-scoped shuffle block + Locker link | ✓ VERIFIED | 1431 lines; reads/writes appStore directly; renders only for hero-scoped non-empty rows |
| `src/components/foundry/MyChanges.tsx` | Recolor row (Palette, Recolor tag, fallback) | ✓ VERIFIED | 671 lines; exhaustive `KIND_ICONS`, `kindLabelOf`, reforge source check returns `[]` for recolor |
| `src/components/foundry/changeList.ts` | Exhaustive `changeFilterOf` | ✓ VERIFIED | 226 lines; recolor → `other`, `never` guard, runtime fallback returns `'other'` (WR-03 fix) |
| `src/components/foundry/HeroWorkshop.tsx` | Appearance mount with `onStageRecolor` | ✓ VERIFIED | 379 lines; `onStageRecolor={stage}`; tray-derived `stagedRecolorEdit` |
| `src/components/locker/HeroEffectsPanel.tsx` | `onStageRecolor` + both captions | ✓ VERIFIED | 135 lines; captions gated on prop; forwards to HeroColorPicker |
| `src/components/foundry/useClipPlayer.ts` | Pool cycling (delivered pre-phase) | ✓ VERIFIED | 151 lines; `poolCursor`/`advancePoolCursor` + `forkPoolCycling` gate |
| `src/lib/foundrySoundShuffle.test.ts` | Helper coverage | ✓ VERIFIED | 94 lines, 10 cases, all pass |
| `electron/main/services/foundryForge.test.ts` | Alignment + recolor contract tests | ✓ VERIFIED | 302 lines; alignment/cleanup/collision cases pass |
| `src/components/foundry/changeList.test.ts` | Mixed build + recolor shelfing | ✓ VERIFIED | 227 lines; 19+ cases pass |
| `src/locales/en/translation.json` | 14 new keys | ✓ VERIFIED | All keys present with ASCII copy; i18n:check passes (2604 referenced keys) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| `HeroColorPicker.tsx` | `recolorStagedEdit.ts` | `handleApply` calls `prepareRecolorStagedEdit` when `onStage` supplied | WIRED | Lines 340-362; Locker mount unchanged |
| `recolorStagedEdit.ts` | `electron/main/ipc/foundry.ts` | `discoverEntries` → `foundryPrepareRecolorStage` → `foundry:prepareRecolorStage` | WIRED | IPC + preload + api.ts + electron.ts all present; handler returns `{ entries }` only |
| `buildTray.ts` | `foundryForge.ts` | `toForgeRequest` serializes `kind: 'recolor'` that `buildFoundryForgeVpk` branches on | WIRED | Lines 170, and forge loop third arm |
| `foundryForge.ts` | `foundryRecolor.ts` | `buildRecolorVpk` in the third `built` branch | WIRED | Import + call verified |
| `SoundBrowse.tsx` | `appStore.ts` | `soundShuffleIncluded` + `toggleSoundShuffleIncluded` directly from `useAppStore` | WIRED | No prop threading, no second key |
| `foundrySoundShuffle.ts` | `lockerRandomizer.ts` | `shuffleSoundKey` reused unchanged | WIRED | Import + key-identity test |
| `HeroSkinsPanel.tsx` | `ShuffleToggleButton.tsx` | Both inline buttons replaced by shared component | WIRED | Import + 2 call sites; no inline copy |
| `SoundBrowse.tsx` | Locker route | `soundLockerHref` → `/locker/sounds?hero=` → `resolveLockerRoute` → hero page | WIRED | Route logic unit-tested; live navigation is human item |
| `HeroWorkshop.tsx` | `HeroEffectsPanel.tsx` | `onStageRecolor={stage}` | WIRED | Line 331 |
| `changeList.ts` | `MyChanges.tsx` | recolor row flows through `collectFoundryChanges` | WIRED | Mixed-build test + render path verified |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `prepareRecolorStagedEdit` → tray | `affectedFiles` / `request.entries` | `discoverRecolorEntries` parses the real bake output (`parseVpkDirectory` on `buildHeroEffectVpkForExport` result) | Yes | ✓ FLOWING |
| `buildFoundryForgeVpk` | actual write set | Real merged VPK re-parsed and compared to reviewed write set before export | Yes | ✓ FLOWING |
| SoundBrowse shuffle rows | `soundShuffleIncluded` | appStore Set persisted under `SOUND_SHUFFLE_INCLUDED_KEY` (localStorage) | Yes | ✓ FLOWING |
| MyChanges recolor row | `entries`/`kind` | `describeFoundryBuild` main-derived parts, not renderer labels | Yes | ✓ FLOWING |
| `useClipPlayer` audition | `clip.vsnd[cursor]` | Indexed pool from real catalog entries | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Forge/review/staging/shuffle/change-list contracts | `pnpm exec vitest run foundryForge.test.ts recolorStagedEdit.test.ts buildTray.test.ts foundrySoundShuffle.test.ts useClipPlayer.test.ts changeList.test.ts` | 6 files, 72 tests passed | ✓ PASS |
| Compile-time exhaustiveness (`never` guards, widening cascade) | `pnpm typecheck` | exit 0 | ✓ PASS |
| Lint | `pnpm lint` | exit 0 | ✓ PASS |
| i18n keys | `pnpm i18n:check` | exit 0, 2604 referenced keys exist | ✓ PASS |
| Encoding | `pnpm encoding:check` | exit 0, clean (640 files) | ✓ PASS |
| Real-engine combined forge + in-game recolor | (requires Deadlock install + running app) | not run | ? SKIP → human verification |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | No probes declared in PLAN/SUMMARY and no `scripts/*/tests/probe-*.sh` exist for this phase | n/a | N/A (not applicable) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-foundry-forge-edit-kinds | 03-01, 03-03 | Recolor enters the combined build (staged edit, tray write set, merged VPK, My changes row) | ✓ SATISFIED | Types/forge/staging/tray/UI all wired; alignment + contract tests pass; live in-engine confirmation is a human item |
| REQ-foundry-sound-shuffle-surfacing | 03-02 | Shuffle pool editable from Foundry with a Locker link | ✓ SATISFIED | Shared toggle + helpers + SoundBrowse block + route link; live cross-surface sync is a human item |
| REQ-foundry-pool-audition-fidelity | 03-02 | Audition plays every clip in the pool | ✓ SATISFIED | Delivered pre-phase (9b01c63); cursor invariant unit-tested; traceability corrected with evidence |

No orphaned requirements: all three Phase 3 requirements are claimed by plans 03-01/03-02/03-03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers in any phase-modified file | — | None |
| — | — | `placeholder=` hits are i18n input placeholders and the `{{mods}}` substitution comment, not stubs | ℹ️ Info | None |

Code-review warnings WR-01 (Foundry mount exposed immediate-apply Remove), WR-02 (status line not bound to tray state), WR-03 (`changeFilterOf` throw defeating the neutral fallback) were all fixed in HEAD (`cf1d169`, `588e060`, `fe46fad`, `ff0bbc3`, `937db16`) and re-verified in the working tree.

### Human Verification Required

The phase's own checkpoint (03-03 Task 3, `gate: blocking` human-verify, 10-step in-game pass) was auto-approved under auto mode without running; the manual rows from 03-VALIDATION.md and the UI-SPEC backstops (E1 loading/partial/long-text, E2 partial, E3 partial, E4 error, E5 error) are harvested below. The 03-01 unrun verify (Stage produces a tray row, installs nothing) is folded into item 1.

1. **Combined forge end to end** — Test: stage sound + texture + recolor for one hero, review the tray write set, forge, install, open in game. Expected: one VPK, three My changes rows including Recolor, in-game recolor. Why human: needs the running app, a Deadlock install, and the real vpkmerge engine; Vitest mocks the builders.
2. **Bake cache intact after forge** — Test: after the forge, press Locker Apply with the same parameters. Expected: prompt cache hit, no re-bake. Why human: cache round-trip timing is runtime behavior.
3. **Two tabs, two behaviours** — Test: Abilities Stage vs Body plus Gun Apply in one panel. Expected: stages vs applies immediately, captions match. Why human: interaction-model distinction inside one mounted panel.
4. **Staging spinner covers the whole wait** — Test: VFX-heavy hero on a cold cache. Expected: button holds spinner/label for the entire async bake. Why human: duration/responsiveness (E1 loading).
5. **Re-stage replaces in place** — Test: stage, change hue, stage again. Expected: exactly one recolor tray row; status line truthful. Why human: interactive replace-in-place (E1 zero-one-many / E2 partial).
6. **Partial VFX detection** — Test: stage a hero whose layers only partly extract. Expected: button names the layers staged or the outcome is recorded. Why human: E1 partial, not established by any artifact.
7. **Long-label in longest shipped locale** — Test: switch locale, check Stage labels and captions. Expected: labels stay on one line; text wraps, not clips. Why human: E1 long-text / E2 long-text, layout rendering.
8. **Recolor row completeness** — Test: view Recolor row beside Sound and Texture rows in My changes. Expected: reads complete without a preview, same row height. Why human: E3 partial.
9. **Shuffle toggle failure + cross-surface sync** — Test: toggle from Foundry, check Locker; attempt a failed write. Expected: same membership in both; pressed state reverts if a write fails. Why human: E4 error + live Zustand sync across pages.
10. **Locker link fallback** — Test: use Open in Sound Locker for a hero whose display name may not match the roster. Expected: hero's sounds when matched; unfiltered grid (never silently empty) when not. Why human: E5 error, live navigation round trip.

### Gaps Summary

No failed truths, missing artifacts, broken links, or blocker anti-patterns were found. The phase goal is achieved at the code level: the recolor is a first-class staged Foundry edit that forges into the combined VPK alongside sound and texture (alignment locked by `never` guards and a passing test), the Foundry sound surface edits the same launch-shuffle pool the Locker reads with a deep link to it, and pool audition walks the whole pool. One truth (shuffle membership sync) is present and wired but behaviorally unexercised, and ten in-app/game-install behaviors from the phase's own deferred human checkpoint remain unverified because the checkpoint auto-approved without running. Those route this phase to human verification, not to gap closure.

---

_Verified: 2026-08-09T01:40:00Z_
_Verifier: the agent (gsd-verifier)_
