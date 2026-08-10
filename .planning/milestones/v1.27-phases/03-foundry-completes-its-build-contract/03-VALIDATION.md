---
phase: 3
slug: foundry-completes-its-build-contract
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`package.json` devDependency) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, includes `src/**/*.test.ts(x)`, `electron/**/*.test.ts`, `scripts/**/*.test.ts` |
| **Quick run command** | `pnpm exec vitest run electron/main/services/foundryForge.test.ts src/components/foundry/buildTray.test.ts` |
| **Full suite command** | `pnpm test` (= `vitest run`) |
| **Estimated runtime** | Not measured this session — driver: 163 existing `*.test.ts(x)` files in the tree, so the full suite is not a sub-second run; use the quick command for per-task feedback |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run` scoped to the touched test file(s) (e.g. `foundryForge.test.ts`, `buildTray.test.ts`, or the new `recolorStagedEdit.test.ts`)
- **After every plan wave:** Run `pnpm test` (full suite) + `pnpm typecheck` (`tsc -b`) — typecheck is not optional given the type-widening cascade (`FoundryForgeEdit`, `FoundryBuildPart.kind`, `FoundryChangeKind` must widen together or `tsc -b` fails)
- **Before `/gsd-verify-work`:** Full suite must be green, `pnpm typecheck` must be green
- **Max feedback latency:** N/A — no watch-mode/manual-trigger tests in this phase's scope

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-foundry-forge-edit-kinds | `reviewFoundryForge`/`describeFoundryBuild` handle a `recolor` edit correctly (entries, collisions, provenance) | unit | `pnpm exec vitest run electron/main/services/foundryForge.test.ts` | ✅ exists, extend with recolor fixtures |
| REQ-foundry-forge-edit-kinds | `buildFoundryForgeVpk`'s `built[]` stays aligned across all three kinds (the alignment trap) | unit | `pnpm exec vitest run electron/main/services/foundryForge.test.ts` | ✅ same file, needs a new 3-edit-request test case |
| REQ-foundry-forge-edit-kinds | `isStagedRecolorEdit`/`unsupportedStagedEditKind` correctly classify a recolor staged edit | unit | `pnpm exec vitest run src/components/foundry/buildTray.test.ts` | ✅ exists |
| REQ-foundry-forge-edit-kinds | Recolor request → staged edit serialization (`prepareRecolorStagedEdit`/`serializeRecolorStagedEdit`) | unit | `pnpm exec vitest run src/components/foundry/recolorStagedEdit.test.ts` | ❌ Wave 0 — mirror `soundStagedEdit.test.ts`/`visualEdits.test.ts` |
| REQ-foundry-sound-shuffle-surfacing | `shuffleSoundKey`/toggle wiring behaves identically from Foundry as from Locker | unit | existing `lockerRandomizer` tests if present, else new | unconfirmed — check before assuming a gap |
| REQ-foundry-sound-shuffle-surfacing | Foundry→Locker navigation string resolves to the hero+sounds route | unit | `pnpm exec vitest run src/lib/lockerMode.test.ts` (if exists) | unconfirmed — resolution logic already generic, likely no new test required |
| REQ-foundry-pool-audition-fidelity | No new test — already covered per D-06/D-07 (doc-only requirement, no code ships) | n/a | n/a | n/a |

---

## Wave 0 Requirements

- [ ] `src/components/foundry/recolorStagedEdit.test.ts` — covers REQ-foundry-forge-edit-kinds (staging serialization)
- [ ] `electron/main/services/foundryForge.test.ts` — extend with a `recolorEdit` fixture and a 3-kind `built[]` alignment test; covers REQ-foundry-forge-edit-kinds
- [ ] Confirm whether `src/lib/lockerMode.test.ts` / a `lockerRandomizer` test file already exists before assuming either is a gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recolor forged VPK actually recolors the hero in-engine (byte-faithful particle/texture/model patch) | REQ-foundry-forge-edit-kinds | VPK byte content and in-engine rendering are outside Vitest's reach (per `docs/ability-vfx-recolor.md`'s constraint that particle recolor is a byte-faithful in-place scalar patch) | Stage a recolor edit alongside a sound and texture edit in Foundry, forge, install, and confirm all three land in the same named VPK and the hero shows the recolor in-game |
| Abilities tab stages, Body+Gun tab still applies immediately | REQ-foundry-forge-edit-kinds | UX/interaction-model distinction inside one mounted panel, not a pure-function behavior | Open `HeroEffectsPanel`, confirm Abilities "Apply" stages into the Foundry tray without baking, and confirm Body+Gun "Apply" still bakes immediately with no tray entry |
| Foundry sound-shuffle toggle and Locker's toggle for the same hero stay in sync live | REQ-foundry-sound-shuffle-surfacing | Cross-page Zustand state sync is best confirmed by eye across a navigation | Toggle a hero's sound shuffle inclusion from Foundry, navigate to Locker via the new link, confirm the same toggle state is reflected there |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (no watch-mode tests)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
