---
status: source-verified
current_focus: Setup evidence, reusable merges and model auditions
last_updated: "2026-10-20"
previous_release: v1.28.2
upstream_source: 01d6822c
---

# Project State

The current source integrates upstream v1.33.0 (intake record: [upstream-absorption-1.33.md](../docs/upstream-absorption-1.33.md); open gates there: fork engine pin vs newer vpkmerge verbs, nix hash, pnpm 10 lockfile check, packaged build). It previously integrated upstream v1.30.1 while keeping the fork's
Foundry, sound, Config, Saved and browser workflows. Profile application now
reviews missing, changed and ambiguous matches before writing. Dev slots select
their data directory before eager SQLite services initialize. The release
workflow builds the pinned fork engine on all three supported platforms with
an immutable upstream reader repair.

Implementation and verification evidence lives in
[the intake record](../docs/upstream-absorption-1.30.md) and
[the setup feature record](../docs/setup-evidence-and-auditions-2026-10-03.md), with
[ability playback follow-through](../docs/ability-playback-implementation-2026-10-09.md).
This source work is
not a published release or an installed-app update. The last published fork
release remains v1.28.2 until a new release is explicitly built and published.

## Remaining work

- Profile recovery now retains user-mod bytes and rolling history and supports
  explicit local mapping. Full Locker-owned recovery remains in BACKLOG B-08.
- General model authoring, exact cast-event playback and application rollback
  remain in BACKLOG B-01, B-04 and B-09.
- Ability auditions now share a decoded-audio/animation timeline, hero rendering
  and exact-entry event inspection. A complete cast effect needs real game assets
  and verified joins. The latest packaged playback check stalled in macOS
  Keychain access; a successful package build does not settle that runtime gate.
- Windows/Linux packaging and Source 2 behavior need their own evidence. The
  macOS smoke uses an isolated fake install and inert VPK fixtures.
- A new milestone is not scheduled. Future feature work remains in BACKLOG.md;
  prior verification debt remains in WINDOWS.md.

## Register map

| Register | Holds |
|---|---|
| ROADMAP.md and REQUIREMENTS.md | Scheduled milestone scope |
| WINDOWS.md | Defects and unrun verification |
| BACKLOG.md | Future work |
| MILESTONES.md | Published history |
| ../docs/feature-status.md | Implementation inventory |

The superseded state is preserved verbatim in
[the archive](../docs/archive/state-before-1.30-parity-2026-10-03.md).
