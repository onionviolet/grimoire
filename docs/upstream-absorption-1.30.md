# Upstream v1.30.1 intake and fork quality

Source intake checked 2026-10-03, from fork `8a739130` to upstream
`de1e4a51bfc5e7bebbc6e7afc584c8f6061add4a` (43 commits, through v1.30.1).
This is source integration evidence, not a published release or game-engine
acceptance record. No upstream repository objects were changed.

## Decisions

| Surface | Decision | Reason |
|---|---|---|
| Installed/Browse structure, page and modal primitives | Port | Adopt upstream's split modules, range selection, list toggles, delete progress, gated search, hide-mod and replacement flows; retain shared fork preferences, Saved handoff, scroll restoration, undo and chat-wheel unbind review. |
| Performance preset card | Take | Upstream now owns a complete preset/version/opt-in flow with undo. Fork HUD/advanced staging remains in Config; its persistent control values still survive preset changes. |
| Mod safety, disabled-first imports, cursor packs and gameinfo paths | Take/port | Keep upstream behavior while preserving fork magic-byte validation, nested-archive recovery, write-set review and local ability-sound classification. Cursor selection bypasses the VPK-specific gate, while ordinary VPK extraction retains it. |
| Hero identity | Port | Carry the six new heroes into fork portrait/sound joins and local roster fallback. VO is known; unverified ability slots, particles and body-model mappings remain unavailable. |
| Foundry, sound shelves, portraits and recolor staging | Keep | These are fork differentiators. Apply upstream semantic tokens and keyboard focus rules, retaining staged edits, personal labels, asset-source inspection and export controls. |
| Fork boundaries, attribution, support, browser and release channels | Keep | Preserve onionviolet-only writes, backlink guards, support ownership, browser routes, tracking filters and fork updates. |

## Improvements after intake

Profile application uses one plan for review and execution. It reports missing,
changed, replaced and ambiguous saved entries. Both Profiles and Installed use
one review dialog. A fingerprint covers the saved profile and current installed
state; main rechecks it under the mutation lock before writing. Cancel and
navigation away resolve without applying. Partial results clear the active
profile marker and explain skipped entries. Existing profile files remain
readable; no portable wire-format migration was introduced.

This is a bounded improvement to fork issue 28. Full rollback, recovery of
local/Foundry assets, rolling history and manual mapping remain open. Existing
portable snapshots still omit local-only mods, so they are not a complete
rollback guarantee.

The dev smoke exposed an eager database initialization before slot selection.
`devUserData.ts` now runs before the service graph, and creates blank slots even
when seeding is disabled. On the next fresh boot, the catalog database opened
under `grimoire-dev6`, not the normal profile. The earlier boot initialized and
synced the normal catalog cache; it did not touch a real game installation.

The pinned fork engine remains
`798f3a7d28f3ef314d8f6ebf51ced0d9fe049445`. Its release build applies the immutable
reader repair `4396ad7a00528ce3b70af9a7d7bb74ceac9b3747` before testing/building.
The patch includes the vendored MIT license. Windows, macOS and Linux release
jobs now build and bundle this engine; source-based Nix continues to consume
its independently pinned upstream engine and has no fork capability claim.
See [fork-maintenance.md](./fork-maintenance.md) for the owning build policy.

## Verification

- Local full Vitest suite, strict typecheck, ESLint, UI ratchet, i18n keys and
  manifest, source encoding, backlink and engine-pin gates.
- Production Electron build with the fork marker and real social service URL.
- Engine overlay applied to a fresh pinned checkout, matched the tested source
  bytes, and was idempotent on a second run. Five optional-checksum VPK tests
  passed on macOS.
- Electron 35.7.5 / macOS arm64 smoke in a blank slot using two inert VPK fixtures
  inside a fake game directory. The review reported one available and one
  missing entry, with one enable and one disable. Cancel was exercised; accepted
  apply enabled the available file, disabled the outside file, and kept the
  incomplete profile inactive. No real game path was used.
- Profile review regression tests cover missing/changed/replaced/ambiguous mods,
  renamed local hashes, stale reviews, cancellation, navigation away and repeated
  clicks. Dev startup tests cover blank, default and invalid slots.

Remote CI and Nix dependency-store verification are the final integration gates.
Windows/Linux artifacts, upgrade behavior and Source 2 loading remain unrun.
