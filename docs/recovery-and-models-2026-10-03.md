# Recovery and model inspection follow-up

Implemented on top of fork main `41a318cc`. This record describes source and
isolated development checks; the live inventory remains `feature-status.md`
and forward feature work remains `.planning/BACKLOG.md`.

## Delivered slices

- Local profile restore points: ten retained states with hashes of user VPKs
  and external chunks, original paths/order, raw autoexec/gameinfo and the active
  marker. Review and restore run under the normal mutation lock. Missing,
  changed, duplicate or stale matches block restore; failed restores roll back
  and report an incomplete rollback explicitly. Local profile creation/update
  also captures the canonical content identity before a rename can race it.
- Recovery: a user-triggered, read-only scan of installation configuration,
  VPK headers/directory trees, enabled/disabled/priority/overflow folders,
  metadata agreement and disk space. Links use existing supported controls.
  Reports reuse the existing main-process redaction and stay local until copied.
- Foundry Models: exact base-pak paths, search and bounded list rendering,
  on-demand static GLB preview and native-dialog export. Cache output is validated,
  deduplicated in flight, invalidated by the base-pak size/time and capped at
  256 MiB. Model inspection has no forge tray because it stages nothing.
- Chat Wheel: typed platform availability, YAML editing/starter/export on
  unsupported platforms, and no dead VPK save/load/validate actions. The release
  workflow checks the bundled Windows executable, libraries, template and license.

## Verification

- Full Vitest: 3,024 passed, 18 skipped, 270 passing files and two skipped files.
- Typecheck, ESLint, UI ratchet, i18n keys/manifest, encoding, reference and
  engine-pin gates. The ChatLane resource check passes.
- Electron 35.7.5 / macOS arm64, isolated `GRIMOIRE_DEV_SLOT=9` with seeding
  disabled, using two inert VPKs in a temporary fake game directory. A renamed
  local profile applied with zero unresolved entries; restore returned the
  previous layout/enabled state and active marker. No real game files were used.
- Recovery rendered real fixture scan findings and supported repair links.
  Models listed the fixture's exact path and drew a synthetic cached GLB through
  the real protocol and WebGL renderer. This proves the display path, not that
  the fixture is an engine-extractable model. Invalid source export reports an
  error. Narrow-window inspection removed the irrelevant forge tray from Models.
- Production build has zero unresolved main-process imports. An isolated arm64
  macOS app directory packaged and launched successfully. Its packaged CSP allowed
  the cached GLB fetch (HTTP-style status 200, 548 fixture bytes) and the Models
  canvas rendered. This is an ad-hoc signed local test artifact, not a release.
- Focused tests cover stale/missing/ambiguous/changed restore assets, config-write
  rollback, corrupted envelopes, history retention, canonical Foundry identities,
  read-only health checks and redaction, model path traversal/output/stale-build
  rejection, list pagination, explicit export, and unavailable ChatLane actions.

## Remaining limits

Restore points store identities and configuration, not copies of deleted VPKs.
They do not include reserved Locker artifacts and are not process-crash atomic.
Health checks do not validate every asset CRC or archive chunk and do not infer
crash causes or bisect mods. Models are static base assets with basic lighting;
model forging, broad VFX browsing and richer ability playback remain future work.
Native macOS/Linux ChatLane conversion, Windows/Linux artifact execution and a
published release remain unverified or unavailable.
