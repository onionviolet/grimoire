---
phase: 02-a-supported-fork-release
plan: 02
subsystem: fork-engine-release
tags: [release-workflow, ci-guard, vpkmerge, d-02, verification-record]
dependency-graph:
  requires:
    - "02-01: fork-owned support destination and D-03 record pattern"
  provides:
    - "scripts/check-release-engine-pin.mjs: pre-push guard asserting the release workflow's onionviolet/vpkmerge checkout is pinned to a full commit SHA, that pnpm use-local-vpkmerge runs before electron-builder packaging, and that scripts/use-local-vpkmerge.mjs still writes both engine capability markers"
    - "Reconciled scripts/fetch-vpkmerge.mjs header and docs/fork-maintenance.md D-02 engine-policy record, both describing the pinned-SHA build-from-source pipeline that actually ships"
    - "docs/ingame-verification-record.md IG-23: engine-tier record row for the packaged DXT5-YCoCg icon colour check, verdict blocked by explicit human decision"
  affects:
    - "package.json (engine-pin:check script entry)"
    - ".husky/pre-push (new gate)"
    - "scripts/check-verification-record.mjs (EXPECTED_IDS extended to IG-23)"
tech-stack:
  added: []
  patterns:
    - "Plain-node, no-dependency guard script in the house style of scripts/check-upstream-refs.mjs: header comment stating why it exists, line-scan parsing of a YAML workflow file without a YAML library, non-zero exit with a specific named-failure message"
    - "Comment-only diff proof: git diff filtered to non-comment lines, asserted empty, as the acceptance criterion that a prose-only change touched no executable line"
key-files:
  created:
    - scripts/check-release-engine-pin.mjs
  modified:
    - scripts/fetch-vpkmerge.mjs
    - docs/fork-maintenance.md
    - package.json
    - .husky/pre-push
    - docs/ingame-verification-record.md
    - scripts/check-verification-record.mjs
decisions:
  - "IG-23 verdict left as blocked by explicit human decision at the plan's checkpoint (2026-08-06/07): the user cannot currently produce a packaged Windows build and run it against a live Deadlock session, so the automatable half (row scaffolding, EXPECTED_IDS, amendment note) was committed and the verdict stands as blocked rather than pass or fail"
  - "D-02 (engine build policy) recorded in docs/fork-maintenance.md: the fork engine reaches a packaged build via the pinned-commit-SHA build of onionviolet/vpkmerge in release.yml, not via a published checksum-pinned release; that promotion remains explicitly open future work, not silently dropped"
actuals:
  tokens: 3957
  tasks: 3
  commits: 3
metrics:
  duration_minutes: 5
  completed: 2026-08-07
status: complete
---

# Phase 02 Plan 02: A Supported Fork Release - Engine Pin and Verification Record Summary

Made the fork's engine story true on paper (fetch script header, D-02 policy record), added a pre-push guard that fails a push if the release workflow's engine pin loosens off a full commit SHA or the bundling step reorders after packaging, and put the packaged in-game colour half of the success criterion on the record with an honest `blocked` verdict confirmed by the user.

## What Was Built

- **`scripts/fetch-vpkmerge.mjs`**: rewrote only the header comment block (verified via a diff assertion that zero non-comment lines changed). The new header states plainly that this script fetches the stock upstream `Slush97/vpkmerge` v0.19.0 release asset as a dev-machine bootstrap only, that the packaged release gets the fork engine a different way (`.github/workflows/release.yml`'s pinned-SHA checkout of `onionviolet/vpkmerge`, its `cargo build`, and `pnpm use-local-vpkmerge` overwriting whatever this script fetched), that the stock asset predates the YCoCg icon fix so `foundryTextureReplace.ts` refuses texture replacement against it, that this script deletes the `.ycocg-icon-safe` marker on every install so a stock binary can never inherit a local build's attestation, and that promoting a checksum-pinned fork release remains open work per D-02.
- **`docs/fork-maintenance.md`**: replaced the pending-sounding "fallback only until the fork publishes a versioned release" framing with a dated "Engine build policy (D-02)" subsection recording, as of 2026-08-06, that the pinned-SHA build-from-source pipeline in `release.yml` is the supported path, the stock download is the deliberate dev-machine bootstrap, promoting a published release remains an explicitly-open option, and `scripts/check-release-engine-pin.mjs` is the guard that keeps the pin honest.
- **`scripts/check-release-engine-pin.mjs`** (new): a plain-node, no-dependency guard in the house style of `scripts/check-upstream-refs.mjs`. Line-scans `.github/workflows/release.yml` and asserts three invariants: (1) the `onionviolet/vpkmerge` checkout's `ref:` matches `/^[0-9a-f]{40}$/`, failing with a message about reproducibility and ref-control if it does not; (2) the `pnpm use-local-vpkmerge` step appears before the `electron-builder --win` packaging step; (3) `scripts/use-local-vpkmerge.mjs` still writes both the `.local-build` and `.ycocg-icon-safe` marker names. On success it prints the pinned SHA it found. Verified against a live mutation test: temporarily replacing the workflow's `ref:` with `main` made the guard exit non-zero with the expected message; the file was restored afterward with `git diff --name-only` confirming no residual change before that restoration was itself verified clean.
- **`package.json`** / **`.husky/pre-push`**: added `"engine-pin:check": "node scripts/check-release-engine-pin.mjs"` beside the other check entries, and wired `pnpm engine-pin:check` into pre-push after the existing `pnpm refs:check` line, with a comment explaining this is where the repo keeps its cheap invariant gates. Not added to `ci.yml`: the release workflow file is the artifact under protection, and a push-time gate catches a loosened pin earlier than a release run would.
- **`docs/ingame-verification-record.md`**: appended engine-tier row `IG-23` to Table 1, naming REQ-packaged-fork-engine, checking that replacing a normal icon and a DXT5-YCoCg icon through a packaged Windows build produces correct colours in game. Verdict recorded as `blocked` with a stated reason (settling it needs a packaged Windows build plus a running Deadlock session; no CDP-driven script can assert in-game pixel colour). Added a dated amendment note at the top of the document recording the addition and that Phase 1's stated row counts describe the record as of 2026-08-06, before this addition.
- **`scripts/check-verification-record.mjs`**: extended `EXPECTED_IDS` to `rangeIds('IG', 1, 23)` so the new row is part of the enforced inventory rather than silently optional.

## Checkpoint

Task 3 is `type="checkpoint:human-verify"` (`gate="blocking"`). All automatable prep (the IG-23 row, the `EXPECTED_IDS` extension, the amendment note, `--strict` passing) was committed before the checkpoint was raised. The checkpoint asked the user which verdict IG-23 should carry when the phase closes: confirm `blocked` stands, or supply `pass`/`fail` evidence from an actual packaged-build session.

**Resolution:** the user confirmed **blocked stands** - they cannot currently produce a packaged Windows build and run it against a live Deadlock session. No further code changes were needed; the row committed during the checkpoint's automatable prep already carries the confirmed verdict.

## Deviations from Plan

None. Task 1 and Task 2 executed as written and verified, including the required mutation test for Task 2's guard (temporarily loosening the pin, confirming failure, restoring the file, confirming no residual diff). Task 3's automatable half executed as written; its verdict resolution came back as the plan's own documented default path (`blocked` stands), which needed no additional edit.

## Verification

- `git diff HEAD -- scripts/fetch-vpkmerge.mjs | grep -E '^[+-][^+-]' | grep -vE "^[+-][[:space:]]*//" | wc -l` -> `0` (only comment lines changed)
- `grep -c "VPKMERGE_VERSION = 'v0.19.0'"` / sha256 constant / `release.yml` / `use-local-vpkmerge` / `ycocg-icon-safe` in `fetch-vpkmerge.mjs` -> all present at or above required counts
- `grep -c "D-02"` / `"check-release-engine-pin"` in `docs/fork-maintenance.md` -> both >= 1
- `pnpm engine-pin:check` -> exits 0, prints `onionviolet/vpkmerge pinned to 798f3a7d28f3ef314d8f6ebf51ced0d9fe049445`
- `node -e "...p.scripts['engine-pin:check']..."` -> exits 0
- `grep -c "engine-pin:check" .husky/pre-push` -> `1`
- Mutation test: `ref:` temporarily set to `main` -> `pnpm engine-pin:check` exits non-zero with the expected reproducibility message; file restored, `git diff --name-only` shows no residual change to `release.yml`
- `pnpm lint` -> clean
- `pnpm encoding:check` -> clean (608 files scanned)
- `grep -c "^| IG-23 "` in `docs/ingame-verification-record.md` -> `1`
- `grep -c "rangeIds('IG', 1, 23)"` in `scripts/check-verification-record.mjs` -> `1`
- `node scripts/check-verification-record.mjs --strict` -> exits 0 (42 rows, 42 verdicts filled, 0 blank)
- IG-23 Tier cell reads `engine`; Verdict cell reads `blocked` with a non-empty Root cause cell
- `grep -c "IG-23"` in `docs/ingame-verification-record.md` -> `2` (row + amendment note)

## Known Stubs

None. `IG-23`'s `blocked` verdict is not a stub in the code sense; it is a documented, honest record of an untested engine-tier fact, explicitly confirmed by the user rather than left unresolved by the executor. Per the plan's own rules for this record, `blocked` "means: this check could not run, and someone still owes it" - carried forward as an open item, not hidden.

## Self-Check: PASSED

- FOUND: scripts/fetch-vpkmerge.mjs
- FOUND: docs/fork-maintenance.md
- FOUND: scripts/check-release-engine-pin.mjs
- FOUND: package.json
- FOUND: .husky/pre-push
- FOUND: docs/ingame-verification-record.md
- FOUND: scripts/check-verification-record.mjs
- FOUND commit: 476e59e
- FOUND commit: e4bc531
- FOUND commit: e45e875
