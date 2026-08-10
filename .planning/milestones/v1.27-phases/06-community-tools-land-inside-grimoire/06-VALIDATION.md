---
phase: 6
slug: community-tools-land-inside-grimoire
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Seeded from `06-RESEARCH.md` §Validation Architecture (lines 388-416). Task rows are
filled in by `/gsd-validate-phase` once plan task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (existing, no changes needed; node environment, no DOM) |
| **Quick run command** | `pnpm exec vitest run <path/to/file>.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (full suite; measure and correct at Wave 0 — not timed this session) |

No framework install is needed. Vitest is already present and configured, and already
covers both `electron/` and `src/`.

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run <changed test file>`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** `pnpm test` green, plus the manual dev-slot check from
  Open Question 1 (does Pimp My Hideout use the classic blob-anchor pattern or the File
  System Access API) recorded as evidence.
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
| REQ-browser-tool-catalog (catalog entries carry a valid `kind`; nsfw filtering still works per entry) | unit | `pnpm exec vitest run src/pages/Browser.catalog.test.ts` | ❌ W0 |
| REQ-browser-produced-file-handoff (`checkVpkFile` rejects a non-VPK temp download with the stated-reason copy before any confirm is shown) | unit | `pnpm exec vitest run electron/main/services/browserDownloadCapture.test.ts` | ❌ W0 |
| REQ-browser-produced-file-handoff (active-destination-kind is correctly derived from the current URL on navigation, not "last shortcut clicked") | unit | `pnpm exec vitest run electron/main/services/browserDownloadCapture.test.ts` | ❌ W0 |
| REQ-browser-produced-file-handoff (a confirmed download reaches `import-custom-mods` with the right `vpkPath`/`name`/`nsfw`) | integration (mocked IPC) | `pnpm exec vitest run electron/main/ipc/browser.test.ts` | ❌ W0 |
| REQ-browser-navigation-gaps (no new controls added beyond back/forward/reload/home/address-bar/open-externally) | manual-only | — | n/a |

---

## Wave 0 Requirements

- [ ] `electron/main/services/browserDownloadCapture.test.ts` — covers the `checkVpkFile`-gated
      temp-download handling and active-kind derivation (REQ-browser-produced-file-handoff)
- [ ] `electron/main/ipc/browser.test.ts` — covers the disclosure round-trip IPC handlers
- [ ] `src/pages/Browser.catalog.test.ts` — covers the catalog shape and nsfw filtering
      (REQ-browser-tool-catalog)
- [ ] No new framework or config. Existing Vitest setup covers everything unit-testable here.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The existing back/forward/reload/home/address-bar surface stays bounded (no tabs, zoom, find-in-page, extensions) after this phase's changes | REQ-browser-navigation-gaps | Absence of new UI surface is not a unit-testable assertion | Record that the boundary held during manual review of `Browser.tsx` |
| Pimp My Hideout's "Build VPK" button actually triggers `will-download` in a running dev slot (Open Question 1 / Pitfall 1) | REQ-browser-produced-file-handoff | Depends on a third-party site's live client-side JS, which cannot be inspected statically; needs a real `GRIMOIRE_DEV_SLOT` build and a live click | Load Pimp My Hideout in a dev slot's browser, click Build VPK, and confirm via a temporary log line or the dev-driver's `eval` that `will-download` fires before building the rest of the D-13-dependent flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
