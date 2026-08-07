---
phase: 02-a-supported-fork-release
plan: 06
subsystem: social
tags: [social, adr, terms-of-service, vitest, sibling-repo, ci]

requires:
  - phase: 02-a-supported-fork-release
    provides: consolidated branch set (plan 02-05) that this plan's ADR builds on
provides:
  - "ADR-018: the shipped installer keeps pointing at the upstream grimoire-social Worker; wave 3 (revalidation cron, view counter) stays dormant"
  - "A committed CI-truth typecheck result: pnpm exec tsc -b --force against the sibling detached at origin/main exits 0"
  - "src/components/social/dormantService.test.ts guarding the two render gates a dormant service depends on"
  - "The terms-of-service gate placement decided: first publish, matching the code, with docs/social-architecture.md corrected to say so"
affects: [social, discover, publish-dialog]

actuals:
  tokens: 2960
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Source-assertion vitest files (no DOM, no mocks) as living guards for a design decision — see supportDestinations.test.ts precedent, followed here by dormantService.test.ts"

key-files:
  created:
    - src/components/social/dormantService.test.ts
  modified:
    - docs/social-architecture-decisions.md
    - docs/social-architecture.md

key-decisions:
  - "D-01 confirmed in writing (ADR-018): this fork does not repoint at its own grimoire-social deployment; the upstream Worker stays the target"
  - "Terms-of-service gate: doc-follows-code — docs/social-architecture.md corrected to say first publish (matching PublishDialog.tsx), rather than moving the gate to first login. No code change, no new locale keys."

patterns-established:
  - "ADR consequences record concrete facts (exact test/shim names, exact CI-truth result) rather than caveats, so a future reader does not have to re-derive them"

requirements-completed: [REQ-social-service-disposition]

coverage:
  - id: D1
    description: "dormantService.test.ts guards the two client-side render gates (ModsAvailableBadge unsupported branch, SocialProfileHeader owner-only view-count defined-check) that let a dormant social service ship with no UI change"
    requirement: "REQ-social-service-disposition"
    verification:
      - kind: unit
        ref: "src/components/social/dormantService.test.ts#dormant service guard (D-01 / ADR-018)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ADR-018 records the D-01 disposition, its consequences (dormant cron/counter, the ProfileDetailWithAvailability shim, the CI-truth typecheck result, the pinned-branch soft spot, the unbuilt tooltip and its trigger), and its alternatives"
    requirement: "REQ-social-service-disposition"
    verification:
      - kind: other
        ref: "grep -c \"^## ADR-018\" docs/social-architecture-decisions.md (returns 1); grep -c \"D-01\" (returns 2); grep -c \"0005\" (returns 4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The terms-of-service gate placement decision (doc-follows-code) is applied: docs/social-architecture.md's two first-login references now say first publish and both state that localStorage acceptance is per-machine, not durable"
    requirement: "REQ-social-service-disposition"
    verification:
      - kind: other
        ref: "grep -cE \"first publish|first login\" docs/social-architecture.md (returns 2, both say first publish)"
        status: pass
    human_judgment: true
    rationale: "The decision itself (doc-follows-code vs code-follows-doc) was a checkpoint:decision the plan explicitly forbade an implementer from picking; the orchestrator supplied it mid-execution. A human should confirm the applied wording matches what was intended."

duration: 28min
completed: 2026-08-07
status: complete
---

# Phase 02 Plan 06: Social Service Disposition Summary

**ADR-018 records that this fork's shipped installer keeps pointing at the upstream grimoire-social Worker with wave 3 (revalidation cron, view counter) permanently dormant, backed by a passing CI-truth typecheck and a new guard test proving the client already renders that correctly.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-07T11:21:37-05:00 (base commit b715167)
- **Completed:** 2026-08-07T11:49:37-05:00 (commit 604fa61)
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint:decision, Task 3 auto)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Proved, rather than assumed, RESEARCH.md's two claims about this surface: `resolveModsAvailability`'s absent-vs-null split already renders correctly (20/20 existing tests pass unchanged), and a CI-truth typecheck (`pnpm exec tsc -b --force` against the sibling detached at `origin/main`, resolving `efffe0b`) exits 0 — this repository currently builds clean against what a fresh CI checkout of `../grimoire-social` resolves.
- Added `src/components/social/dormantService.test.ts`, a source-assertion guard (no DOM, no mocks) that fails if either of the two render gates that let a dormant service ship silently — `ModsAvailableBadge`'s unsupported early return, `SocialProfileHeader`'s `viewCount !== undefined` owner-only gate — is loosened or removed.
- Resolved the checkpoint:decision on terms-of-service gate placement as `doc-follows-code` (decision supplied by the orchestrator after presenting the actual code, storage accessors, and both design-document lines) and applied it: `docs/social-architecture.md` lines 256 and 422 now say the gate fires at first publish, each with an added sentence stating acceptance is stored per-machine in `localStorage` and is not a durable, account-bound, or server-recorded consent record.
- Wrote ADR-018 in `docs/social-architecture-decisions.md`: the D-01 disposition, the exact unpushed-commit list (`5f870bd`, `754efe7`, `13a5695`), the migration-0005-before-Worker-deploy ordering constraint stated explicitly, the `ProfileDetailWithAvailability` shim's continued necessity, the pinned-vs-moving-branch contrast with the vpkmerge checkout, and the deliberately unbuilt GameBanana mod-title tooltip with its trigger condition.
- Full repository gate re-run and green: `pnpm typecheck`, `pnpm lint`, `pnpm test` (155 files, 1718 tests), `pnpm i18n:check`, `node scripts/gen-locale-manifest.mjs --check`, `pnpm encoding:check`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove the client is already honest about a dormant service, and that CI's sibling still typechecks** - `374de62` (test)
2. **Task 2: Decide where the terms-of-service gate belongs** - checkpoint:decision, no commit (decision recorded, applied in Task 3)
3. **Task 3: Write ADR-018 and apply the terms-gate decision** - `604fa61` (docs)

**Plan metadata:** committed together with this SUMMARY (see final commit in worktree log)

## Files Created/Modified

- `src/components/social/dormantService.test.ts` - New guard test: asserts `ModsAvailableBadge`'s unsupported branch returns `null` and `SocialProfileHeader`'s owner-only view-count row is gated on `!== undefined`, not truthiness
- `docs/social-architecture-decisions.md` - Added ADR-018 (Context/Decision/Consequences/Alternatives/ordering constraint/terms-gate decision) and its summary-table row
- `docs/social-architecture.md` - Lines 256 and 422 corrected from "first login" to "first publish", each with a sentence on the non-durability of localStorage-stored acceptance

## Decisions Made

- **D-01 confirmed in writing:** this fork's shipped installer keeps pointing at the upstream Worker (`https://grimoire-social.slusheliott.workers.dev`, baked in `.github/workflows/release.yml`). No fork of `grimoire-social`, no push of the three unpushed sibling commits, no application of migration 0005, no Worker deploy — each recorded in ADR-018 as a considered-and-declined alternative with its concrete cost.
- **Terms-of-service gate: doc-follows-code.** Presented to the orchestrator with the actual `PublishDialog.tsx` gate block, the `localStorage` accessors, and both design-document lines. Chosen because the gate already sits at the moment consent actually matters (publish), and moving it to first login would add a new surface, new catalog keys, and translator work for a flow only signed-in users would see, for a user who signs in and browses having agreed to nothing either way — an acceptable outcome under the stated framing. No code change was required since the code already matched this option; only the design document was corrected.
- **CI-truth typecheck outcome recorded, not fixed-forward:** the plan's instructions were explicit that a failure here would be a documented consequence, not something to resolve by pushing sibling commits (which D-01 forbids). The result was a pass, so ADR-018 records that this repository currently builds clean from what CI resolves, with no forward action needed.

## Deviations from Plan

None - plan executed exactly as written. The one open decision point (Task 2) was resolved by the orchestrator mid-execution via the checkpoint protocol, as the plan's `autonomous: false` marking required; no auto-fix or unplanned code change was needed to apply it, since `doc-follows-code` required only a documentation edit.

## Issues Encountered

- The sandboxed worktree environment initially refused `git -C ../grimoire-social ...` and `cd ../grimoire-social && git ...` when the sibling path was given relative to the worktree (the sandbox reads a relative `../` segment as "a directory computed at runtime" and blocks it as an isolation violation). Resolved by using the sibling's absolute path (`git -C "C:/Users/wayba/dev/grimoire-social" ...`) for every sibling-repo operation in Task 1 (status check, branch check, divergence log, detach, restore). No code or plan change was needed; this was purely a tool-invocation adjustment.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The social service disposition question (REQ-social-service-disposition) is closed for this milestone: ADR-018 is the answer a future reader will find, with its ordering constraint and alternatives on record.
- Should a future phase decide to fork `grimoire-social` to `onionviolet`, ADR-018's ordering constraint (migration 0005 before any Worker deploy that selects its columns) and its list of exactly three call sites to repoint (`ci.yml`, `release.yml`, `check-sibling-repos.mjs`) are the starting checklist.
- No blockers for subsequent phases in this milestone.

---
*Phase: 02-a-supported-fork-release*
*Completed: 2026-08-07*
