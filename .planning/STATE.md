---
status: release-candidate-preparation
current_focus: Fork v1.35.2 upgrade acceptance and release verification
last_updated: "2026-11-26"
previous_release: v1.28.2
candidate_version: v1.35.2
upstream_source: 6fec44a1
---

# Project State

The fork candidate is v1.35.2, one patch above upstream stable v1.35.1.
As of November 25, `origin/main` is `619a03ba` and contains upstream main
at `6fec44a1`. Local `main` has the versioned candidate at `5160f671`.
The feature branch adds the Sound Forge commit `2d873ce9` and has local
follow-through for Stock VFX, package review, assisted isolation and profile
duplication. The release workflow pins fork vpkmerge 0.30.1 at `c34fadf`.

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

The [internal release note](../docs/internal-release-note-2026-11-24.md)
owns the candidate inventory and verification, including the November 25
reconciliation. [CHANGELOG.md](../CHANGELOG.md) feeds the public release notes.
The asset-free GitHub draft `internal-2026-11-24` records the earlier remote
baseline. The candidate passed the local Windows packaged smoke and opened
a disposable v1.28.2 profile with its settings, mod order and files intact.
The final release commit, in-place Windows Setup upgrade and hosted
verification are still open. [Windows verification](../docs/internal-release-note-2026-11-24.md#november-26-windows-verification)

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
| ROADMAP.md and REQUIREMENTS.md | Last scheduled milestone scope, shipped as v1.28.2 |
| WINDOWS.md | Defects and unrun verification |
| BACKLOG.md | Future work |
| MILESTONES.md | Published history |
| ../docs/feature-status.md | Implementation inventory |

The superseded state is preserved verbatim in
[the archive](../docs/archive/state-before-1.30-parity-2026-10-03.md).
