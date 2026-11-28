# Grimoire fork release notes

Internal candidate v1.35.2 | November 24–26, 2026 | Since the published fork v1.28.2

The fork incorporates upstream stable v1.35.1 and upstream main at
`6fec44a1`, both ancestors of fork main at `619a03ba`. Upstream also has
an intervening v1.35.2 nightly based on that main commit. The fork's
version rule uses the latest stable patch, so the local candidate is
v1.35.2. The release pins fork vpkmerge 0.30.1 at `c34fadf`. The final
release commit and hosted verification are still pending. [Upstream stable](https://github.com/Slush97/grimoire/releases/tag/v1.35.1)

## November 25 candidate reconciliation

GitHub still lists v1.28.2 as the latest published fork release. Upstream
stable remains v1.35.1. The versioned local `main` candidate is `5160f671`.
The release notes also cover the feature branch at `2d873ce9` and its four
working-tree additions, on the assumption they will land in the candidate.
Review that scope against the final commit before generating publication notes.
[Fork releases](https://github.com/onionviolet/grimoire/releases)

| Source | Disposition and acceptance |
|---|---|
| Sound Forge F1–F4 and A1 | Commit `2d873ce9` adds transactional installs and rebuilds, provider and shared-event review, stock identity and imported-file relinking, and baked audio metrics and audition. The [Sound Forge assessment](foundry-sound-audit-2026-11-24.md#implementation-follow-through) records the isolated Windows package and IPC checks. The current-game sound matrix is open. |
| Peer scout F1 | Foundry can review supported single-hero skin VPKs and export a separate stock particle overlay or add it disabled. Review lists paths left alone and missing stock or dependency entries. The mixed-pack service fixture covers overlay contents. A private match with a real skin still needs to confirm model and sound retention, stock effects, precedence and undo. |
| Peer scout F2 | Installed and crash advisories link to Recovery's assisted isolation. Recovery starts the existing health scan and focuses isolation once the game path is ready. Native navigation from a named crash, a generic crash and Installed remains open. |
| Peer scout F3 | Foundry reviews a bounded ZIP against the selected game build and reports invalid packages, missing model references and overlaps with enabled mods. The service fixtures check valid stock references, missing and sibling references, and overlaps. A packaged author workflow and an in-game check remain open. |
| Peer scout F4 | Profiles can duplicate a saved profile with a fresh identity and the same installed mod references. The service test covers the saved copy. Applying and independently editing both profiles in the packaged app offline remains open. |

The peer scout's other signals remain research. General catalog sources and
local hosting stay parked. The cache and packaging reports remain triggers for
targeted reproduction if the same symptoms arise in Grimoire. The prior audit
and verification sections below retain their original evidence dates.
[Peer scout](deadlock-manager-peer-scout-2026-11-24.md)

The November 25 working tree passed typecheck, UI and locale checks, the
fork engine pin and native ChatLane resource checks, and encoding checks.
Vitest passed 7,172 tests with 29 skipped. The four focused suites for the
peer follow-through passed all 25 tests on Node 24. Lint reported 115 warnings
and zero errors, including a React effect warning on Recovery's automatic scan.
The simulated v1.35.2 tag matched `package.json`, and the release
script generated the v1.35.2 section of [CHANGELOG.md](../CHANGELOG.md).
Earlier package and installation evidence applies to the revisions below.
The current candidate still needs the Windows upgrade check and hosted
Windows, Linux and macOS package and smoke runs on the release commit.

## November 26 Windows verification

- Built the current v1.35.2 feature working tree as a Windows x64 directory
  package with Electron 44.10.1 and vpkmerge 0.30.1 (`c34fadf`). Staged the
  existing Electron ABI build of better-sqlite3 in the temporary package.
  The packaged smoke passed: native Chat Wheel draft save, preload, SQLite
  and FTS5, the safety worker, and the three custom asset protocols. It
  reported zero renderer console errors and uncaught exceptions.
- Verified the published v1.28.2 Windows Setup download against the release
  checksum and extracted its app without running the installer. It saved a
  disposable profile with two enabled VPKs. The v1.35.2 package reopened
  that profile with the same game path, language, Chat Wheel preference,
  active profile and mod order. Both VPKs and `gameinfo.gi` matched byte for
  byte. The first attempt had left onboarding active in the fixture, so the
  old app detected the local Steam installation. The recorded pass used a
  configured fixture with a path assertion before library or profile access.
- The in-place Windows Setup installer upgrade, legacy merged or imprinted
  VPK fixture, and hosted Windows, Linux and macOS matrix on the final
  release commit remain pending. [Published baseline](https://github.com/onionviolet/grimoire/releases/tag/v1.28.2)

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

The November 24 versioned v1.35.2 working tree passed the simulated tag/version
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
## November 27 Windows candidate replay

The installed Windows app reported 1.35.1. The retained unpacked candidate reported 1.35.2 on Electron 44.10.1, with `app.asar` SHA-256 `6f4a45a46b8e0df833cdd142952958d904e15f48b211742a73620c6b33ee9f1c`.

On a separate desktop with a disposable profile, the candidate's **Duplicate profile** button created a second profile with a distinct ID and name. Reading back both profiles through the packaged preload showed the same enabled VPK reference, priority and note. This checks profile duplication. Applying the copied profile to a live game was outside this trial.

The packaged smoke previously compared two version readings from the running app. Both could agree on an older package. With 1.35.2 as the expected version, the installed baseline exited 1 and the matching candidate passed the full packaged smoke with exit 0. Both removed their temporary app and profile. Earlier Windows runs could leave the tray process holding that directory after the assertions completed. The smoke now terminates its own disposable Windows process tree before cleanup. This replay covers the retained Windows package. The hosted release matrix and publication are separate steps.
