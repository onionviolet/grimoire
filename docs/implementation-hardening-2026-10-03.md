# Implementation hardening and follow-through

Implemented on `codex/finish-requested-features` after `75415e90`.
`feature-status.md` owns the live inventory and `.planning/BACKLOG.md` owns
future work. This is source and isolated-fixture evidence, not a published
release or real-game acceptance.

## Recovery transactions

Isolation records its session preimage before changing game files, commits the
new phase inside the same journal and only then clears the journal. Completing
isolation journals the session removal too. A session persistence failure rolls
both the files and phase back.

Profile application enrolls existing mod renames and gameinfo repairs in the
journal. It captures metadata preimages and the active marker, journals the exact
autoexec output before writing and rolls back on operation failures. Interrupted
rollback checks a stopped game without a normal mod scan, because scan-time
reconciliation could change temporary names. External file, session, metadata
and relevant settings edits block rollback rather than being overwritten.

Config computes its output in a temporary installation layout using the existing
writers. It retains and journals every changed file's expected bytes before
placement, includes launch-option preimages, rechecks reviewed inputs and returns
success only after the journal clears. A pending journal blocks another capture.
Recovery exposes explicit interrupted rollback.

Reserved Locker artifacts remain outside profile snapshots. Empty folders and
one-time gameinfo backup copies can remain after rollback. This is a process
interruption contract, not a guarantee against arbitrary hardware failure.

## Config drafts and preview lifetime

Config's in-memory store retains drafts and their original review token across
route changes. A different installation gets a different workspace identity;
stale reviews still reject writes. Confirmations show actual command additions,
removals, the final ordered list and old/new launch options without truncation.
Bundle export continues to mean saved configuration.

Static model and ability previews use owned GLTF loads. Closing, changing a URL
or receiving a late result disposes their geometry, materials, textures and
skeletons without leaving models in the global Suspense cache. Ability URLs use
an output digest. A four-entry, 500,000-record VPK index cache shares explicit
writer invalidation and checks inode, size, modification time and change time.

## Compiled model replacement contract

Models accepts a user-selected `_dir.vpk` bundle containing the exact selected
base catalog model path. Only compiled model/material assets are allowed, with
bounded entry count and bytes. CRC checks cover the decoded entry bytes,
including chunk-backed content. The reader validates resource blocks and RERL
references against either the bundle or installed base index. The format follows
[ValveResourceFormat's external reference reader](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/master/ValveResourceFormat/Resource/Blocks/ResourceExtRefList.cs).

A static preview is prepared before staging. The shared tray reviews every
included path, resolves collisions, exports or installs, and records model
provenance for My changes. Forging revalidates the source/base fingerprint and
reviewed write set. Native VPK packing shares the Chat Wheel writer, keeping its
existing converter-fixture coverage. No new engine flag or dependency is needed.

This supports compiled replacement bundles. It does not compile arbitrary GLBs,
remap paths, rebuild skeletons or prove Source 2 compatibility. Static dependency
presence cannot prove runtime animation or material behavior.

## Persistent downloads

Jobs are saved before entering the queue. Interrupted jobs load as paused; no
saved job executes on startup. Recovery lists queued, downloading, retrying,
paused, failed, cancelled and completed jobs, with explicit per-job retry. The
idle download indicator exposes resumable jobs. Completed jobs survive another
job's failure; history retention is bounded.

Partial bytes live outside disposable extraction folders. Checkpoints record a
synced prefix hash, byte count and server validator. Resuming validates that
prefix, drops any uncheckpointed tail and uses Range/If-Range. Changed or ignored
ranges restart safely. Transient failures use bounded backoff. The existing
GameBanana mirror selection and failover still choose transfer endpoints.

Completed archives are verified and stored by content hash. Reuse verifies their
bytes again before installation. Cache pruning protects the current artifact and
uses a 512 MiB completed-blob budget. Recovery copies and installed originals are
separate. Partials remain available for retry; this does not add a cache management
UI, release channels or updater rollback.

## Verification

- Final full suite on Node 20.20.2: **3,129 passed, 12 skipped**, 287 passing
  files and one skipped file. The local Node 26 suite also passed at 3,129 tests
  before the final diagnostic-only profile cleanup. A concurrent Node 20 run
  was stopped after existing Chat Wheel interaction timeouts; the serialized
  final run passed without changing timeouts.
- Typecheck, ESLint, UI ratchet, i18n/catalog manifest, encoding, reference,
  engine-pin and native ChatLane resource gates.
- Production Electron build with zero unresolved main-process imports.
- Isolated Electron 35.7.5 slot 13, seeding disabled, with synthetic game files:
  Config wrote minimap value 25 while preserving manual commands; a disabled
  profile applied; isolation tested its baseline and restored the original setup.
- Native Config draft navigation and confirmation at 900 px: draft retained and
  no horizontal overflow. Screenshots inspected:
  [Config review](./screenshots/hardening/config-review-900.png) and
  [Models catalog](./screenshots/hardening/models-900.png).
- Regression coverage includes isolation phase-write failure, a later profile
  toggle failure, stale compiled-model sources, missing dependencies, late GLTF
  disposal, VPK index invalidation, disk transfer resume, retries, durable job
  reload and tampered completed cache bytes.

Windows/Linux artifact execution, real-game models and effects, hardware failure,
release publication and human acceptance remain unverified.
