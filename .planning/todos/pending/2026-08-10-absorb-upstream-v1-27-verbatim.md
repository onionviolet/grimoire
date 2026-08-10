---
created: 2026-08-10T18:39:48.970Z
title: Absorb upstream v1.27 verbatim
area: general
severity: major
files:
  - electron/main/index.ts
  - electron/main/ipc/settings.ts
  - electron/main/services/download.ts
  - src/components/Layout.tsx
  - src/locales/en/translation.json
  - package.json
---

## Problem

Upstream (Slush97/grimoire, read-only) shipped v1.27.0 on 2026-08-06, and this fork (onionviolet/grimoire) is 10 commits behind upstream/main — merge base 14a6eb6, 481 commits ahead. Those 10 commits carry four real features plus release packaging:

- DeadlockForge 1-click installs over a loopback bridge (commit 1ff6590, 27 files, +2559): a 127.0.0.1 listener the site POSTs raw VPK bytes to. Off by default; trust comes from an Origin allowlist; `application/octet-stream` + `X-Forge-Protocol` forces the CORS preflight that keeps a hostile page from reaching the listener; body capped at 512 MB; VPK magic verified before anything touches the game folder; one confirmation at a time with an armed-delay confirm button.
- GameBanana mirror routing + fileserver failover (commit 1b841bc) and the download-servers diagnostics card (commit 0ceab21).
- Crosshair preview rasterized the way the game does (commit 368b866).
- A security fix folded into the bridge commit: `treeSize` in a VPK header is an untrusted uint32, so a crafted 12-byte VPK could make the main process zero-fill up to 4 GiB (conflict detection parses every installed VPK). Clamped at four call sites plus the worker's duplicated parser.

The fork is a supported fork with its own release destination and support burden, so upstream's shipped features belong in a coherent fork. Decision recorded 2026-08-10: absorb all 10 commits verbatim, unmodified.

## Solution

A trial merge already ran and was aborted with a clean tree. Everything substantive auto-merges (download.ts, vpk.ts, preload/index.ts with 43 commits of divergence, types/mod.ts, all crosshair files); nothing touches Foundry, Locker, or the merge engine, so open phase work is unaffected. Exactly 6 conflicted files / 8 hunks, all additive collisions:

- electron/main/index.ts — import block + registration list
- electron/main/ipc/settings.ts — import + settings key list
- src/components/Layout.tsx — modal mount point
- package.json — version line (1.26.20 vs 1.27.0)
- src/locales/en/translation.json — additive JSON keys
- src/locales/manifest.json — regenerate with `pnpm i18n:manifest`, never hand-merge

Steps:
1. Merge the 10 upstream commits (or their net diff) into the current branch.
2. Resolve the six collisions; decide the fork's version scheme explicitly (upstream says 1.27.0, our package.json says 1.26.20).
3. Verify two runtime agreements that auto-merge cannot prove: upstream's `forgeBridge` opt-in setting against our fork's settings migration, and upstream download.ts fileserver failover against our Deadworks content provisioning (which also downloads).
4. Run the gates: `i18n:check`, `encoding:check`, vitest, `verify:in-app`.
5. Confirm the bridge works: detection ping, one install, refusal of a non-VPK, and the 512 MB / magic checks.

Repository-boundary rules apply: push only to origin (onionviolet/grimoire); upstream stays read-only. Commit messages must not carry bare upstream PR numbers — describe the work in plain words (docs may record provenance; the commit-msg and pre-push hooks enforce this).

Estimated effort: half a day including gates. Keep the bridge byte-identical to upstream so the next absorb stays cheap.
