# Phase 1: Verified Against The Game - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 1-Verified Against The Game
**Areas discussed:** Render harness shape, Evidence record, ConVar default meaning, What a failed check does, Rigged preview release gate

**Standing constraint stated by the user at area selection:** upstream is actively developed, so keep merge cost in mind throughout. Confirmed on follow-up that this was the only additional constraint.

---

## Render harness shape

**Correction applied before the questions:** REQUIREMENTS.md and `.planning/codebase/TESTING.md` both state Vitest has no DOM. `src/components/common/HeroSelect.test.tsx` carries a `// @vitest-environment jsdom` pragma and was run during discussion: 5 tests pass in 2.2s. `jsdom` is absent from `package.json` and resolves as a hoisted transitive copy (24.1.3).

### Q1: What renders the untested lanes in a check?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the jsdom pragma | HeroSelect pattern, raw react-dom/client + act, no new library. Near-zero upstream cost; one devDependency line | ✓ |
| Add @testing-library/react | Query-by-role plus user-event; two package.json lines and realistically a setup file wired into vitest.config.ts | |
| Vitest browser mode | Real Chromium via Playwright; highest fidelity, highest shared-surface cost, overkill with no WebGL lane | |

**User's choice:** Extend the jsdom pragma
**Notes:** The six lanes named by REQ-renderer-test-harness are DOM surfaces, not WebGL ones, so no lane required a real GPU context.

### Q2: How does a test file get its DOM environment?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file pragma | vitest.config.ts never touched; one line of boilerplate per file | ✓ |
| Glob rule in vitest.config.ts | No pragma to forget; costs a shared config edit and silently flips any upstream .test.tsx that assumed node | |
| Separate render test project | Clean separation but vitest.config.ts still has to reference the project | |

**User's choice:** Per-file pragma

### Q3: How deep does each lane's render test go?

| Option | Description | Selected |
|--------|-------------|----------|
| Interaction on the shipped behavior | Drives what each lane was built for; catches what a model test cannot; roughly one focused file per lane | ✓ |
| Smoke render only | Mounts without throwing plus key strings; cheap, catches crashes and missing i18n keys, not wrong behavior | |
| One deep, rest smoke | Full interaction on the seeded SoundImportEditor, smoke for the other five | |

**User's choice:** Interaction on the shipped behavior

### Q4: How is the Chat Wheel VPK round trip tested?

| Option | Description | Selected |
|--------|-------------|----------|
| Real ChatLane, real temp VPK | Build from starter.yml, read back, assert YAML survives; departs from the existing stubbed test and needs the binary | ✓ |
| Checked-in golden VPK | Read half only; runs anywhere; goes stale silently | |
| Stub the converter, test the plumbing | Cheapest and most consistent with the file as written; does not prove the engine can read what we write | |

**User's choice:** Real ChatLane, real temp VPK

### Q5: The real round trip needs Windows and CI is ubuntu-latest. How does that land?

**Finding raised before the question:** `resources/chatlane/` holds `ChatLane.exe` plus two Windows DLLs, all tracked in git. No Linux binary exists. `chatLaneBinaryPath()` picks the name off `process.platform`. CI runs `ubuntu-latest`.

| Option | Description | Selected |
|--------|-------------|----------|
| Skip when the binary is absent | Runs on Windows locally, CI stays green, no workflow edit; round trip never gated by CI | ✓ |
| Add a Windows CI job | Genuinely gated on every push; shared ci.yml edit plus roughly doubled CI minutes | |
| Separate opt-in script | Zero CI and zero shared-file change; a test nobody must run is a test that rots | |

**User's choice:** Skip when the binary is absent

---

## Evidence record

### Q1: Where does the human-gated evidence live?

| Option | Description | Selected |
|--------|-------------|----------|
| One doc in docs/ | Row per check beside rigged-preview-spike.md; fork-only file, zero merge cost, discoverable | ✓ |
| Per-plan SUMMARY.md only | Already where the executor writes; costs discoverability, .planning is not where a contributor looks | |
| GitHub issue checklist | Resumable and visible without a clone; evidence lives outside the repo | |

**User's choice:** One doc in docs/

### Q2: What counts as proof for a single check?

| Option | Description | Selected |
|--------|-------------|----------|
| Written verdict, artifact when it fails | Fast happy path across a dozen checks; expensive evidence goes where it earns its keep | ✓ |
| Written verdict only | Fastest; loses the ability to re-examine a failure without re-running the game | |
| Artifact on every check | Strongest record; real time per check and binary weight in a repo already carrying a 17MB exe | |

**User's choice:** Written verdict, artifact when it fails

### Q3: How does the record get produced, given no agent can run the game?

| Option | Description | Selected |
|--------|-------------|----------|
| Agent scaffolds, you fill | Rows pre-written with steps, fixtures, and what a pass looks like; user fills verdicts in one session | ✓ |
| You run it, agent transcribes | Nothing to prepare; checks run are whatever the user remembers, and REQ names about a dozen with preconditions | |
| You write the whole doc | Fewest moving parts; scaffolding effort does not disappear, it moves onto the user | |

**User's choice:** Agent scaffolds, you fill

### Q4: Does an unfilled row block Phase 1 from being done?

| Option | Description | Selected |
|--------|-------------|----------|
| No blank rows, blocked counts as filled | Handles checks whose fixtures are unavailable without faking a pass or stalling | ✓ |
| Scaffold ships, verdicts come later | Consistent with the 2026-07-28 smoke-record decision; costs the phase its point | |
| Only the five success criteria gate | Tight scope; the criteria summarize cases rather than enumerate them | |

**User's choice:** No blank rows, blocked counts as filled

---

## ConVar default meaning

**Framing raised before the question:** `performanceUserControls.ts:26` documents `gameDefault: null` as "stock gameinfo.gi does not set the key", which is a statement about a config file, not about the engine's runtime default. All 7 HUD toggles are null today.

### Q1: How does an engine-read default get represented?

| Option | Description | Selected |
|--------|-------------|----------|
| Second field, engineDefault | Two facts stay two fields so convarStates can tell them apart; costs a type change and consumer updates | ✓ |
| Redefine gameDefault | Smallest diff; loses the distinction that makes "off" a written value rather than a removal | |
| Separate captured-values module | Cleanest provenance; an indirection per lookup and a second place to keep in sync | |

**User's choice:** Second field, engineDefault
**Notes:** The user added "don't forget the ability to save my changes for the other settings and for it to be auto applied". Checked against the tree: saving already works via `overridesByPreset` in the sidecar, harvested and re-layered on every apply, so nothing to build. Auto-apply does not exist anywhere; every apply is user-initiated. Recorded as a deferred idea mapping to REQ-performance-convar-profiles-and-recovery rather than added to Phase 1.

### Q2: Two of the eight keys are not plain reads. How are they recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Record the reading plus a note | Raw console value with an inversion comment; the unsupported-key comment gets confirmed or corrected | ✓ |
| Normalize inverted keys at the source | Simpler downstream; a stored value that does not match what the console printed is the same class of drift that caused the original wrong badge | |
| Skip the two odd keys this phase | Smallest scope; REQ names the inverted one as the first thing to check | |

**User's choice:** Record the reading plus a note

### Q3: Once engineDefault is populated, what changes in the Settings UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Badge only, no new controls | convarStates gains the engine value; no layout change on a surface upstream also touches | ✓ |
| Badge plus reset-to-engine-default | Useful once the number is known; today's reset deliberately removes the line instead of writing a number | |
| Nothing visible this phase | Minimal; a wrong badge stays wrong until someone else does the UI work | |

**User's choice:** Badge only, no new controls

---

## What a failed check does

Initially deselected at area selection, then taken up in the follow-up round.

### Q1: An in-game check fails. What happens to Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Record it, size it, then decide | Verdict plus root-cause note first, then a deliberate choice; one stop per failure | ✓ |
| Fix inside Phase 1 always | Strongest guarantee; phase size becomes unbounded | |
| Record and route out always | Perfectly bounded; the phase could complete with four known-broken paths untouched | |

**User's choice:** Record it, size it, then decide

### Q2: Who decides in-phase fix versus new phase, and on what threshold?

| Option | Description | Selected |
|--------|-------------|----------|
| You decide, agent proposes a size | Agent estimates blast radius (files, process boundary, shipped formats); user makes the call | ✓ |
| Written rule, agent applies it | No interruptions; the rule has to be written before the failures are known | |
| Everything stops and asks | Maximum control; costs user time on obvious cases | |

**User's choice:** You decide, agent proposes a size

---

## Rigged preview release gate

Not presented in the initial selection; added in the follow-up round.

**Correction applied before the questions:** the spike's step 1 (decouple rigged from cloth) is already done. `heroPoseRenderFeatures.ts:55` reads `USE_RIGGED_PREVIEW || flags.rigged || clothPreviewEnabled`, so rigged has its own switch and enabling it no longer starts cloth. `HeroPoseViewer.test.ts:162` asserts it. The fps reading is the only remaining blocker.

### Q1: What shapes of answer must Phase 1 be able to apply?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag flip only | Resolves to RELEASE_RENDER_FLAGS.rigged true or false plus the written recommendation; matches the one mechanism that exists | ✓ |
| Flag flip or a user-facing setting | Reasonable if the number is middling; costs a setting, an i18n key, and a Settings surface owned by upstream | |
| Include a per-hero mechanism | Most complete answer to the requirement as written; speculative and most expensive | |

**User's choice:** Flag flip only

### Q2: Is the spike's roster-wide clip sweep in or out of Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| In, but only if the fps reading passes | Runs at the point three pilots stops being enough coverage; skipped if the number says gate | ✓ |
| In unconditionally | Data useful either way; costs phase time on an outcome possibly already decided against | |
| Out of Phase 1 | Tightest scope; "three pilots is not the roster" is one of the spike's own reasons not to default on | |

**User's choice:** In, but only if the fps reading passes

---

## Claude's Discretion

- Whether the six render tests share a fixture module or keep the codebase's inline-factory convention
- The exact filename and row schema of the verification record doc
- Which specific mod, hero, and multi-clip pool serve as fixtures for each in-game check

## Deferred Ideas

- Auto-apply of performance settings on launch or after a game update. Saving already works; auto-apply does not exist and maps to the deferred REQ-performance-convar-profiles-and-recovery
- Per-hero rigged preview allowlist, only if the fps measurement argues for it
- Reset-to-engine-default action on ConVar controls, possible once engineDefault is populated
- A Windows CI job, which would let the Chat Wheel round trip gate on every push
