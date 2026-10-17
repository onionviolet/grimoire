# Setup evidence, reusable merges and animation auditions

Implemented on `codex/finish-requested-features` after `2aa5aef8`. Current
inventory belongs to `feature-status.md`; remaining work belongs to
`.planning/BACKLOG.md`. Browser work already present in the shared checkout is
outside this change.

## Delivered in source

- Recovery can review the current base-index fingerprint, enabled VPK/chunk
  bytes, placement/load order, reserved Locker bytes, managed configuration and
  managed launch options. A person
  can record works/crashes feedback with a note. Up to 100 local records survive
  restart, stay separate by installation and become outdated when the reviewed
  inputs change. This is manual evidence, not an automatic compatibility verdict.
- New isolation sessions verify an empty-user-mod baseline and then reproduce
  the original failure. Delta-debugging trials only narrow to reported crashing
  subsets or complements, retaining interacting groups when single-mod trials
  work. Existing sessions keep their older algorithm. Every trial and restore
  retains the existing stopped-game, journal and fresh-review requirements.
- Profile review can explicitly map an unresolved entry to a selected local mod.
  It regenerates the review, rejects duplicate targets and binds physical VPK
  and chunk hashes to acceptance. The reorder uses the selected mod's stable
  identity after renames. A mapped apply leaves the saved profile unchanged and
  does not claim its exact active-profile marker.
- Merge review and build share the same flattened leaf resolution. Local recipes
  store exact source identities, winner order, strict mode, path policy and output
  CRC/size baselines. Recipe loading reports added, removed and changed output
  paths. Filtering accepts exact paths and folder prefixes, bounds repacking to
  256 MiB and 64 MiB per asset, and verifies kept CRCs. Source-byte tokens reject
  drift before placement. Existing local rebuilds preserve policy and order.
- Ability audition can choose the stock or applied model/audio source, explicitly
  choose an available animation when the token join is ambiguous, and pause,
  resume or replay without another export. Changing hero/source hides stale
  results and does not automatically start another audition. Manual selection
  does not create a verified slot/event association.
- Download-cache review exposes exact local copies and protected partials.
  Cleanup requires a current inventory token and lists its write set before
  deletion. Transfers and maintenance share ownership. Installed originals and
  recovery blobs live elsewhere; retryable partials and recent orphan partials
  remain protected. Unknown files and symlinks are skipped.
- Update selection defaults to stable, with explicit preview opt-in and no
  automatic downgrade. Startup checks default off and require separate opt-in.
  The release workflow accepts optional fork-owned Windows certificate secrets
  and keeps platform credentials separate. macOS's manual-update rule remains.

## Validation

- Final full suite on Node 20.20.2: **3,159 passed, 12 skipped**, 295 passing
  files and one skipped file, completed 2026-10-04. Concurrent/multiworker
  attempts hit five-second Chat Wheel/recovery timeouts. The final one-worker
  run passed without changing timeouts; the isolated recovery file also passed
  all 40 tests in 3.31 seconds.
- Typecheck, ESLint, UI ratchet, English keys/catalog manifest, encoding,
  upstream-reference and engine-pin checks passed.
- The real-VPK integration test used the bundled engine against temporary
  files. It saved/loaded recipes, detected changed CRCs and paths, refused a
  stale build, and merged a nested selection into the reviewed filtered set.
- Production Electron build: zero unresolved main-process imports. The arm64
  macOS app directory packaged, was ad-hoc signed and launched successfully.
  A new, unseeded slot 53 had startup update checks off and `checked: false`.
- Packaged native IPC reviewed two synthetic VPKs, captured the setup identity,
  saved/loaded a recipe and produced identical output-path baselines. Profile
  mapping updated the counts from one available/one disable to two available/zero
  disables. Cancel preserved both VPK hashes. Cache cleanup removed the reviewed
  completed copy and retained the partial; a subsequent restart recognized the
  saved paused job.
- Native views and confirmations at 900 px had no horizontal overflow or UI
  alerts. Screenshots were inspected: [Recovery](./screenshots/setup-evidence/recovery-900.png),
  [profile mapping](./screenshots/setup-evidence/profile-mapping-900.png), and
  [cache confirmation](./screenshots/setup-evidence/cache-confirmation-900.png).
  The minimal synthetic gameinfo intentionally produced configuration findings;
  this was not a real-game acceptance run.

## Remaining boundaries

Arbitrary GLB/skeleton authoring and animation retarget are not implemented.
Every ability's cast-particle join remains unavailable; manual clip audition and
ambient sprite inspection do not establish exact event timing or Source 2 fidelity.
Reserved Locker artifacts and their owning selections remain outside profile
restore points. Imported VPK imprints and portable source share codes do not
transport local recipe/filter intent. Application installer retention and rollback
across data migrations remain open. Certificate configuration is not evidence of
a signed artifact. Windows/Linux execution, real-game behavior and publication
remain unverified by this local pass.
