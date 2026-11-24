# Grimoire fork release notes

Internal candidate v1.35.2 | November 24, 2026 | Since the published fork v1.28.2

The fork incorporates upstream stable v1.35.1 and upstream main at
`6fec44a1`, both ancestors of fork main at `619a03ba`. Upstream also has
an intervening v1.35.2 nightly based on that main commit. The fork's
version rule uses the latest stable patch, so the local candidate is
v1.35.2. The release pins fork vpkmerge 0.30.1 at `c34fadf`. The final
release commit and hosted builds are still pending. [Upstream stable](https://github.com/Slush97/grimoire/releases/tag/v1.35.1)

## November 24 player improvements

- **Undo a removed download.** The queue names the file you removed. Undo
  puts the same saved job back ahead of a surviving neighbor when possible.
  If the download already started, the waiting-row action leaves it running.
- **Open a mod's overlaps from Installed.** The badge opens the affected
  pairs by installed mod ID and includes its grouped variants. The Overlap
  cards show the load-order winner.
- **Test crosshair spread.** See the gap open and settle over the existing
  game backgrounds. The illustrative motion runs entirely inside the preview.
- **Try a mod for one launch.** Add one disabled mod to your active setup.
  Review any enabled variants that will be paused and other mods with shared
  files. Grimoire journals the changes, restores the setup after Deadlock
  exits, and resumes the restore check if Grimoire is reopened.
- **Audition an ability three times.** The experimental 3D ability preview
  can repeat the cast at the configured sound gain and pitch, then audition
  the stock sound on the same selected model and clip.

## Later candidate additions

- Browser bookmarks add the address-bar star, local folder management, search,
  an optional bar, and familiar shortcuts that reach the app from the guest.
- Chat Wheel separates draft save, export and activation, checks transitions
  that could strand custom bindings, and exposes mount and option evidence in
  Chat Wheel and Recovery.
- Foundry Sound adds stock A/B, waveform zoom, keyboard trim, and reviewed
  voice-folder staging. Recovery adds patch-change evidence. Profile restore
  includes Grimoire-managed launch options and copyable compatibility reports.

## Reconciled changes since v1.28.2

| Area | Changes in this candidate |
|---|---|
| Installed and Browse | Mixed Mods, Sounds and WIPs feed, hero and category filters, file-level install and update choices, local variants and lists, updated mod repairs and backups, source removal badges and filtering, Saved notes that survive a missing catalog row, and archive folder groups in the VPK picker. Windows can opt in to compress disabled VPKs in place. |
| Downloads and Browser | Persistent download history and explicit retry, resume checkpoints, archive deduplication, reviewed cache cleanup, reorder and prioritization, rate and failure feedback, configurable browser filtering with site exceptions, find and zoom, and guarded downloads into review. |
| Locker, Foundry and Forge | Reworked hero browsing and stage, outfit and animation comparisons, exact-entry model and asset inspection, reviewed model bundles, shared build tray, sound trim/gain and shuffle pools, mixed-pack ability sound overrides, recolor and portrait changes, Hideout painting textures, and Forge's opt-in bridge with confirmation and disabled imports. |
| Config, Chat Wheel and play | Reviewed Config edits and bundles, launch-option and performance state checks, native Chat Wheel VPK/YAML round trips, crosshair sharing, and an optional Windows taskbar game-running indicator. |
| Profiles, Overlap and Recovery | Apply review and explicit replacements, local profile notes, shuffle settings, recovery of journaled mod order and reserved Locker selections, setup history and manual isolation, crash-to-Recovery links, overlap search and local variant labels, reviewed merge recipes and localization VPK exports. |
| Discover, stats and settings | Existing profile publishing edits, availability and missing-mod feedback, rank and match views, appearance options and settings search. Live service and signed-in behavior still depend on their configured services. |
| Update and packaging | Stable/nightly policy and cache checks, retained native module and asset-protocol smoke coverage, and packaged smoke in the Windows, Linux and macOS release matrix before attestation/upload. |

## 3D playback and where to take it

- **Available now.** Pin an animation mod in Installed, pick a clip, choose a
  compatible body, and switch stock/modded motion while keeping the view
  and playhead. There are pause, scrub, replay and speed controls. The prior
  Windows package played the two distinct Vindicta Crow cast exports on the
  same installed body. Locker separately renders known clips and tuned audio
  in its experimental hero stage. See `docs/mod-animation-playback-brief.md`
  in the working tree for the asset and package evidence.
- **Current source evidence.** The preview shows the exact model entry when
  available, model export inputs and the auditioned sound VPK. Validate one
  complete cast in a private session using Vindicta's Crow, which has both
  motion variants exported. A synchronized particle preview needs a verified
  event timestamp and attachment.
- **Then make it useful for movement.** Test an idle-to-dash or stop transition,
  including root motion, a foot plant and cloth on one replacement skin.
  Source 2 Viewer documents AnimGraph 2 playback and frame stepping, and can
  serve as a reference for the same inputs. Grimoire's current clip viewer
  still has finite rig coverage and approximate scene and particle behavior.
  [Source 2 Viewer 21.1](https://s2v.app/release/21.1/)
- **Other short trials.** Confirm that a hero's HUD portraits and crosshair stay
  readable against busy scenes, that a repeated ability cue stays distinct at
  match volume, and that a large library recovers cleanly after a game update.
  Any automatic mid-match chat-wheel switching, VData rebase, CompLock import
  identity, live match presence, or general retargeting needs separate proof.

## Verification and release gate

The first November 24 candidate passed typecheck, UI and locale checks, the
fork engine pin check, and the production build. Its Node 24 run passed
7,158 tests and skipped 29. Lint reported 114 warnings
and zero errors. The unsigned Windows x64 unpacked smoke passed after staging the
verified better-sqlite3 12.11.1 binding for Electron 44.10.1. The initial
local packager reused the Node 24 test binding. In the unpacked app, the
crosshair visibly changed and returned to its resting pixels, the focused
Overlap route handled an absent mod, and the new preload methods were
present. Service tests use temporary files to check trial application,
variant replacement, failed launch, normal exit and restart recovery.

The later Browser and backlog passes brought the local Node 24 result to
7,167 passed and 29 skipped. Their packaged Windows checks verified offline
Chat Wheel draft save and Browser bookmark title capture, folder grouping
and the guest shortcut bridge. This evidence used fixture profiles and the
previous v1.35.1 package version. [Feature follow-through](fork-backlog-review-2026-11-24.md)

The November 23 audit owns evidence for the earlier package and its local
Windows install. Its packaged smoke checked preload IPC, SQLite/FTS5, the
mod safety worker and custom asset protocols. It also records which local
asset, Browser and Forge flows were exercised.
The source records are `docs/feature-audit-2026-11-23.md` and
`docs/discord-feature-requests-audit-2026-11-23.md`.

The current one-launch, spread and three-cast flows still need hands-on
Deadlock acceptance. Also open are the live Forge VPK handoff, browser
download acceptance, and signed-in service checks. The authoritative
publication gate is the hosted Windows, Linux and macOS package-and-smoke
matrix for the final release commit, with signing verified where configured.

The locally versioned v1.35.2 working tree passed the simulated tag/version
check and changelog generation. Node 24 passed 7,167 tests with 29 skipped.
Typecheck, UI, encoding, locale, engine pin and ChatLane resource checks
passed. Lint reported 114 warnings and zero errors. The production Windows x64 unpacked package passed the isolated
smoke with the existing Electron 44.10.1 SQLite binding and fork vpkmerge
0.30.1 (`c34fadf`). This proves startup and the smoke fixtures. Installer
upgrade, signed artifacts, and the hosted matrix remain separate evidence.

## Release preparation

1. Review exactly which working-tree changes make the candidate commit. The
   `.reasonix` desktop metadata and local build artifacts are outside it.
   The existing `internal-2026-11-24` draft points to `619a03ba` and has no
   assets. It is an earlier record. [Internal draft](https://github.com/onionviolet/grimoire/releases/tag/untagged-1585d2fbd4b6b7a0b22c)
2. Exercise the Windows upgrade from the last published fork, v1.28.2, in an
   isolated profile. Check that the installed app starts with the expected mod
   list, profile and configuration intact. Use the existing installer lineage
   and fork update feed. Keep a copy of the pre-upgrade profile and metadata
   with the previous installer. Verify any old imprinted or merged VPKs still
   resolve their original identity. The legacy readers shipped in v1.28.2.
   Record the tested upgrade and the manual rollback path.
3. Run the existing branch-dispatch build-only workflow on the candidate commit.
   The prior run built Windows and Linux. Its macOS job was cancelled with no
   assigned runner or executed step reported, so Apple Silicon still needs a
   successful hosted package and smoke. [Prior release workflow](https://github.com/onionviolet/grimoire/actions/runs/45265713602)
4. Use a private current-game session for the high-consequence checks already
   in scope, especially Chat Wheel activation, unbind and removal and one-launch
   restore. Keep live preset switching, exact cast-effect timing, and app rollback
   in the backlog while their prerequisites are open.

Pushing a version tag starts the publishing workflow. Check upstream stable
again immediately before tagging, since a new stable release would change the
fork's patch-plus-one target. The changelog section holds the outward notes for
review.
