---
phase: 01-verified-against-the-game
plan: 06
subsystem: testing
tags: [markdown-parser, repo-guard, vitest, evidence-record, convars]

# Dependency graph
requires: []
provides:
  - "docs/ingame-verification-record.md: 41 scaffolded rows (22 in-game sweep, 3 rigged-preview, 16 ConVar readings) with steps, fixture, and pass criteria filled in, every verdict blank"
  - "scripts/check-verification-record.mjs: parseVerificationRecord and checkVerificationRecord, plus a --strict CLI completion gate"
  - "scripts/check-verification-record.test.ts: 11 accept/reject test cases over inline fixtures"
affects: [01-07, verified-against-the-game phase completion, performanceUserControls.ts engineDefault population, HeroPoseViewer.tsx RELEASE_RENDER_FLAGS.rigged]

# Actuals (#2632)
actuals:
  tokens: 10184
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Markdown pipe-table guard: parse tables by header-row schema match (not column position), same house shape as scripts/check-encoding.mjs (pure exported functions, CLI entry guarded by import.meta.url vs process.argv[1], exit code not throw)."

key-files:
  created:
    - scripts/check-verification-record.mjs
    - scripts/check-verification-record.test.ts
    - docs/ingame-verification-record.md
  modified: []

key-decisions:
  - "REQ-ingame-verification-sweep, REQ-rigged-preview-release-gate, and REQ-performance-convar-safer-experimentation are NOT marked complete in REQUIREMENTS.md by this plan. This plan builds the scaffold and the guard only; the requirements themselves need a human game session per D-09, and marking them complete before that session would recreate the exact green-gate-no-verification problem Phase 1 exists to fix."

patterns-established:
  - "Markdown table guard parses by header-row schema match: a table's row shape is read from its own header cells (case-insensitive, trimmed), not assumed from column position, so a doc author can widen a table's header without silently breaking the parser."

requirements-completed: []

coverage:
  - id: D1
    description: "check-verification-record.mjs correctly parses both the check-row and ConVar-row schemas and enforces the 41-row inventory, verdict vocabulary, evidence/root-cause, and --strict completion gate"
    verification:
      - kind: unit
        ref: "scripts/check-verification-record.test.ts (11 tests: complete record passes strict/non-strict, blank verdict passes non-strict fails strict, missing ID, duplicate ID, unknown verdict, fail-no-evidence, fail-no-root-cause, blocked-no-reason, empty Steps cell, convar-pass-no-reading, mixed-schema parse)"
        status: pass
      - kind: other
        ref: "node scripts/check-verification-record.mjs (exit 0 against the scaffolded doc)"
        status: pass
      - kind: other
        ref: "node scripts/check-verification-record.mjs --strict (exit 1 against the scaffolded doc, all 41 verdicts blank by design)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/ingame-verification-record.md scaffolds every human-gated check across all three in-scope requirements with steps, fixture, and pass criteria, and leaves every verdict/evidence/root-cause/reading cell blank"
    verification:
      - kind: other
        ref: "node -e row-id-inventory-check (all 41 IDs present exactly once)"
        status: pass
      - kind: other
        ref: "pnpm encoding:check + manual non-ASCII scan (0 non-ASCII characters, no em-dash)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The actual in-game verification: a human runs Deadlock, works through all 41 rows, and node scripts/check-verification-record.mjs --strict exits 0"
    verification: []
    human_judgment: true
    rationale: "No agent can run Deadlock. Every verdict in this record is a fact only a running build can produce (D-09). This is explicitly out of scope for this plan/agent and is the phase's own completion gate (D-10)."

duration: 40min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 06: Ingame Verification Record and Guard Summary

**Scaffolded a 41-row human-gated evidence record (22 in-game sweep + 3 rigged-preview + 16 ConVar-reading rows) and a markdown-table guard script that makes the phase's completion rule (`--strict` exits non-zero while any verdict is blank) executable instead of remembered.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-06T15:54:00Z (approx.)
- **Completed:** 2026-08-06T16:34:55Z
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- `scripts/check-verification-record.mjs` parses two markdown pipe-table row schemas (check rows and ConVar rows) keyed off their own header row, enforces the fixed 41-ID inventory (IG-01..22, RP-01..03, CV-01..16), the `pass`/`fail`/`blocked` verdict vocabulary, evidence-on-fail, root-cause-on-fail-and-blocked, reading-on-convar-pass, and a `--strict` flag that fails while any verdict is blank.
- `scripts/check-verification-record.test.ts` covers 11 accept/reject cases with inline markdown fixtures built from local factory functions, mirroring `check-encoding.test.ts`'s inline-fixture convention. Never reads the real doc.
- `docs/ingame-verification-record.md` scaffolds every clause of `REQ-ingame-verification-sweep` (VPK forge-and-mount, cancel-dialog no-op, forge-install end-to-end and its two rollback modes, merged-VPK winner with a verbatim reviewed-source-order requirement, audition parity, re-forge idempotency, the 12-cell hero/voice/global sound matrix across four fixture types, and both portrait-variant honesty checks), all three checks named in `REQ-rigged-preview-release-gate` referenced by section rather than duplicated (with RP-03 stating the three frame-budget bands and the band-edge tie rule verbatim), and all 16 `REQ-performance-convar-safer-experimentation` ConVar rows in the plan-specified order with the inverted flag first.

## Task Commits

Each task was committed atomically:

1. **Task 1: The record guard and its tests** - `92639f8` (feat)
2. **Task 2: Scaffold the evidence record with every row present and empty** - `49c2ddd` (docs)

**Plan metadata:** committed with this SUMMARY (see below)

## Files Created/Modified
- `scripts/check-verification-record.mjs` - exports `parseVerificationRecord` (header-schema-keyed pipe-table parser) and `checkVerificationRecord` (the 8 rules from the CONTEXT decisions, plus row/verdict/blank counts); CLI defaults to `docs/ingame-verification-record.md`, accepts an explicit path and `--strict`.
- `scripts/check-verification-record.test.ts` - 11 tests over inline-built markdown fixtures; asserts both the full-record happy path and every individual rejection rule.
- `docs/ingame-verification-record.md` - the 41-row scaffolded record: preamble stating the pass/fail/blocked/root-cause rules and the strict command, Table 1 (22 in-game sweep rows), Table 2 (3 rigged-preview rows referencing `docs/rigged-preview-spike.md` section 8 by section), Table 3 (16 ConVar reading rows), and a closing note on where the readings land (`engineDefault` fields in `performanceUserControls.ts`).

## Decisions Made
- **REQUIREMENTS.md left untouched.** The three requirements this plan's frontmatter lists (`REQ-ingame-verification-sweep`, `REQ-rigged-preview-release-gate`, `REQ-performance-convar-safer-experimentation`) are NOT marked complete. This plan's own `must_haves` scope is the scaffold and the guard, not the verification itself; the requirements stay Pending until a human runs the game session and `node scripts/check-verification-record.mjs --strict` exits 0. Marking them complete now would be exactly the "green gate, no in-game validation" failure mode Phase 1 exists to close.
- **Cell-wrap tolerance in the parser.** `cleanCell` unwraps a cell that is entirely wrapped in `**` or `` ` `` (for example an ID or ConVar key written in bold or as code), so the doc author's markdown styling choices do not silently break ID matching. This was not explicitly requested by the plan but follows directly from "It must not care about column order beyond the header telling it which cell is which" — the same spirit extended to cell-level formatting robustness. Documented here rather than treated as a silent addition.
- **Fixture choices for the in-game sweep rows.** Seven (`gigawatt_prisoner`) is reused as the hero fixture for the hero-sound matrix (consistent with its role as the rigged-preview worst case elsewhere in the phase); Paige (`bookworm`) is proposed for the voice-sound matrix; a generic announcer/ambience entry is proposed for the global-sound matrix. All are explicitly substitutable per the plan ("the user can substitute at run time").

## Deviations from Plan

None - plan executed exactly as written. The `cleanCell` markdown-unwrap behavior noted above is an implementation detail within the guard's own stated tolerance ("must not care about column order beyond the header"), not a scope change.

## Issues Encountered

None. `pnpm exec vitest run` (full 141-file suite, 1559 tests) stayed green, `pnpm lint` was clean, `pnpm encoding:check` reported 598 files clean, and a manual non-ASCII scan of the new doc found zero non-ASCII characters (the encoding checker's `SCAN_DIRS` is `['src', 'electron', 'scripts']` and does not cover `docs/`, so the manual scan was the actual gate for the doc file).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The guard and the scaffolded record are both in place and verified structurally. `node scripts/check-verification-record.mjs` exits 0; `node scripts/check-verification-record.mjs --strict` exits 1 with all 41 IDs reported as blank, exactly as designed.
- **Not ready:** the actual in-game verification (D3 above) is unstarted. A human must run Deadlock, work through `docs/ingame-verification-record.md` from IG-01, fill in the CV-01..16 console readings starting with the inverted flag, and finish with RP-01..03 on Seven, then confirm `--strict` exits 0.
- Once those verdicts land, the 16 ConVar readings feed into `engineDefault` fields in `electron/main/services/performanceUserControls.ts` (currently `null`), and the RP-03 verdict feeds the `RELEASE_RENDER_FLAGS.rigged` decision in `src/components/locker/HeroPoseViewer.tsx` — neither of those follow-on edits is in this plan's scope.
- Plan 01-07 (a later wave) is expected to extend this doc with additional rigged-preview rows per the orchestrator's routing note; this record's table structure and header schemas were built to accommodate that without requiring a guard change.

## Self-Check: PASSED

All created files verified present on disk (`scripts/check-verification-record.mjs`, `scripts/check-verification-record.test.ts`, `docs/ingame-verification-record.md`, this SUMMARY). Both task commits (`92639f8`, `49c2ddd`) verified present in git log.

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
