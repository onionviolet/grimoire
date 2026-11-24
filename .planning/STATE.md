---
status: release-candidate-preparation
current_focus: Fork v1.35.2 upgrade acceptance and release verification
last_updated: "2026-11-24"
previous_release: v1.28.2
candidate_version: v1.35.2
upstream_source: 6fec44a1
---

# Project State

Fork main at `619a03ba` already contains upstream's v1.35.1 stable tag and
its current main at `6fec44a1`. The fork candidate is v1.35.2, one patch above
upstream stable. The candidate adds the November 23 and 24 local changes to
that baseline. Its version and changelog are prepared locally. The final
release commit and hosted verification are still open. The release workflow
pins the fork's vpkmerge 0.30.1 engine at `c34fadf`.

The [feature audit](../docs/feature-audit-2026-11-23.md) owns the audit fixes
and their evidence. The [Discord intake](../docs/discord-feature-requests-audit-2026-11-23.md#implementation-follow-through)
tracks profile notes, localization merge, archive folder grouping, mixed-pack
sound overrides, NTFS VPK compression, the taskbar game indicator, and Hideout
paintings. The [animation playback brief](../docs/mod-animation-playback-brief.md)
records the stock/applied preview check. The [feature follow-up](../docs/feature-followup-2026-11-23.md)
tracks upstream candidates and the broader product ideas. The last published
fork release is v1.28.2.

The November 23 Windows fork build was packaged, installed in the existing
per-user location, and opened from that location. Its packaged archive matches
the smoke-tested build. See the [local installation record](../docs/feature-audit-2026-11-23.md#reconciled-windows-installation)
for test counts and build identity.

The [November 24 internal release note](../docs/internal-release-note-2026-11-24.md)
owns the candidate inventory and verification. It includes the latest Chat
Wheel safeguards, sound editing and batch staging, and Browser bookmarks.
The empty GitHub draft `internal-2026-11-24` points to the older committed
baseline and has no candidate artifacts.

## Remaining work

- Profile recovery retains user-mod bytes and rolling history, supports
  explicit local mapping, and restores reserved Locker files and their
  metadata. The remaining setup scope is in BACKLOG B-08.
- General model authoring, exact cast-event playback and application rollback
  remain in BACKLOG B-01, B-04 and B-09.
- The Windows animation fixture played stock and modded clips on one model.
  Exact cast effects still need verified game event joins. The three-platform
  publication gate and current Deadlock acceptance remain open.
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
