---
phase: 01-verified-against-the-game
plan: 07
subsystem: locker
tags: [hero-pose, rigged-preview, release-flag, verification-record, vpkmerge]

# Dependency graph
requires:
  - "docs/ingame-verification-record.md: RP-03 row and Table 2 scaffold (01-06)"
provides:
  - "RELEASE_RENDER_FLAGS.rigged = true in src/components/locker/HeroPoseViewer.tsx, applied from a real frame-time measurement (RP-03)"
  - "docs/ingame-verification-record.md RP-03 recommendation section: median frame times, GPU timer deltas, dpr, band, measurement conditions, and the visibility/rAF trap note"
  - "docs/ingame-verification-record.md roster-wide clip sweep: all 38 addressable heroes yield an animated first-ranked clip, none fall back to no-clip"
  - "docs/rigged-preview-spike.md section 9 next-step list marked resolved (steps 1-2) and pending-confirmed-done (step 3)"
affects: [locker hero preview default behavior, REQ-rigged-preview-release-gate]

# Actuals (#2632)
actuals:
  tokens: 5236
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Roster-wide read-only vpkmerge sweeps (model clips --json) can be driven by a standalone node script that ports the ranking function verbatim rather than importing the TS module directly, when the sweep is a one-off verification artifact rather than shipped code."

key-files:
  created: []
  modified:
    - src/components/locker/HeroPoseViewer.tsx
    - src/components/locker/heroPoseRenderFeatures.ts
    - docs/ingame-verification-record.md
    - docs/rigged-preview-spike.md

key-decisions:
  - "Task 1 checkpoint:decision resolved to `ship` (user decision, relayed by the orchestrator with the measured values transcribed verbatim into RP-03)."
  - "RELEASE_RENDER_FLAGS.rigged flipped to true; USE_RIGGED_PREVIEW in heroPoseRenderFeatures.ts left at false (it is a separate manual dev-only override for auditioning rigged alone, now redundant with the release flag being on, not the release switch itself)."
  - "Fixed a plan-verify path error: the plan's Task 3 <verify> and <read_first> reference `src/lib/heroPoseModels.ts`, which does not exist. The actual file is `electron/main/services/heroPoseModels.ts`. Read from and diffed against the correct path; documented as a deviation below rather than silently working around it."

patterns-established: []

requirements-completed: []

coverage:
  - id: RP-03
    description: "Frame budget gate on Seven: median frame time static vs rigged, delta, dpr, band classification, and the ship/gate/per-hero/blocked decision"
    verification:
      - kind: other
        ref: "node scripts/check-verification-record.mjs (exit 0, RP-03 verdict=pass, 41 rows intact)"
        status: pass
    human_judgment: true
    rationale: "The frame-time reading itself was taken by the orchestrator on a running build with a GPU; this plan only transcribed it verbatim and applied the resulting decision, per the plan's explicit prohibition against moving the flag on an estimate or inference."
  - id: D1
    description: "RELEASE_RENDER_FLAGS.rigged in HeroPoseViewer.tsx holds the value the ship decision resolves to (true), with the comment stating the measured delta and recommendation instead of describing the flag as awaiting a measurement"
    verification:
      - kind: unit
        ref: "node -e rigged-flag-value-check (rigged flag is true)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run src/components/locker/HeroPoseViewer.test.ts (16 tests, confirms baseFlags() factory does not read RELEASE_RENDER_FLAGS so the flip does not move any assertion)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Roster-wide model clips --json sweep runs only on the ship branch (D-18) and records, per hero, the first-ranked clip and the tie-break rule applied where two clips ranked equally"
    verification:
      - kind: other
        ref: "38-hero sweep against D:\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\pak01_dir.vpk via the bundled vpkmerge binary, ranking ported verbatim from riggedClipScore/chooseRiggedClip"
        status: pass
      - kind: other
        ref: "git diff --exit-code electron/main/services/heroPoseModels.ts src/components/locker/heroPoseRenderFeatures.ts (exit 0, ranking and fallback logic untouched)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full repo suite stays green after the flag flip and the doc edits"
    verification:
      - kind: unit
        ref: "pnpm exec vitest run (148 files, 1589 tests, all pass)"
        status: pass
      - kind: other
        ref: "pnpm exec tsc -b, pnpm lint, pnpm encoding:check (all exit 0)"
        status: pass
    human_judgment: false

duration: 65min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 07: Rigged Preview Release Decision Summary

**RELEASE_RENDER_FLAGS.rigged flips to true on a real measurement: Seven's frame-time delta landed at 0.00 ms wall clock / +0.12 ms GPU timer, well inside the ship band, and a roster-wide clip sweep of all 38 addressable heroes found none that fall back to no animated clip.**

## Performance

- **Duration:** 65 min
- **Started:** approx. 2026-08-06T16:39:00Z
- **Completed:** 2026-08-06T17:44:00Z
- **Tasks:** 3 (1 checkpoint:decision, pre-resolved by the orchestrator; 2 auto)
- **Files modified:** 4

## Accomplishments

- **Task 1 (checkpoint:decision, pre-resolved):** The orchestrator relayed the user's decision (`ship`) along with the RP-03 measurement taken on a running build: static median 8.30 ms, rigged median 8.30 ms (0.00 ms wall-clock delta, both pinned to the 120 Hz vsync ceiling), GPU timer delta +0.12 ms (median static 1.67 ms, rigged 1.79 ms), dpr 1.2384, both deltas well inside the "within about 1 ms of static" ship band with no band-edge tie applicable.
- **Task 2:** Applied the ship decision. `RELEASE_RENDER_FLAGS.rigged` in `src/components/locker/HeroPoseViewer.tsx` is now `true`, with the comment above it and the stale "Gated OFF for now" comment in the render-attempt loop both rewritten to state the measured delta and the decision. `USE_RIGGED_PREVIEW` in `heroPoseRenderFeatures.ts` (a separate manual dev-only override, not the release switch) had its stale "what is still missing is an fps number" comment corrected to reflect that the number now exists and the release flag carries the decision. Wrote the full RP-03 recommendation into `docs/ingame-verification-record.md`: the two median frame times, the GPU timer figures, the dpr, the band, the decision, and all six measurement conditions from the checkpoint (vanilla rig not the named skin, floating-panel canvas size, 120 Hz vsync ceiling, `GRIMOIRE_DEV_NO_BACKGROUNDING=1`, single-run sampling, and the rigged-path-actually-engaged confirmation), plus a note on the `document.visibilityState`/rAF backgrounding trap for future re-measurement. `docs/rigged-preview-spike.md` section 9 marks next steps 1 and 2 resolved with an "Update, 2026-08-06" note superseding the original "ship it gated" recommendation, while leaving the original evidence lists and the section 6 estimate untouched as historical record.
- **Task 3:** Ran the roster-wide clip sweep (ship branch, since RP-03 argued for shipping per D-18): a read-only `model clips --json` call per hero against the installed pak, using the same selector logic (`--entry` for the nine `MODEL_ENTRY_OVERRIDES` heroes, `--hero <codename>` for the rest) and a verbatim port of `riggedClipScore`/`chooseRiggedClip`'s ranking and tie-break chain. All 38 addressable heroes (five sound-only roster rows with no model codename are excluded and named) yielded an animated first-ranked clip; 7 of those resolved a score/looping/duration tie via the `name.localeCompare` alphabetical rule, recorded per-row. No hero fell into the "no animated clip" case. No change to the ranking function or the fallback path.

## Task Commits

Each task was committed atomically:

1. **Task 1: The rigged preview release decision, given the measurement on Seven** - checkpoint:decision, pre-resolved by the orchestrator (user selected `ship`); no code change of its own, applied in Task 2's commit.
2. **Task 2: Apply the decision to the release flag and write the recommendation** - `f888d31` (feat)
3. **Task 3: Roster clip sweep, on the ship branch only** - `d852813` (docs)

**Plan metadata:** committed with this SUMMARY (see below)

## Files Created/Modified

- `src/components/locker/HeroPoseViewer.tsx` - `RELEASE_RENDER_FLAGS.rigged` flipped to `true`; two comments (the flag itself and the Attempt-1 render-loop comment) rewritten to state the measured delta and decision.
- `src/components/locker/heroPoseRenderFeatures.ts` - `USE_RIGGED_PREVIEW`'s comment corrected: the fps number it said was missing now exists (RP-03), and the release flag carries the ship decision; this module constant remains a separate manual dev override, unchanged in value.
- `docs/ingame-verification-record.md` - RP-03 row filled (`pass`, evidence summary); new "RP-03 measurement and recommendation" section with the full reading, band classification, decision, and measurement conditions; a visibility/rAF-ticking note for anyone re-taking this reading; new "Roster-wide clip sweep" section with a 38-row per-hero table and the excluded-heroes list.
- `docs/rigged-preview-spike.md` - Section 9's four-item next-step list: steps 1-2 marked RESOLVED with outcome, step 3 marked PENDING (now DONE per Task 3, referencing the record), plus an "Update" note superseding the stale "ship it gated" top-line recommendation without deleting the original evidence lists or the section 6 estimate.

## Decisions Made

- **Ship.** User decision, relayed by the orchestrator with the RP-03 measurement already taken. Per the plan's Task 1 context, undoing this is cheap (a one-line flag flip behind an already-decoupled switch), which is why the gate was a `checkpoint:decision` rather than a heavier architectural review.
- **`USE_RIGGED_PREVIEW` left at `false`.** This module constant in `heroPoseRenderFeatures.ts` is a manual override for auditioning rigged alone in dev without the release flag or the Leva Cloth checkbox (per spike section 8's own instructions to temporarily flip it). It is not the release switch and D-17 forbids adding a second flag, so only its comment was corrected, not its value.
- **No per-hero mechanism, no user-facing setting.** Per D-17, the decision resolved to one boolean (`RELEASE_RENDER_FLAGS.rigged`) plus the written recommendation. Nothing else was built.

## Deviations from Plan

**1. [Rule 3 - blocking issue] Plan's Task 3 verify/read_first path was wrong.**
- **Found during:** Task 3 verification
- **Issue:** The plan's `<read_first>` and `<verify>` both reference `src/lib/heroPoseModels.ts`. That file does not exist; the clip-ranking function (`riggedClipScore`, `chooseRiggedClip`) actually lives in `electron/main/services/heroPoseModels.ts`.
- **Fix:** Read from and ran `git diff --exit-code` against the correct path (`electron/main/services/heroPoseModels.ts`). No code change was needed; this was purely a plan-text correction applied at execution time.
- **Files modified:** None (execution-time correction only, no plan file edited).
- **Commit:** N/A (no file change; documented here for traceability).

**2. [Rule 2 - missing critical functionality, orchestrator-flagged] Stale comments beyond the one named comment.**
- **Found during:** Task 2, reading the files the plan pointed at
- **Issue:** Two comments beyond the single `RELEASE_RENDER_FLAGS.rigged` comment the plan named were also stale and would have contradicted the now-true release flag if left alone: the "Gated OFF for now: ... too many heroes fall back to A-pose" comment in `HeroPoseViewer.tsx`'s render-attempt loop (a known-stale claim, per the spike's own section 7 correction of the same claim elsewhere), and `heroPoseRenderFeatures.ts`'s `USE_RIGGED_PREVIEW` comment, which said "what is still missing is an fps number" (the orchestrator's task context explicitly flagged this one as needing an update).
- **Fix:** Rewrote both comments to state current reality (shipped, measured, RP-03) without changing any behavior.
- **Files modified:** `src/components/locker/HeroPoseViewer.tsx`, `src/components/locker/heroPoseRenderFeatures.ts`
- **Commit:** `f888d31`

**3. [Rule 3 - blocking issue] `resources/vpkmerge/` was absent in the worktree.**
- **Found during:** Task 3 setup
- **Issue:** `resources/vpkmerge/` is fetched at `pnpm install` time and gitignored, so a fresh worktree checkout does not carry the vpkmerge binary the sweep needs, and running `pnpm install` was explicitly forbidden (nested workspace would write into the main checkout's lockfile).
- **Fix:** Copied `resources/vpkmerge/vpkmerge-windows-x86_64.exe` from the sibling main checkout, where it already exists as a locally-built binary (the main checkout carries a `.local-build` marker per `pnpm use-local-vpkmerge`). This is a gitignored runtime asset, not a package-manager install, so it is outside the Rule 3 package-install exclusion; it produced no git-visible change (confirmed absent from `git status --short` after the copy).
- **Files modified:** None tracked by git (gitignored binary only).
- **Commit:** N/A (no tracked file change).

## Issues Encountered

None beyond the three deviations above. `pnpm exec vitest run` (full 148-file suite, 1589 tests), `pnpm exec tsc -b`, `pnpm lint`, and `pnpm encoding:check` all stayed green through both task commits. A manual non-ASCII scan of both touched docs (`check-encoding.mjs`'s `SCAN_DIRS` does not cover `docs/`) found zero non-ASCII characters and no em-dashes in the new prose.

## User Setup Required

None - no external service configuration required. The rigged preview is now on by default in dev and release builds; no user action needed.

## Next Phase Readiness

- `RELEASE_RENDER_FLAGS.rigged` is `true`. The rigged, skinned hero preview is now the default Attempt 1 in `HeroPoseViewer.tsx`, falling back to the static posed preview on any export, load, or clip failure exactly as before.
- RP-03 is the only Table 2 row with a filled verdict; RP-01 (whole-model animation) and RP-02 (NPR swim/detach check) remain blank, since this plan's Task 1 checkpoint measured check 3 only, per the plan's explicit scope. `node scripts/check-verification-record.mjs --strict` will still exit 1 until a human fills those two rows (plus the other 38 blank rows across Table 1 and Table 3), which is the phase's own completion gate (D-10) and out of this plan's scope.
- The roster-wide clip sweep (Task 3) found no hero yielding no animated clip, so there is no per-hero finding routed to a future phase from that angle. Should a future re-run of RP-03 (or a hardware-different environment) find a worse delta, the "gate" or "per-hero" branches in the plan's Task 1 options remain available and reversible: flipping `RELEASE_RENDER_FLAGS.rigged` back to `false` is a one-line change.

## Self-Check: PASSED

All modified files verified present on disk (`src/components/locker/HeroPoseViewer.tsx`, `src/components/locker/heroPoseRenderFeatures.ts`, `docs/ingame-verification-record.md`, `docs/rigged-preview-spike.md`, this SUMMARY). Both task commits (`f888d31`, `d852813`) verified present in `git log --oneline -5`.

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
