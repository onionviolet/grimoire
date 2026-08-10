# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.27 - "verified, supported, coherent"

**Shipped:** 2026-08-10
**Phases:** 6 | **Plans:** 32 | **Tasks:** 76

### What Was Built
- An executable verification record: 23 app-tier rows settled by a CDP runner, 18 engine-tier rows deferred with per-row reasons, and jsdom render coverage for all six previously-untested Foundry lanes
- A supported fork release: pinned-SHA engine build guarded in CI, branch consolidation to `main`, support destination decided, social disposition recorded (ADR-018)
- The Foundry build contract: recolor/model edits join the combined reviewed build; sound shuffle reachable from Foundry with a Locker link
- Locker and Foundry as one object: 3D model stage, pre-write disclosure naming owners, portrait variant awareness, authored-state badges
- One inventory, one journey: tri-state Global inventory, portrait alias sweep verdicts for all 15 mismatch heroes, one-shot bulk undo with rendered blocker lines, one provenance phrase and target
- Community tools inside the browser: checked destination catalog, disclose-before-write VPK handoff with identity gating, hardened webview unchanged

### What Worked
- The review-before-audit sequence caught a real flagship defect (CR-01 bulk undo) before the milestone was archived; fixing it with a hook-level regression test was cheap because the undo logic had been kept as a pure module
- The CDP dev-driver pattern turned "cannot verify" claims into scriptable checks (23 rows) with honest blocked/deferred verdicts where a script genuinely cannot reach (engine rows)
- A single provenance helper and one blocker-line convention kept five surfaces consistent without re-litigating copy

### What Was Inefficient
- Deferred human verification accumulated across three phases (13/14, 7/10, 3/6) and had to be aggregated and accepted at the audit gate; the decision is recorded, but the rows remain unpaid
- The version drift (STATE.md/HANDOFF.json naming the milestone v1.26.20 against the roadmap's v1.27) had to be caught and corrected before the lifecycle could run
- Zero UI-REVIEW files were ever produced for shipped frontend phases, so the v1.27.1 milestone starts with retroactive visual auditing instead of having it inline

### Patterns Established
- Keep reversible-mutation logic in pure modules (`bulkUndo`) and wire them through hooks that read the live store at call time, so the render-closure staleness class of bug is testable
- Record accepted-outstanding rows as `blocked`/`deferred` with a reason and the accepting decision, never as silent passes
- Archive phase directories with the milestone (`milestone.complete` default) so cleanup stays a no-op

### Key Lessons
1. When a review proves a wiring bug (stale closure) that pure tests cannot see, extract the wiring into a hook and regression-test the hook against the live store - the test then fails on the old code.
2. Version drift between planning files and the roadmap blocks lifecycle automation; make STATE/HANDOFF/ROADMAP one source of truth before running audit/complete.
3. Retroactive UI review is more expensive than per-phase UI review; schedule it when a phase ships, not at release time.

### Cost Observations
- Model mix: single-model autonomous run (no per-phase typed subagents in this runtime)
- Sessions: continuous run 2026-08-10
- Notable: the repository gate (1931 tests, typecheck, lint, i18n, encoding) stayed green through the review-fix commit; verification debt, not test debt, was the cost driver

## Milestone: v1.27.1 - "absorb, review, ship"

**Shipped:** 2026-08-10
**Phases:** 2 | **Plans:** 2

### What Was Built
- Upstream v1.27 absorbed verbatim in one merge (forge bridge, mirror routing + failover, diagnostics card, crosshair rasterization, VPK size clamp), with the fork version resolved to 1.27.1 and every gate re-run against the merged tree, including the full in-app verification sweep
- The first retroactive six-pillar UI reviews for shipped frontend phases 03-06 (22/24, 23/24, 22/24, 24/24), with the Phase 5 copy-contract drift fixed and gated
- The fork's own published GitHub Release with installers, SHA256SUMS, and provenance attestations

### What Worked
- The pre-merge conflict map from the absorb todo was accurate (6 files / additive), so resolution was mechanical and byte-identical where it mattered
- Re-running verify:in-app against the merged tree caught nothing broken and upgraded IG-01 to pass (local vpkmerge engine available)
- The code-only UI audits with targeted greps found real contract drift (Phase 5 copy) without needing a browser session

### What Was Inefficient
- CRLF line endings made apply_patch fail on translation.json, forcing scripted exact-string edits; the first catalogFailed insertion landed in the wrong object and needed a corrective pass
- The CI test job on main is red on two pre-existing Linux-only issues (encoding-check fixture decoding; download-capture symlink sweep) that only surfaced on the first CI run to include them; the release itself was unaffected

### Patterns Established
- Verify release-notes extraction locally before tagging: `node scripts/release-notes.mjs <version>`
- Regenerate the locale manifest and re-run i18n:check after any catalog edit; validate JSON structure with a targeted path assertion, not just parse

### Key Lessons
1. When editing a CRLF JSON catalog, do exact-string replacements with a script and assert the target path afterward; a parse-valid JSON can still hold the new object in the wrong place.
2. A tag push is the moment CI exercises Linux-only test paths for the first time; run the suite on the CI OS before releasing if any test is platform-guarded.

### Cost Observations
- Model mix: single-model autonomous run
- Sessions: continuous run 2026-08-10
- Notable: the release workflow completed in ~7 minutes; the long pole was verification, not release

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.27 | 1 run | 6 | Review-before-audit, CDP-driven verification rows, accepted deferred verification recorded |
| v1.27.1 | 1 run | 2 | Verbatim upstream absorb + retroactive UI review + first fork GitHub Release |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|-------------------|
| v1.27 | 1931 | jsdom render harness (raw react-dom/client + act) |
| v1.27.1 | 2076 | Hook-level bulk-undo regression test; four UI-REVIEW files |

### Top Lessons (Verified Across Milestones)

1. Honest verdicts (blocked/deferred with reasons and decisions) beat silent passes; they keep the record actionable.
2. Pure modules plus live-store wiring hooks make the stale-closure bug class testable.
