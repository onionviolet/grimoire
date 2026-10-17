---
status: source-verified
current_focus: Upstream v1.30.1 parity and fork quality
last_updated: "2026-10-03"
previous_release: v1.28.2
upstream_source: de1e4a51bfc5e7bebbc6e7afc584c8f6061add4a
---

# Project State

The current source integrates upstream v1.30.1 while keeping the fork's
Foundry, sound, Config, Saved and browser workflows. Profile application now
reviews missing, changed and ambiguous matches before writing. Dev slots select
their data directory before eager SQLite services initialize. The release
workflow builds the pinned fork engine on all three supported platforms with
an immutable upstream reader repair.

Implementation and verification evidence lives in
[the intake record](../docs/upstream-absorption-1.30.md). This source work is
not a published release or an installed-app update. The last published fork
release remains v1.28.2 until a new release is explicitly built and published.

## Remaining work

- Profile recovery still needs full local-asset rollback, rolling history and
  manual mapping. The review is a bounded improvement to fork issue 28.
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
