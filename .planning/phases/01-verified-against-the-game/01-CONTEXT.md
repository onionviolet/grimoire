# Phase 1: Verified Against The Game - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase turns four requirements' worth of landed-but-unproven work into recorded evidence, and builds the one piece of tooling (a DOM render harness) without which several of those lanes cannot be checked at all.

In scope:

- REQ-ingame-verification-sweep: human-run checks against a running Deadlock build, recorded
- REQ-renderer-test-harness: render tests for six shipped Foundry lanes plus the Chat Wheel VPK round trip
- REQ-rigged-preview-release-gate: a measured fps number on Seven (`gigawatt_prisoner`), a written recommendation, and that recommendation applied to `RELEASE_RENDER_FLAGS.rigged`
- REQ-performance-convar-safer-experimentation: engine defaults read off a running build and recorded in code

Not in scope: new user-facing capability of any kind. Where a decision would require building a mechanism that does not exist (a per-hero preview allowlist, auto-apply of performance settings), the finding is recorded and routed out rather than built here.

</domain>

<decisions>
## Implementation Decisions

### Render harness

- **D-01:** Render tests extend the existing precedent rather than introducing a library. `src/components/common/HeroSelect.test.tsx` already renders under jsdom with raw `react-dom/client` + `act` and no testing-library; it passes today (5 tests, 2.2s, verified 2026-08-06). New render tests follow that shape.
- **D-02:** `jsdom` is added to `devDependencies` explicitly. It is currently absent from `package.json` entirely and resolves only as a hoisted transitive copy (24.1.3), so the one passing render test works by accident of the lockfile.
- **D-03:** Each test file declares its environment with a per-file `// @vitest-environment jsdom` pragma. `vitest.config.ts` is not modified. — **Reversibility:** reversible — a glob rule can replace the pragmas later in one edit if the boilerplate becomes a problem.
- **D-04:** Each of the six lanes gets an interaction-depth test that drives the behavior the lane shipped for, not a mount-without-throwing smoke check. Lanes: pool cards, alternatives gallery, audition preview, sound trim/gain badges, seeded `SoundImportEditor`, portrait editor.
- **D-05:** The Chat Wheel round trip is real: build a VPK from `resources/chatlane/starter.yml` through `buildChatWheelVpk`, read it back through `readChatWheelVpk`, assert the YAML survives. Not a stub, not a golden fixture.
- **D-06:** That test guards on `chatLaneBinaryPath()` resolving and skips when the binary is absent, so it runs on Windows locally and CI stays green on `ubuntu-latest`. No `.github/workflows/ci.yml` change. — **Reversibility:** reversible — adding a Windows CI job later is additive.

### Evidence record

- **D-07:** All human-gated evidence lives in one new fork-only doc under `docs/`, one row per check, sitting beside `docs/rigged-preview-spike.md` as the same kind of artifact.
- **D-08:** A passing check is a written verdict naming what was run and what happened. A failing check additionally attaches the screenshot, clip, or log that shows it.
- **D-09:** A plan scaffolds the record with every row present and empty (exact steps, the mod or hero to use, what a pass looks like, verdict blank). The user runs the game session and fills the verdicts in. No agent can run Deadlock.
- **D-10:** The phase is not done while any row is blank. `blocked`, with a stated reason, is a legitimate verdict for a check whose preconditions are unavailable. — **Reversibility:** reversible — this is a completion rule, not a code change.

### Failure handling

- **D-11:** A failed in-game check produces a verdict row plus a written root-cause note. Only then is in-phase fix versus new phase decided. Neither "always fix here" nor "always route out" applies.
- **D-12:** The user makes that call. The agent proposes a size first: files touched, whether it crosses the main/renderer process boundary, whether it moves a shipped format.

### ConVar defaults

- **D-13:** A new `engineDefault` field is added beside `gameDefault` in `electron/main/services/performanceUserControls.ts`. `gameDefault` keeps its existing meaning (what stock `gameinfo.gi` writes, where `null` means the key is unset and so `off` is a written value rather than a removal). `engineDefault` carries what the console reports. — **Reversibility:** costly — the two fields feed the four-state badge logic in `convarStates`; collapsing them later means re-deciding every consumer's branch.
- **D-14:** `citadel_damage_offscreen_indicator_disabled` is recorded as the raw console value with a comment stating the inversion, and its `on`/`off` mapping is re-checked against the reading. Values are not normalized at the source.
- **D-15:** `citadel_hud_objective_health_enabled` is currently commented as unsupported. The reading either confirms or contradicts that, and the comment is corrected either way.
- **D-16:** The only UI effect this phase is the badge: `convarStates` gains the engine value so an untagged stock line stops being badged "Your override" and an unset toggle can show what the game will do. No new controls. Today's per-control reset keeps removing Grimoire's line rather than writing an app-chosen number, which was a deliberate decision.

### Rigged preview gate

- **D-17:** The decision resolves to `RELEASE_RENDER_FLAGS.rigged` true or false, plus the written recommendation. No per-hero mechanism and no user-facing setting are built. If the measurement argues for per-hero, that is a recorded finding and its own phase.
- **D-18:** The spike's step 3 (roster-wide `model clips --json` sweep, no export) runs only if the fps reading argues for shipping. If the number says gate, the sweep is skipped.

### Amendment 2026-08-06: verify in the app, not in the game

D-09 and D-10 were written on the belief that the sweep needs a Deadlock session. That belief was wrong about most of it and is corrected here rather than edited above, so the record of what changed survives.

- **D-19:** Every row of the verification record carries a Tier. `app` means the running app can settle it over CDP; `engine` means only a running Deadlock can. The split is 23 app rows (IG-01..20, RP-01..03) and 18 engine rows (IG-21, IG-22, CV-01..16). Verified 2026-08-06 against a slot-3 dev build: the renderer exposes 266 `window.electronAPI` methods, including `foundry.forge`, `foundry.forgeInstall`, `foundry.auditionSourceClip`, `mergeMods`, `analyzeMerge`, `enableMod`, and `disableMod`.
- **D-20:** An app-tier check asserts bytes and app state, not perception. The forged VPK holds the expected entry path with the expected bytes; `getMods()` holds the expected entries; the pool picker returned more than one distinct clip. Where the old row said "hear the sound", the new row compares the bytes the audition played against the bytes at that entry inside the VPK. For IG-06 this is a stronger check than the one it replaces.
- **D-21:** D-09's "no agent can run Deadlock" stands and is the whole reason for the `engine` tier. Its second clause, that no headless process can produce an fps number, does not: a rAF sampler driven over CDP produces exactly that. RP-03 stops being a human checkpoint. 01-07 is amended accordingly.
- **D-22:** A fourth verdict, `deferred`, is added and is legal only on an engine row. It differs from `blocked`: `blocked` means the check could not run and someone still owes it, `deferred` means the project has consciously accepted the engine half untested for now. It requires a per-row reason. `deferred` on an app row is an error, because an app row has a runner that can settle it. — **Reversibility:** reversible — the guard rule is a dozen lines and the record is a document.
- **D-23:** D-10 is superseded. The phase is done when `--strict` exits 0, which it can now reach without a game session: every app row settled by the runner, every engine row carrying a reasoned `deferred`. What this does not do is prove the engine loads what Grimoire wrote, and the record says so in its own preamble rather than leaving the reader to infer it.
- **D-24 (2026-08-06, after verification):** IG-01 and IG-02 stay `blocked` and the project accepts that for this phase. Verification found them blocking ROADMAP Success Criterion 1, which is stated as a plain fact that must be true, and correctly refused to treat "blocked for a good reason" as the same thing as "accepted". This is that acceptance, made explicitly rather than by default. IG-01 needs the fork's locally-built vpkmerge engine for the texture half (the bundled release binary rejects texture replacement without the YCoCg icon fix), and IG-02 needs a main-process hook to cancel `dialog.showSaveDialog`, which no renderer-reachable script can drive. Faking the cancellation was rejected as dishonest evidence (T-01-26), and that call stands. Both are additive later: build the sibling engine and run `pnpm use-local-vpkmerge` for IG-01, add a test hook for IG-02, then re-run `pnpm verify:in-app` and the rows settle with no other change. The verdict stays `blocked` and does NOT become `deferred`, because D-22 makes `deferred` legal only on an engine row and these are app rows with a runner that could settle them given the two pieces above. The distinction is the point: someone still owes these two, and the record must keep saying so.
- **D-24:** The runner is not wired into CI. `ci.yml` runs on `ubuntu-latest` with no GPU, no Electron display, and no game install, so adding it there would produce a red gate nobody can fix.
- **D-25:** `engineDefault` in `performanceUserControls.ts` stays `null` while CV-01..16 are deferred. That is now a stated state with a reason on record, not an unfinished one.

### Claude's Discretion

- Whether the six render tests share a fixture module or keep the codebase's existing inline-factory convention (`TESTING.md` documents inline factories with no shared `fixtures/` directory).
- The exact filename and row schema of the verification record doc.
- Which specific mod, hero, and multi-clip pool serve as fixtures for each in-game check. These get proposed in the scaffold; the user can substitute at run time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rigged preview gate

- `docs/rigged-preview-spike.md` §8 - the exact checks a human must run on Seven, including which one is the gate
- `docs/rigged-preview-spike.md` §9 - the ship-gated recommendation and its four concrete next steps. Note step 1 (decouple rigged from cloth) is already done: `src/components/locker/heroPoseRenderFeatures.ts:55` gives rigged its own flag, asserted by `src/components/locker/HeroPoseViewer.test.ts:162`
- `docs/rigged-preview-spike.md` §10 - the commands that reproduce the measurements

### Performance ConVars

- `docs/performance-config-integration.md` - patch in place never replace, never touch FileSystem or SearchPaths, `performanceConfigData.ts` is generated and never hand-edited
- `electron/main/services/performanceUserControls.ts` - the hand-maintained fork-owned module holding `HUD_CONVARS` and the numeric controls, deliberately kept out of the generated file. Its header comment explains why regenerating once destroyed these lists

### Fork and upstream cost

- `docs/upstream-boundary-map.md` - 169 fork-only files cost nothing at merge, 97 shared-and-modified files are paid for again at each absorption. Aim a change at the cheap side before writing it
- `docs/fork-divergence-policy.md` - upstream-first, fork-selective; thin vertical slices; build additively in new files

### Requirements and prior verdicts

- `.planning/REQUIREMENTS.md` - the four Phase 1 requirements in full, plus the "Delivered" table that outranks any doc's own status line
- `.planning/codebase/TESTING.md` - existing Vitest conventions: co-located `*.test.ts`, inline factory functions, no `vi.mock()`, no shared fixtures directory. Note its claim that no DOM exists anywhere is stale by one file
- `docs/audit-2026-07-28-verdicts.md` - verified ground truth from the spec audit; held out of `.planning/intel/` by a cross-reference cycle, so read it directly
- `docs/feature-status.md` - the delivery contract; also held out of `.planning/intel/` by the same cycle

### House rules that bind this phase

- `CLAUDE.md` - no em-dashes anywhere; every visible string is an i18n key; `pnpm encoding:check` and `pnpm i18n:check` are gates
- `docs/ui-conventions.md` - tokens not raw values, shared components not ad-hoc markup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/components/common/HeroSelect.test.tsx`: the working template for every new render test. Per-file jsdom pragma, `IS_REACT_ACT_ENVIRONMENT`, `createRoot`, a local harness component that mirrors the real parent's behavior, `beforeEach`/`afterEach` root lifecycle.
- `electron/main/services/chatWheel.test.ts`: existing Chat Wheel test that stubs the child process with `child.emit('close', 0)`. The new round-trip test departs from this deliberately; the existing stubbed tests stay.
- `docs/rigged-preview-spike.md`: the shape the verification record doc should follow. It already separates measured from estimated from unverifiable, which is exactly the distinction the sweep record needs.
- `electron/main/services/performanceConfig.test.ts`: existing coverage of the apply path against a temp game root, so ConVar work has a test harness already.

### Established Patterns

- Vitest runs `environment: 'node'` by default; a DOM is opted into per file. `vitest.config.ts` already includes `src/**/*.test.tsx` in its glob, so no config change is needed to pick up new render tests.
- Test data comes from inline factory functions with overridable fields, not a fixtures directory.
- `applyPerformanceConfig` already persists user overrides per preset in a sidecar (`overridesByPreset`), harvests hand edits on every reapply, and re-layers them. Saving user ConVar changes is delivered; nothing to build.
- `chatLaneBinaryPath()` picks the executable name off `process.platform` and throws when absent. That throw is the natural skip signal for the round-trip test.

### Integration Points

- `src/components/locker/HeroPoseViewer.tsx:113` - `RELEASE_RENDER_FLAGS.rigged` is the single value the rigged gate decision writes to.
- `electron/main/services/performanceUserControls.ts:29-53` - `HUD_CONVARS` (7 boolean toggles, all `gameDefault: null`) and the numeric controls are where `engineDefault` lands.
- `electron/main/services/performanceConfig.ts` - `convarStates` computes the four-state badge and is the consumer that must learn the new field.
- `resources/chatlane/` - `ChatLane.exe`, `starter.yml`, and two Windows DLLs, all tracked in git. There is no Linux binary, which is why the round-trip test skips rather than fails on CI.

</code_context>

<specifics>
## Specific Ideas

- The user's standing constraint for this phase: upstream is actively developed, so keep merge cost in mind on every choice. This is why the harness uses per-file pragmas instead of a `vitest.config.ts` rule, why the Chat Wheel test skips instead of adding a Windows CI job, and why the verification record is a new fork-only doc rather than an edit to an existing shared one. The only shared-file edits this phase should make are one `package.json` devDependency line and the `performanceUserControls.ts` field addition.
- `citadel_damage_offscreen_indicator_disabled` is to be checked first among the ConVars, per the requirement's own instruction, because it is an inverted flag.
- Seven (`gigawatt_prisoner`) is the fps subject specifically because the spike identifies it as the worst case on every axis. Cloth stays off for the measurement.

</specifics>

<deferred>
## Deferred Ideas

- **Auto-apply of performance settings.** The user asked for saved settings to be applied automatically. Saving already works (`overridesByPreset` in the sidecar, harvested and re-layered on every apply), but nothing reapplies on launch or after a game update; every apply is user-initiated. This is new capability and maps to the deferred `REQ-performance-convar-profiles-and-recovery`, whose Phase C is a "compatibility manifest checked on launch". If it is wanted sooner than v2 it needs its own phase, not a Phase 1 task.
- **Per-hero rigged preview allowlist.** No mechanism exists near `RELEASE_RENDER_FLAGS`. Only built if the fps measurement actually argues for it, and then as its own phase.
- **Reset-to-engine-default action** on ConVar controls. Becomes possible once `engineDefault` is populated, but today's per-control reset deliberately removes Grimoire's line rather than writing an app-chosen number, so changing it is a decision, not a follow-through.
- **A Windows CI job.** Would let the Chat Wheel round trip gate on every push. Additive whenever it is wanted; costs a shared workflow file edit.

</deferred>

---

*Phase: 1-Verified Against The Game*
*Context gathered: 2026-08-06*
