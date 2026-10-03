# Parallel feature follow-up

Implemented on `codex/finish-requested-features`, based on fork main `9cdee122`.
This is source and isolated-artifact evidence, not a published release or an
in-game acceptance record. `feature-status.md` owns the current inventory and
`.planning/BACKLOG.md` owns forward work. The earlier delivered slice remains
recorded in `recovery-and-models-2026-10-03.md`.

## Delivered

- Recovery compares patch-sensitive replacement paths, including Panorama,
  against the local base index. Guided isolation saves the original setup,
  establishes a zero-user-mod baseline, narrows groups using manual feedback
  and restores the original state. A remaining candidate is a lead, not a
  proven crash cause. Every trial and restore requires a stopped game and a
  fresh reviewed state.
- New v2 profile recovery points retain deduplicated VPK and archive-chunk
  bytes, raw configuration, the performance sidecar, touched metadata and the
  active marker. Deleted assets can be recovered. A persistent restore journal
  preserves preimages and supports explicit interrupted-operation rollback.
  External edits and deletions during safety checks or blob copying are
  preserved. Garbage collection skips unreadable ownership and protects the
  active isolation point. Legacy v1 and older v2 points remain readable.
- Foundry Assets searches exact texture/material/particle paths. Native
  particle projection uses the existing engine's generic read-only KV3 decoder,
  authored child references and decoded textures. Experimental sprite previews
  honor color operators, applied recolors, inherited control points and authored
  attachment offsets. Ability auditions reuse the selected outfit resolver and
  applied Locker audio owner. Inspection caches share canonical Foundry build
  fingerprints and active-export retention, with a 256 MiB budget. Reading an
  inspection fingerprint does not build an unrelated voice-line catalog.
- Config stages typed edits, displays stock/preset/resolved values, preserves
  unknown keys and manual autoexec/crosshair content, and saves launch options
  for the next managed launch. Grimoire-only JSON bundles stage supported values
  for review. Stale reviews reject writes, sidecar persistence is mandatory for
  Config transactions and failures attempt each file rollback independently.
  Explicit opt-in edits take effect without enabling unrelated options. Editing
  an older preset keeps its exact version and baseline.
- Chat Wheel reads, builds and validates VPKs natively on Windows, macOS and
  Linux. Pinned MIT data and the bundled YAML parser replace the external
  Windows executable. Original YAML bytes survive unknown fields, comments,
  Unicode, BOM and CRLF. The native reader bounds VPK v1/v2 input, validates
  CRCs and supports preload bytes and external chunks. Resource hashes are
  checked before packaging.

## Verification

- Full Vitest on Node 20.20.2: **3,115 passed, 12 skipped**, across 283 passing
  files and one skipped file. The full local Node 26 suite also passed.
  Four-worker runs avoided a contention timeout during concurrent packaging;
  no test timeout was increased.
- Typecheck, ESLint, UI ratchet, English keys/catalog manifest, encoding,
  upstream-reference and engine-pin checks, and native ChatLane resource hashes.
- Production Electron build with the fork marker: zero unresolved main-process
  imports. Local arm64 macOS app directory packaged and launched with isolated
  userData. Native Chat Wheel starter validation, VPK save/read with an unknown
  YAML field, Config snapshot and exact asset listing worked from the package.
- Isolated Electron fixture smoke: Config wrote minimap value 25, preserved
  manual commands (including an echo containing `Mod Manager`), saved managed
  commands and launch options, and rejected a stale review. Recovery disabled
  every enabled user mod for the baseline, narrowed manual feedback, restored
  the original setup, then recovered a deleted VPK from retained bytes.
- Config/Recovery at 900 px and Assets at 1440 px had no horizontal overflow.
  Screenshots were inspected from the isolated macOS artifact. These used a
  synthetic game directory, not a real installation.
- The current packaged app inspected a synthetic compiled `.vpcf_c` through
  native decoding, exposed its authored sprite renderer, and rendered the
  experimental WebGL canvas without UI alerts. This establishes the packaged
  decode/IPC/render path, not real-game particle fidelity.
- Independent original C# converter fixtures match the compiled KV3/RED2
  resource byte for byte. Independent ValveResourceFormat read-back accepted
  Unicode output. Native generic decoding also read a synthetic compiled
  particle and a real pinned MDAT fixture with 38 authored attachments.
- Independent read-only review found and fixed sidecar failure reporting,
  disabled opt-in edits, manual-line loss, older-version baselines, backup GC,
  async restore/rollback drift, missing Panorama coverage, cache invalidation,
  unbounded VPK indexing and misleading applied-audio fallback.

## Remaining limits

Reserved Locker artifacts remain with their own owner and are excluded from
profile backup and group isolation. Profile application itself is not journaled
as a process-crash-atomic operation. Isolation can miss interactions between
mods, and path presence or absence never proves compatibility or a crash cause.

Exact cast-particle event joins and animation retarget remain future work.
Sprite motion is approximate, unsupported authored classes are disclosed and
unresolved attachments are omitted. Positive audio boost is capped for the
initial browser audition; native audio controls replay the raw clip. Model
inspection does not author or stage model replacements.

Windows/Linux artifact execution, live-game effects and a published release
remain unverified. Source improvements do not establish human acceptance or
Source 2 fidelity.
