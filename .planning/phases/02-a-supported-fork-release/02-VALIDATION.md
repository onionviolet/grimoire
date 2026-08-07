---
phase: 2
slug: a-supported-fork-release
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Seeded from `02-RESEARCH.md` §Validation Architecture (lines 419-452). Task rows are
filled in by `/gsd-validate-phase` once plan task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (existing, no changes needed) |
| **Quick run command** | `pnpm exec vitest run <path-to-file>` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (full suite; measure and correct at Wave 0) |

No framework install is needed. Vitest is already present and configured.

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run <changed test file>`
- **After every plan wave:** Run `pnpm test` plus `pnpm typecheck`
- **Sibling-boundary tasks:** anything touching the `grimoire-social` type boundary must
  additionally run `pnpm exec tsc -b --force` after temporarily reverting the sibling file
  under test. `pnpm typecheck` resolves the sibling from disk and stays green while CI fails.
- **Before `/gsd-verify-work`:** `pnpm typecheck && pnpm lint && pnpm test` green, plus the
  shell-verifiable branch and doc-drift checks below.
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Requirement-level map carried forward from research, to be resolved to task IDs:

| Requirement | Test Type | Automated Command | File Exists |
|-------------|-----------|-------------------|-------------|
| REQ-packaged-fork-engine (Settings reports engine version/path/bundled) | unit | `pnpm exec vitest run electron/main/services/foundryTextureReplace.test.ts` | ✅ |
| REQ-fork-support-destination (no upstream Discord invite on fork-owned support surfaces) | unit/smoke | new test or scripted grep gate | ❌ W0 |
| REQ-upstream-merge-aug-2026 (no unmerged branch, plan doc retired) | shell | `git branch --no-merged main` empty AND `test ! -f docs/merge-plan-upstream-2026-08.md` | N/A |
| REQ-social-service-disposition (unsupported checks stay hidden) | unit | `pnpm exec vitest run src/components/social/availability.test.ts` | ✅ verify coverage |
| REQ-experimental-gate-and-doc-drift (gated page renders disabled state when setting is off) | render/unit | new page test, jsdom pragma per Phase 1 precedent | ❌ W0 |
| REQ-experimental-gate-and-doc-drift (profile-spec drops cross-manager claims) | shell | `grep -n "between mod managers\|manager agnostic" docs/profile-spec.md` expects no match | N/A |

---

## Wave 0 Requirements

- [ ] A render test for the gated experimental page's disabled state, following the
      `Browser.tsx` page-level `EmptyState` pattern and the jsdom precedent set in Phase 1
- [ ] A smoke test or scripted grep gate asserting no fork-owned support surface links the
      upstream Discord invite outside the allow-listed attribution surfaces
- [ ] No new framework or config. Existing Vitest setup covers everything unit-testable here.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A normal icon and a DXT5-YCoCg icon replaced through the packaged build show correct colours in game | REQ-packaged-fork-engine | Needs a packaged Windows build and a running Deadlock session. No automated substitute exists. | Route to a `docs/ingame-verification-record.md` engine-tier row, not a Vitest file. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
