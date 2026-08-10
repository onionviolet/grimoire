---
phase: 02-a-supported-fork-release
verified: 2026-08-07T17:09:53Z
status: passed
score: 5/5 roadmap success criteria verified (1 carries an explicitly-accepted blocked engine-tier row)
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "ROADMAP Phase 2 Success Criterion 1: 'A packaged Windows build reports a checksum-pinned onionviolet/vpkmerge version in Settings, and replacing both a normal icon and a DXT5-YCoCg icon through it produces correct colours in game.'"
    reason: >
      The in-game colour half is recorded in docs/ingame-verification-record.md as row
      IG-23, tier engine, verdict blocked: no packaged Windows build against a live
      Deadlock session was available during this phase's execution, and no CDP-driven
      script can assert what the Source 2 renderer draws. This verdict was an explicit
      human decision at plan 02-02's blocking checkpoint (2026-08-07): presented with the
      choice to test now, report pass, or report fail, the repository owner confirmed
      "blocked stands." Verification re-surfaced it as an open runtime fact per standard
      practice; the repository owner then confirmed the same decision when routing phase
      completion, following the D-26 precedent Phase 1 set for accepted-outstanding
      engine-tier rows. The verdict correctly stays blocked, not deferred: deferred is
      legal only on an engine-tier row per D-22, and this IS an engine-tier row, but the
      project's convention (see 01-VERIFICATION.md's own override) keeps a row blocked
      when it names something someone still owes, using deferred only where nothing
      further is expected to change the situation. Engine pin, support destination, branch
      consolidation, social service disposition, and the experimental gate are all fully
      verified; only this one runtime fact remains unprovable outside a live game session.
    accepted_by: "user (via /gsd-execute-phase 2 checkpoint and phase-completion routing question)"
    accepted_at: "2026-08-07T17:18:07.185Z"
human_verification:

  - test: "IG-23 (packaged Windows build, replace a normal icon and a DXT5-YCoCg icon through Foundry, launch Deadlock, confirm both render with correct colours; Settings reports a 798f3a7-suffixed engine version)"
    expected: "Both icons render with correct in-game colours"
    why_human: "No CDP-driven script can assert in-game pixel colour rendered by the Source 2 engine. This is a pre-existing, explicitly accepted `blocked` verdict (confirmed by the repository owner at plan 02-02's checkpoint), carried forward here per the phase's own instruction rather than newly discovered."
---

# Phase 02: A Supported Fork Release Verification Report

**Phase Goal:** This fork can be handed to a user as a supported build, with a pinned engine, a support channel it owns, one clean branch, and a decided answer about the social service
**Verified:** 2026-08-07T17:09:53Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | A packaged Windows build reports a checksum-pinned `onionviolet/vpkmerge` version in Settings, and replacing both a normal icon and a DXT5-YCoCg icon through it produces correct colours in game | ⚠ PRESENT, in-game half explicitly `blocked` | `release.yml` pins `onionviolet/vpkmerge` at commit SHA `798f3a7d28f3ef314d8f6ebf51ced0d9fe049445`; `pnpm engine-pin:check` passes and fails on a mutated ref (verified live); `foundry:engineInfo`/`ForkBuildCard` pre-exist and report the version. The in-game colour half is recorded as `docs/ingame-verification-record.md` row `IG-23`, tier `engine`, verdict `blocked`, with a stated reason and a non-empty root cause. This verdict was an explicit human decision at plan 02-02's blocking checkpoint (2026-08-06/07), not an oversight. Per the task briefing for this verification, this is treated as an accepted, recorded state rather than a gap — but it is still an unproven runtime fact and is surfaced below as a human-verification item so it is not silently dropped from the record. |
| 2 | No fork-owned surface sends a user to the upstream project's support channel, while attribution and the Ko-fi label still say plainly that they belong to upstream | ✓ VERIFIED | `grep -c "discord.gg" src/components/UpdateModal.tsx` → 0; same for `SupportSection.tsx` → 0; `grep -c "onionviolet/grimoire/issues" src/components/UpdateModal.tsx` → 1. `discordRpc.ts` and `README.md` still carry `discord.gg` (1 each), and `SupportSection.tsx`'s "About Grimoire" block, Ko-fi framing, and `UPSTREAM_REPO` links are untouched. `src/components/supportDestinations.test.ts` (7 tests) passes, asserting both directions. |
| 3 | `git branch` shows no branch holding unmerged work, the fully merged branches are gone, and the temporary merge plan document has been retired | ✓ VERIFIED | `git branch -a` (local) shows only `main`. `git branch -r` (excluding the `upstream` remote used for the ingest source) shows only `origin/HEAD`/`origin/main`. `git worktree list` shows one entry (the primary worktree). `docs/merge-plan-upstream-2026-08.md` does not exist. `structural-refactor-7`'s 5 commits are reachable from `main` via a real two-parent merge commit `c0571a2` (`git log -1 --format=%P main` still resolves through history; no `<<<<<<<` conflict markers anywhere in the tree). |
| 4 | A shipped installer points at a social service someone has decided on, and no surface advertises a check that will never run against it | ✓ VERIFIED | `docs/social-architecture-decisions.md` contains `ADR-018` (Date/Status/Context/Decision/Consequences/Alternatives, cites `D-01` twice), recording that the installer keeps pointing at the upstream Worker (`.github/workflows/release.yml:119` bakes `https://grimoire-social.slusheliott.workers.dev`) and that wave-3 features (revalidation cron, view counter) stay dormant. `src/components/social/dormantService.test.ts` (new) plus `availability.test.ts` (22 tests total) pass, guarding that `ModsAvailableBadge`'s unsupported branch renders nothing and `SocialProfileHeader`'s view-count gate is a defined-check, not a truthy-check — so a dormant service produces no phantom badge or empty statistic. |
| 5 | An experimental surface cannot be reached with its setting off, and no shipped document claims a capability the project forbids claiming | ✓ VERIFIED | `src/pages/ChatWheel.tsx:186` reads `!settings?.experimentalChatWheel` as an early-return guard below every hook (mirrors the `Browser.tsx` precedent); `App.tsx`/`Sidebar.tsx` are unmodified, so the gate lives only in the page component and covers every navigation path. `src/pages/ChatWheel.test.tsx` (3 tests: off / on / settings-undefined) passes. `docs/profile-spec.md` has 0 matches for `between mod managers|manager agnostic|manager-agnostic` and 1 match for `Grimoire-only`; the legitimate forward-compatibility goal (`new sources, new games`) survives. |

**Score:** 5/5 ROADMAP success criteria hold (criterion 1's in-game half is an explicitly accepted `blocked` state, not a failure, per the task's own framing and Phase 1's D-26 precedent).

### PLAN-Level Must-Haves (spot-checked across all six plans)

All PLAN-frontmatter `must_haves.truths` were spot-checked against the codebase in addition to the roadmap-level table above:

- 02-01 (support destination): both Settings support rows (bug/feature row, generated-report row) point only at the fork's GitHub Issues; `DISCORD_INVITE`/`DiscordIcon` deleted from `SupportSection.tsx`; retired i18n keys (`channels`, `bugReportDescription`, `joinDiscord`, `joinDiscordTitle`, `openDiscord`) confirmed absent from the catalog; new keys (`forkChannels`, `bugReportShareDescription`) confirmed present; `docs/fork-maintenance.md` names the D-03 decision, the three moved call sites, the four exclusions, and the guard test. VERIFIED.
- 02-02 (engine pin): `scripts/fetch-vpkmerge.mjs` header rewritten (diff-scoped to comments only, per the plan's own acceptance criterion, not independently re-diffed here but corroborated by header content matching the plan's five required statements); `docs/fork-maintenance.md` records D-02 dated; `scripts/check-release-engine-pin.mjs` exists and passes; `.husky/pre-push` wired; IG-23 row present with `blocked` verdict and non-empty root cause; `check-verification-record.mjs --strict` exits 0. VERIFIED.
- 02-03 (Chat Wheel gate + profile-spec): covered above. VERIFIED.
- 02-04 (merge): merge commit `c0571a2` is a real two-parent commit; `assetClaims.ts`/`useAssetClaims.ts`/`inspectedAssetClaims.ts` all exist with no conflict markers; `pnpm exec vitest run src/lib/assetClaims.test.ts` passes as part of the full suite (155 files / 1718 tests all green). VERIFIED.
- 02-05 (branch consolidation): covered above (SC3). VERIFIED.
- 02-06 (social ADR + terms gate): covered above (SC4); `docs/social-architecture.md` lines 256 and 422 both read "first publish" with the localStorage non-durability sentence added, matching the recorded `doc-follows-code` decision. VERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/supportDestinations.test.ts` | Two-sided support/attribution guard | ✓ VERIFIED | Exists, 7 tests pass |
| `src/components/UpdateModal.tsx` | Fork Issues link, no Discord | ✓ VERIFIED | `onionviolet/grimoire/issues` present, `discord.gg` absent |
| `src/components/settings/sections/SupportSection.tsx` | Single fork destination, About block intact | ✓ VERIFIED | `discord.gg`/`DISCORD_INVITE`/`DiscordIcon` absent; `UPSTREAM_REPO` present (About block) |
| `docs/fork-maintenance.md` | D-03 and D-02 decision records | ✓ VERIFIED | Both sections present |
| `scripts/check-release-engine-pin.mjs` | Pinned-SHA guard | ✓ VERIFIED | Exists, `pnpm engine-pin:check` passes, wired into `.husky/pre-push` |
| `docs/ingame-verification-record.md` | IG-23 engine-tier row | ✓ VERIFIED | Row present, `check-verification-record.mjs --strict` exits 0 |
| `scripts/fetch-vpkmerge.mjs` | Reconciled header, no executable-line change | ✓ VERIFIED | Header states the 5 required facts (dev bootstrap only, release pipeline builds from pinned SHA, YCoCg refusal, marker deletion, D-02 future-work note) |
| `src/pages/ChatWheel.test.tsx` | 3-state render test | ✓ VERIFIED | 3 tests pass |
| `src/pages/ChatWheel.tsx` | Page-level experimental gate | ✓ VERIFIED | `experimentalChatWheel` guard present below all hooks |
| `docs/profile-spec.md` | No cross-tool compatibility claim | ✓ VERIFIED | 0 matches for forbidden phrasing |
| `src/lib/assetClaims.ts` / `useAssetClaims.ts` | One resolved path-ownership module + hook | ✓ VERIFIED | Both exist; combine-decision split confirmed via a third file, `inspectedAssetClaims.ts` |
| `docs/merge-plan-upstream-2026-08.md` | Retired (deleted) | ✓ VERIFIED | File absent |
| `docs/social-architecture-decisions.md` | ADR-018 | ✓ VERIFIED | Present with summary-table row |
| `src/components/social/dormantService.test.ts` | Dormant-service render-gate guard | ✓ VERIFIED | Exists, tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `UpdateModal.tsx` | `translation.json` | `settings.support.githubIssues*` keys | ✓ WIRED | Keys reused verbatim, no new catalog keys needed for this link |
| `supportDestinations.test.ts` | `discordRpc.ts` | asserts attribution survives | ✓ WIRED | Guard passes |
| `check-release-engine-pin.mjs` | `.github/workflows/release.yml` | reads checkout ref, asserts 40-hex SHA | ✓ WIRED | `pnpm engine-pin:check` passes; live mutation test documented in 02-02-SUMMARY.md (not independently re-run here since it mutates a tracked file) |
| `.husky/pre-push` | `scripts/check-release-engine-pin.mjs` | `engine-pin:check` invocation | ✓ WIRED | `grep -c "engine-pin:check" .husky/pre-push` → 1 |
| `ChatWheel.tsx` | `appStore.ts` | `useAppStore((state) => state.settings)` selector | ✓ WIRED | Selector present at line 186 area, gate reads `settings?.experimentalChatWheel` |
| `ChatWheel.tsx` | `translation.json` | `chatWheel.disabled.*` keys | ✓ WIRED | Keys present and referenced |
| `dormantService.test.ts` | `ModsAvailableBadge.tsx` | asserts unsupported branch returns nothing | ✓ WIRED | Test passes |
| `dormantService.test.ts` | `SocialProfileHeader.tsx` | asserts view-count defined-check | ✓ WIRED | Test passes |
| `assetClaims.ts` | `useAssetClaims.ts` / `inspectedAssetClaims.ts` | consumes resolved ownership module | ✓ WIRED | No conflict markers, full test suite green |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine pin guard enforces a 40-hex SHA | `pnpm engine-pin:check` | `OK: onionviolet/vpkmerge pinned to 798f3a7d28f3ef314d8f6ebf51ced0d9fe049445` | ✓ PASS |
| Verification record inventory strict-checks clean | `node scripts/check-verification-record.mjs --strict` | `42 rows, 42 verdict(s) filled, 0 blank (strict)` | ✓ PASS |
| Support-destination guard | `pnpm exec vitest run src/components/supportDestinations.test.ts` | 7/7 pass | ✓ PASS |
| Chat Wheel 3-state gate test | `pnpm exec vitest run src/pages/ChatWheel.test.tsx` | 3/3 pass | ✓ PASS |
| Dormant-service + availability tests | `pnpm exec vitest run src/components/social/dormantService.test.ts src/components/social/availability.test.ts` | 22/22 pass | ✓ PASS |
| Full test suite | `pnpm exec vitest run` | 155 files / 1718 tests, all pass | ✓ PASS |
| Typecheck | `pnpm typecheck` | exits 0 | ✓ PASS |
| Lint | `pnpm lint` | exits 0 | ✓ PASS |
| i18n check | `pnpm i18n:check` | exits 0 (295 unused keys are informational only, pre-existing) | ✓ PASS |
| Locale manifest check | `node scripts/gen-locale-manifest.mjs --check` | up to date | ✓ PASS |
| Encoding check | `pnpm encoding:check` | clean, 619 files scanned | ✓ PASS |
| Upstream refs check | `pnpm refs:check` | exits 0 | ✓ PASS |
| No conflict markers | `git grep -c "<<<<<<<" -- src electron docs scripts` | no match | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repository and no plan declares one; this phase's verification instead runs the repository's own named check scripts (`engine-pin:check`, `check-verification-record.mjs --strict`), all reported above. Skipped: no probe files to run.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| REQ-fork-support-destination | 02-01 | ✓ SATISFIED in code, but **stale in REQUIREMENTS.md** | Implementation fully verified (see SC2 above). `.planning/REQUIREMENTS.md` line 58 checkbox is still `[ ]` and the traceability table (line 157) still reads `Pending`. Every sibling requirement in this same phase (`REQ-upstream-merge-aug-2026`, `REQ-social-service-disposition`, `REQ-experimental-gate-and-doc-drift`) got a dedicated `docs(02-0X): mark REQ-... complete` commit after its plan landed (confirmed via `git log -- .planning/REQUIREMENTS.md`); no equivalent commit exists for this requirement or the next one. |
| REQ-packaged-fork-engine | 02-02 | ⚠ PARTIALLY SATISFIED, **and REQUIREMENTS.md text itself is stale** | The requirement's literal text asks for "a checksum-pinned `onionviolet/vpkmerge` release... promoted in `scripts/fetch-vpkmerge.mjs` AND `.github/workflows/release.yml`, replacing the stock v0.19.0 bootstrap." That literal ask was explicitly NOT done: `scripts/fetch-vpkmerge.mjs` still fetches the stock `Slush97/vpkmerge` v0.19.0 asset unchanged (diff-scoped to comments only), and no `onionviolet/vpkmerge` GitHub Release exists. Instead, D-02 (a phase-level decision recorded in `docs/fork-maintenance.md`) substitutes a pinned-commit-SHA build-from-source pipeline in `release.yml`, explicitly naming "promoting a checksum-pinned release" as deferred future work, not delivered work. The narrower ROADMAP SC1 ("reports a checksum-pinned version in Settings") is satisfied by this substitute approach, but REQUIREMENTS.md's own wording for this requirement was never amended to record the D-02 scope change (contrast with Phase 1's precedent of adding "**Amended 2026-08-06 (D-XX)**" clauses to requirement text when a plan's delivered scope diverged from the original ask). The checkbox (line 57) is `[ ]` and the traceability table (line 156) reads `Pending`. |
| REQ-upstream-merge-aug-2026 | 02-04, 02-05 | ✓ SATISFIED | Traceability table marked `Complete`; matches codebase evidence (SC3 above). |
| REQ-social-service-disposition | 02-06 | ✓ SATISFIED | Traceability table marked `Complete`; matches codebase evidence (SC4 above). |
| REQ-experimental-gate-and-doc-drift | 02-03 | ✓ SATISFIED | Traceability table marked `Complete`; matches codebase evidence (SC5 above). |

No orphaned requirements: all 5 phase-req-IDs from ROADMAP/PLAN frontmatter appear in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` markers found in any file this phase modified. No `TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" strings found (one incidental match on a form `placeholder` JSX attribute in `SupportSection.tsx`, not a stub marker). No conflict markers anywhere in the tracked tree.

### Human Verification Required

### 1. IG-23: packaged in-game colour check

**Test:** Produce a packaged Windows build via `.github/workflows/release.yml`, install it, open Settings and read the engine version, replace a normal item icon and a DXT5-YCoCg item icon through Foundry, launch Deadlock, and look at both icons in game.
**Expected:** Both icons render with correct colours, and Settings reports a `798f3a7`-suffixed engine version.
**Why human:** No CDP-driven script can assert what the Source 2 renderer draws in a live game session. This is not a new finding — it is `docs/ingame-verification-record.md` row `IG-23`, already carrying an explicit `blocked` verdict that the repository owner confirmed at plan 02-02's blocking checkpoint (recorded in `02-02-SUMMARY.md`: "the user confirmed **blocked stands**"). It is surfaced here per this verification's standard practice of listing every unresolved runtime fact, not as a newly discovered gap.

### Gaps Summary

No BLOCKER-level gaps. All five ROADMAP success criteria hold in the codebase, all artifacts exist and are wired, the full repository gate (`typecheck`, `lint`, `test` — 1718 tests, `i18n:check`, manifest check, `encoding:check`, `refs:check`, `engine-pin:check`) is green, and no conflict markers or debt markers remain.

Two non-blocking findings worth closing before this phase is considered fully reconciled:

1. **REQUIREMENTS.md is stale for 2 of 5 requirements.** `REQ-fork-support-destination` and `REQ-packaged-fork-engine` are still checked `[ ]` and marked `Pending` in the traceability table, even though their plans (02-01, 02-02) executed and their SUMMARYs report `status: complete`. The other three requirements in this same phase each received a dedicated `docs(02-0X): mark REQ-... complete` commit; no equivalent commit exists for these two. This looks like a missed step in phase closure rather than a deliberate decision (nothing in either plan or its SUMMARY calls out leaving REQUIREMENTS.md unchanged, unlike 02-04's explicit "intentionally left open" note for `REQ-upstream-merge-aug-2026`).
2. **REQ-packaged-fork-engine's literal requirement text was not amended to reflect the D-02 scope decision.** The requirement as written demands promoting a checksum-pinned `onionviolet/vpkmerge` *release* that replaces the stock bootstrap script; D-02 explicitly chose a different, narrower path (pinned-SHA build-from-source, guarded by `check-release-engine-pin.mjs`) and named the release-promotion path as deferred future work. This is a legitimate, well-documented engineering decision, but `.planning/REQUIREMENTS.md`'s requirement text should carry an "Amended" note recording it, matching the pattern already used elsewhere in the same file (e.g., `REQ-ingame-verification-sweep`'s "**Amended 2026-08-06 (D-19 to D-23)**" clauses) so a future reader does not read the unmarked requirement text as unmet or re-litigate D-02.

Neither finding blocks the phase goal: the ROADMAP's own success criteria (the authoritative phase contract) are all met in the codebase, and both findings are cheap documentation fixes, not code changes.

Routed to `human_needed` rather than `passed` because IG-23 remains an open runtime fact requiring a human with a packaged Windows build and a live Deadlock session — the same accepted-blocked state carried forward from this phase's own checkpoint, not a new discovery.

---

*Verified: 2026-08-07T17:09:53Z*
*Verifier: Claude (gsd-verifier)*
