# Changelog

All notable changes to this project are documented here. Format is loosely based on [Keep a Changelog](https://keepachangelog.com/), and the project adheres to semantic versioning.

## [1.25.1724] - 2026-07-29

### Added
- **Portraits now have an installed-content shelf in Locker.** Hero Cards show
  each source mod's provenance and enabled state, can resolve exact card-entry
  winners on demand, and flag recorded overlaps between enabled mods without
  guessing at unrecorded paths.
- **Forged portrait shuffle pools live beside Cards.** The hero page reuses the
  existing Foundry contended-path pool and launch-shuffle rules instead of
  inventing a second portrait randomizer.

### Changed
- Hero-card variants use surface-oriented names such as Minimap icon and
  Compact hero portrait; the original variant token remains available in the
  art tooltip.
- Empty custom-card slots reveal the base art at full color on hover, making it
  easier to judge the image before uploading a replacement.
- Foundry sound-row chrome is localized for annotation, base-game labels, and
  source inspection.

## [1.25.1723] - 2026-07-29

Three surfaces that were each missing the same thing: a way to see what you
already have. The chat wheel showed a fake wheel, portraits were buried in a
grid of everything else, and sound mods had no home beyond a per-ability
picker.

### Added
- **The Chat Wheel preview is the real wheel now.** A donut of wedges drawn to
  the game's own geometry, replacing the 3x3 grid of rectangles, so you can see
  label fit and which wedge a command actually lands on before saving. Wheels
  hold up to 12 entries and fill the whole circle, and the `icon:` field is a
  picker over ChatLane's real icon names with a live thumbnail instead of a
  free-text box.
- **Foundry has a Portraits tab.** One card per portrait family per hero, in
  both the catalog rail and the hero workshop, opening straight into the
  existing crop editor. Previously the only way in was to filter the Library
  grid to hero images and recognize which card was a portrait base.
- **A Sound Locker: every sound mod you have, filed under the hero it
  changes.** A hero grid plus a Global shelf for the content that belongs to no
  hero (announcer packs, killstreak music, interface sounds), which until now
  had nowhere to live. Each hero shelf groups your installed sound mods by
  ability, voice, weapon and movement, with enable/disable in place.
- **Audition a sound mod from its own VPK.** The play button on a Sound Locker
  row plays the clip as that mod ships it, not the base game's version of the
  same path, so you can hear what a mod does before enabling it.
- **See exactly what a sound mod overrides, and who currently wins.** Expanding
  a row resolves its real entry paths and names the mod that beats it on each
  one, with a jump to that mod. A mod that records no paths says so instead of
  pretending to know.
- **Numbered takes read as one row.** Three lines of `ball_01/02/03` become one
  line with a take count. Your own annotation name now leads the label wherever
  an event is listed, instead of only when the Annotate toggle is on.

### Fixed
- **Portrait families were silently families of one.** The family key never
  matched real pak filenames (`astro_card_gloat_psd.vtex_c` carries a
  source-format token and sometimes a content hash), so the editor's own
  preflight only ever saw a single variant. It now covers the family it was
  always documented to cover.

### Changed
- The Locker and Foundry cross-link both ways for sounds: a hero shelf opens
  that hero's Foundry workshop on Abilities or Voice, the Global shelf opens the
  Global sounds tool, and Foundry's My changes links back to the shelf.

## [1.25.1722] - 2026-07-29

Locker and Foundry are one object at two moments: the Locker manages what you
have, Foundry makes more of it. Each had learned only half of the same lesson.
This release trades those halves.

### Added
- **The Foundry build tray can be previewed on the 3D model.** Stage a texture
  or portrait edit, flip on 3D, and see it on the hero before forging anything,
  stacked over the skins you already have enabled rather than on a vanilla
  model. The preview build is temporary in the strong sense: it never enters the
  addons folder, never changes Installed, and is removed when the panel closes.
- **The Locker says what an ability-sound pick will overwrite, before it
  writes.** Each source now reports the exact entries it would take over from
  what is applied, and how many entries the current source supplies that would
  revert to the game default (a pick rebuilds that ability's whole selection,
  which was invisible until now). Shown next to the control, not behind a
  confirmation dialog.
- **"What else writes these files" is answerable from the hero page.** With two
  or more skins enabled, the Skins section lists the exact entries the stack
  contests and which installed mods own them, without a trip to Conflicts.
- **The Locker warns when a custom hero card covers only part of its family.**
  A card is several images (main, low-HP, gloat, minimap); the picker now names
  the variants that will keep their stock art instead of leaving you to notice
  in-game.
- **The Foundry portrait editor no longer demands a file drop every time.**
  Images you framed before are offered back, and the game's own art for the
  entry can be loaded straight into the crop frame.
- **The Foundry hero grid shows what you have already made.** Each card badges
  its authored-change count, and heroes can be starred. Favorites are shared
  with the Locker, so a hero starred in one grid reads as starred in the other.

### Changed
- **Both hero pages now render from one frame.** The Locker hero view and the
  Foundry workshop had drifted into two copies of the same chrome, with
  Foundry's the visibly worse of the two. Foundry picks up the Locker's softer
  frosted-glass feather and its fuller hero-render fallback, so a hero with no
  render art degrades the same way on every surface.
- The Foundry hero grid's "in development" label is now translatable.

## [1.25.1721] - 2026-07-28

Maintenance release. No user-facing behaviour changes over 1.25.172.

### Fixed
- **Discover owner view counts and the gone-mods list could compile away.** The
  two reads that surface them were typed against a copy of the shared wire
  schema that only exists on a local checkout, so a packaged build could ship
  with those fields silently absent. They are now typed against the same schema
  the build pipeline resolves.

## [1.25.172] - 2026-07-28

### Added
- **Build tray reaches the hero workshop.** Staged edits are reviewable and
  forgeable from the hero-first Foundry view, not only the catalog view, and the
  texture browser can stage replacements like the library grid already could.
  The forge confirmation is now in-app and lists the exact write set and
  collision winners instead of a plain dialog.
- **Honest per-control state in the performance config.** Every HUD toggle and
  advanced slider is badged with where its value comes from (game default,
  managed preset, your override, or a value Grimoire cannot interpret), and each
  has its own reset that removes Grimoire's line rather than writing a value of
  its own. Changes now stage into a pending list with apply and discard instead
  of writing on every drag.
- **Discover mod availability (experimental social).** Published profiles show
  how many of their mods are still available on GameBanana, which mods you do
  not have installed yet, and, for your own profiles, a view count only you can
  see. Requires the companion service; profiles that have never been checked say
  so rather than claiming everything is fine.

### Fixed
- **Updates no longer pile up on disk.** Old installers and abandoned partial
  downloads left behind by previous updates are now swept on launch. Every
  accepted update used to leave roughly 100 MB behind forever.
- **Advanced performance sliders always claimed "using the game default".** The
  status read filtered out every advanced setting, so a value you had already
  set was never reflected back. The authoritative defaults also moved out of the
  interface and into the preset data, so a slider no longer presents an
  app-chosen number as if the game had chosen it.
- **Out-of-range performance values are no longer silently clamped or dropped.**
  A value outside the supported range is reported as such and needs an explicit
  confirmation before it is replaced. Setting one out of range used to report
  success while leaving the file unchanged.
- **A cancelled or failed forge leaves nothing behind.** A cleanup failure could
  previously reject a build that had already succeeded and orphan its temporary
  directory. Cancelling the save dialog now says so and keeps your staged edits.
- **Forging blocks when a recorded source file has moved**, naming the missing
  files, instead of failing partway through the build.
- **Offline and service-busy are distinct states in Discover**, each with its own
  retry, rather than one generic error.

### Changed
- Remaining hardcoded English in the Foundry asset-sources panel, staging
  confirmations, and My sound changes is now translatable.

## [1.25.171] - 2026-07-28

### Added
- **Combined Foundry VPK forge.** Stage compatible sound and texture replacements,
  review the exact final write-set and collision winners, then export them as one
  VPK without changing the Installed library. Cancelling the save dialog leaves
  staged sources and installed mods unchanged.
- **Chat Wheel form editor.** Edit a wheel's name, menus, and commands in a form
  with a live radial preview, alongside the existing Advanced YAML view. Comments
  and ChatLane options Grimoire does not recognize are preserved verbatim.

### Fixed
- **Atomic Foundry exports.** Exports now copy to a temporary sibling file before
  renaming, so a failed copy never leaves a partial VPK at the selected path.
- **Conflict check when staging a sound.** Staging a sound edit now runs the same
  exact-path conflict check the texture flow runs. A VPK that cannot be read
  blocks staging with an explanation, and an existing enabled owner is reported
  before the edit is staged.
- **Sound input wording.** The audio picker no longer claims MP3-only input;
  WAV, OGG, FLAC, M4A, AAC, and Opus are converted automatically. Staging a
  sound also no longer reports it as installed.

## [1.25.170] - 2026-07-28

### Fixed
- **Forked vpkmerge release packaging.** Windows release builds now compile and
  bundle the pinned `onionviolet/vpkmerge` revision (`798f3a7`) rather than the
  upstream fallback engine. This restores Foundry's Global sounds catalog and
  safe YCoCg icon replacement in packaged builds.

## [1.25.169] - 2026-07-28

### Added
- **Fork in-app update channel.** Packaged fork builds now identify the
  Onionviolet GitHub Releases feed as their update source, so future fork
  releases can download and install in-app without switching users to the
  official Grimoire channel.
- **Foundry sound workbench.** Browse and audition hero and global base-game
  sounds, forge replacement audio, inspect exact VPK conflicts, and manage
  multi-clip randomizer pools without leaving Grimoire.
- **Foundry portrait discovery.** Hero cards and portrait textures are included
  in the Foundry asset catalog as **Portraits & hero images**, alongside the
  existing Locker portrait-picker and launch-time card shuffle.

### Changed
- Clarified the fork's direction: Grimoire remains a Deadlock mod manager first, while expanding into a personal, player-focused customization workshop for safe organization, personalization, approachable creation, and sharing.
- Documented that this is a personal independent fork that remains open for others to use or contribute to, while encouraging support for the original Grimoire project and its creator.
- Foundry sound rows now identify both the engine event and the compiled
  base-game VPK target (for example, `charged_melee_full.vsnd_c`).
- Sound annotations are opt-in: the regular browse view stays uncluttered until
  **Annotate** is enabled.
- Release packaging currently targets Windows only while the cross-platform
  signing and artifact paths are completed.
- Fork builds now expose **Check for Updates**, download, and install controls
  in Settings instead of waiting for the next startup check.

## [1.10.0] - 2026-05

### Added
- **Grimoire Social: Discover page.** Browse mod profiles published by other Grimoire users behind the *experimentalSocial* setting (off by default). Cards are image-led with hero/variant badges and a viewer-aware Like toggle; click opens a detail dialog and Import hands the profile off to the existing `ImportProfileDialog` flow
- **Steam sign-in.** OpenID flow launches in the user's default browser, the Worker mints a session token, and the main process catches it via the `grimoire://auth/done` callback. The token never crosses into the renderer
- **Publish profile.** Header button on Discover (signed-in only) opens a picker of local profiles, then the existing publish dialog. After a successful publish the view jumps to *Your profile* and the new row appears without remount
- **Edit profile dialog.** Owner-only inline edit of a published profile's title/description
- **Manage uploads** on Discover with unpublish, social-aware import, and a CSRF-defended sign-in path
- **Portable profile export/import.** Share profiles via short `mp1:` codes or `.modprofile.json` files (Grimoire-only format, see `docs/profile-spec.md`). Schema 1.1 adds `vpkStem` + `alreadyInstalled` so an import dialog can highlight files the user already has
- Manual Discord release-announcement workflow

### Changed
- **Discover production URL is locked at build time.** `electron.vite.config.ts` now refuses to produce a production build without `GRIMOIRE_SOCIAL_BASE_URL` set to an `https://` URL, so installers can never ship pointing at `localhost:8787`
- **Downloads indicator** modernized: pill button with expandable panel listing in-flight downloads
- **Installed page** Fix Order button restyled as a pill so it reads as clickable

### Fixed
- **Social hardening pass** (audit follow-up): OpenID state nonce verified on the `grimoire://auth/done` callback (rejects login-CSRF), gunzip output capped at 16 KB on share-code import (gzip-bomb defense), Discover infinite scroll switched to IntersectionObserver, paginated requests bounded, and the prod URL gate above

## [1.9.3] - 2026-05

### Fixed
- **Conflict-pair count** on the Installed page now reflects the deduped set; status row moved beneath the page header
- **Conflicts detector** runs O(1) dedupe, ignores engine defaults, and emits quieter logs
- **Orphan metadata** is purged on mod delete so slots don't leak across reinstalls
- **Sibling-variant swap** keeps the newest variant active instead of falling back to the previous winner
- **GameBanana collection import** restored to the prior `createProfileFromGameBananaIds` behavior after a regression in 1.9.2

### Changed
- Settings → Support card links GitHub Issues alongside Discord

## [1.9.2] - 2026-05

### Added
- **Bulk select on the Installed page.** Multi-select rows then delete, enable, or disable in one action
- **GameBanana collection bulk import.** Paste a collection URL on Browse and queue every mod for download in one pass
- **Inline profile rename** directly on the profile card
- Settings → Support card with a Discord link

### Changed
- Header spacing tightened; control heights normalized across pages
- Radiance font metrics rebalanced so labels align with icons

### Removed
- Apt-publish job dropped from the release pipeline until a host with 100 MB+ artifact support is picked

## [1.9.1] - 2026-05

### Added
- **Managed-install detection** in the auto-updater: when Grimoire is installed via a system package manager (deb, AUR, etc.) the in-app updater routes the user to the package manager instead of trying to overwrite the binary

### Changed
- Signed apt repo published to `gh-pages` (later reverted in 1.9.2 pending a larger-artifact host)

## [1.9.0] - 2026-05

### Added
- **Configurable accent color.** Settings → Appearance picker writes a custom accent across the app; HUD-style active card preview reflects the choice live

### Fixed
- Installs and download flows hardened: progress accounting, retry behavior, and mod-card polish
- Variant and locker interactions further refined on the back of 1.8.x work
- Settings/Profiles appearance row inlined and the picker converted to a modal so the layout doesn't shift while choosing

## [1.8.1] - 2026-05

### Added
- **AUR auto-publish.** Tag releases now bump and push `grimoire-bin` to the AUR automatically (PKGBUILD + .SRCINFO)
- **Install date** shown on mod cards and variant rows

### Security
- **Renderer sandbox** enabled in the Electron BrowserWindow
- **`shell.openExternal` URL scheme allowlist** so a malicious link inside a mod description can't open arbitrary protocols

### Fixed
- Linux/Proton: `deadlock.exe` is now detected via `pgrep -f` so the "Is the game running?" status matches reality

## [1.8.0] - 2026-05

### Added
- **Collapsible sidebar** with a thematic icon set and refined hierarchy
- **Frosted-glass hero page** in the Locker with natural-aspect previews and toggle-off for the active skin
- **Multi-variant skin prompt** in the Locker so users explicitly pick a variant before applying
- **Aggregated release notes** in the updater modal (consolidates every version skipped since the user's last update)
- **Wand icon** for Launch Modded; in-app links re-route to the system browser
- **Variant pills** + Browse deep-link from the Conflicts page; default behavior is "ignore" until the user opts in

### Changed
- App-wide tinted CTA style and larger Locker thumbnails for parity with the new sidebar
- Sidebar/toolbar chrome refined; view-toggle height aligned to siblings
- Profile-card action buttons sized to fit their labels

### Fixed
- Browse: zero counts render as `0` instead of `NaNm` for likes/views/downloads
- Locker favorites persist correctly, hover-to-favorite works, and navigation hardening fixes the hero-portrait zoom regression

## [1.7.3] - 2026-05

### Added
- **1-Click lifecycle toast.** GameBanana 1-Click installs surface a real-time download/extract toast (recovering the file id and labels along the way), so the user can see progress instead of guessing

### Fixed
- Mod Details modal hides the "modified" date when it matches the "added" date instead of showing the same line twice

## [1.7.2] - 2026-05

### Added
- **Variant reorder inside the picker.** Now that variants can be co-loaded (1.7.1 multi-select), the relative load order between siblings matters — later loads win overlapping files. Picker rows now expose both ▲/▼ chevron buttons and full drag-and-drop (GripVertical handle), wired through the same `reorderMods` pipeline the Installed page already uses. Cross-section moves are blocked in both UIs so reordering can't silently flip a variant's on/off status
- **"Ignore all" bulk action** on the Conflicts page header. Visible whenever active conflicts exist; click → confirm dialog ("Ignore all 8 conflicts?") → moves every active pair to the *Ignored* section in one batch. Individual *Unignore* still restores pairs one at a time

### Fixed
- **Sidebar conflict-badge no longer goes stale** after Ignore / Unignore. The badge useEffect only re-ran when the mods list changed, which doesn't happen for ignore-conflict (it just persists settings). Page now dispatches a `grimoire:conflicts-changed` window event so the Sidebar re-fetches the count immediately instead of waiting for an app restart

### Changed
- Dropped the redundant *Active* text badge on variant picker rows — the accent-colored outline plus the filled checkbox already convey the same state
- The group-card drag tooltip now matches the actual behavior; group cards have been draggable as a contiguous block since the 1.7 variant-grouping feature, but a stale comment had claimed otherwise

## [1.7.1] - 2026-05

### Fixed
- **Installed-page variant grouping** no longer forces mutual exclusion. Mods that ship multiple complementary VPKs in one archive (e.g. Dallas PAYDAY's model + voice lines, QoL Lock + optional addons) can now have any combination of variants enabled simultaneously. The picker switched from radio buttons to checkboxes and stays open between toggles so users can flip several without re-opening it; the card-level toggle flips the whole mod on or off as a unit
- **Multi-VPK install picker** now defaults to *all* VPKs checked instead of just the first. Previously this silently dropped complementary content (e.g. installing only the model and forgetting the voice-lines VPK)

## [1.7.0] - 2026-05

### Added
- **Steam Launch Options** field on the Autoexec page. Writes `-high -nojoy` (or whatever you set) into Steam's `localconfig.vdf` for Deadlock right before the launch URL fires. Surgical byte-level edits with a `.grimoire.bak` backup and atomic temp+rename; fails closed if the file structure doesn't match what we expect. Read-only status row shows the on-disk value and warns when Steam is currently running
- **Multi-VPK picker.** Archives containing multiple `.vpk` files (Warden Remodel, etc.) now surface a checkbox modal listing every extracted file instead of silently keeping the first and unlinking the rest. Applies to both regular installs and the 1-Click flow
- **Human-readable VPK labels** in the multi-VPK picker. Hero asset paths, materials/skybox folders, panorama theme folders, and map folders are detected and labeled (e.g. *"Abrams"*, *"Galaxy skybox"*); raw filename is shown muted underneath when nothing distinctive matches
- **Multi-version picker.** Quick-download on a mod card with more than one downloadable file now opens the mod-details modal so the user picks the file explicitly. Single-file mods still quick-install in one click
- **Variant grouping on the Installed page.** Multi-variant downloads of the same GameBanana mod collapse into a single card. Click the card to open a picker that lets the user switch the active variant (mutual exclusion), rename variants inline, delete individual variants, or disable the whole group. Drag-reorder moves a group as a block
- **"Active variant" tag** on grouped Installed cards — Layers-iconed pill anchored to the bottom-left of the thumbnail shows which preset is live
- **"Enable now" affordance** when a freshly-downloaded mod lands disabled — appears on the sidebar download-complete toast *and* as a yellow Enable pill in the Browse mod-details file row, so users don't have to bounce to Installed to flip it on
- **Ignore conflicts.** Conflicts page gains a per-card Ignore action and an "Ignored (N)" panel at the bottom with Unignore. Pairs persist in app settings and are stripped by the backend detector
- **Sibling-variant auto-disable toast** with a *View* action — previously silent on re-download, easy to mistake for data loss. Gated behind a new `autoDisableSiblingVariants` setting (default on)
- **"Update all" button** on the Installed page header — visible when one or more mods carry the Update badge. Re-downloads each flagged mod serially through the existing download queue and restores each one's pre-update enabled state (downloads always land disabled by default). Per-item failures are caught so one bad mod doesn't halt the rest

### Changed
- **Mod Details modal redesign.** Single-row header (status + category + title + date/download metadata + close), responsive two-column body at lg+ with independently scrollable image and content columns, vertical preview stack so users scroll naturally through every screenshot, click-to-zoom lightbox using GameBanana's full-resolution asset, and visually separated Files / Comments sections. Modal grows to `max-w-6xl` on wide screens so it stops leaving dark gutters on 1080p+ displays
- Mod Details now shows **all installed siblings** of the same GameBanana mod with an explicit *Active* badge on the enabled row, matching the Browse view
- **GameBanana per-file headers** (`_sDescription`) now feed variant labels by default: rows read *"Gold w/ alt candle"* instead of `pak04_dir.vpk`. User renames still win. New installs only — no backfill
- Letterboxed preview thumbs in the mod-details modal use a **blurred backdrop** instead of harsh black bars
- **Autoexec page** reorganized: Launch Options card moves into the right column above "Your Commands" so the launch stack reads top-to-bottom: launch args → autoexec commands → file status
- Installed page default view is **Cards (grid)** instead of List for new users; existing localStorage preference still wins
- Sidebar download-complete toast removed in favor of the card-level Enable pill (less redundant — the user's eye is already on the card they clicked)

### Fixed
- **Browse-tab state survives navigation.** Search query, filters, view mode, sort, loaded mods, page state, and scroll position all persist when switching tabs and returning. Scroll restore had a latent bug — cleanup ran after React detached the ref, so saved `scrollTop` was always 0
- **Search input debounced** (250ms). Stops blanking results into a skeleton grid on every keystroke; inline spinner shows in the input while debouncing or refetching
- **FTS5 fallback to substring LIKE** when prefix search returns zero rows, so creative mod names and typos still surface something
- Quick-download no longer silently picks a variant on multi-file mods

## [1.6.2] - 2026-05

### Changed
- Installed-tab UX polish: faster variant swap, drag/view improvements

### Fixed
- Update modal release-notes styling
- Crosshair preview now clears when the active preset is deselected

## [1.6.1] - 2026-04

### Added
- Windows portable build (`Grimoire-Portable-x.y.z.exe`) published alongside the NSIS installer for users who prefer not to install

### Fixed
- Browse: 18+ / Installed / Outdated overlay tags on mod cards no longer paint over the sticky search bar when scrolling

## [1.6.0] - 2026-04

### Added
- **GameBanana 1-Click installer integration.** Click the Grimoire button on any compatible Deadlock mod page and the archive downloads, extracts, and registers automatically. Implements the full [GameBanana 1-Click spec](https://gamebanana.com/wikis/1999):
  - Registers the `grimoire:` URL scheme via the Windows installer (NSIS), with a runtime fallback for portable launches
  - Supports both URL formats — `grimoire:[archive_url]` and the extended `grimoire:[archive_url],[mod_type],[mod_id]` (the latter enriches the install with mod name, thumbnail, category, and NSFW flag from the GameBanana API)
  - Accepts ZIP, RAR, and 7z archives. Decompression binaries ship with the app
  - Magic-byte format detection so misnamed extensions on `/dl/<id>` redirect URLs still route correctly
  - Pre-extraction scan flags executable / script files (`.exe`, `.dll`, `.bat`, `.ps1`, `.vbs`, `.msi`, `.scr`, `.jar`, etc.) and surfaces a confirmation modal listing them
  - Honors the `.disable_gb1click` and `.disable_gb1click_grimoire` opt-out files anywhere in the archive
  - Trusted-domain validator rejects any non-`gamebanana.com` URL before a connection is opened
- Top-of-window toast on 1-click installs: *"Installing &lt;Mod Name&gt; from GameBanana…"*

### Changed
- Defense-in-depth: the extract pipeline writes only `.vpk` files into the addons folder, so 1-click archives can never deliver a binary to disk even if a user accepts the suspicious-files prompt
- Installed list now refreshes live the moment any download completes — no more navigate-away-and-back to see new mods

## [1.5.5] - 2026-04

### Fixed
- Browse: hero filter now applies on the Sound tab
- Browse: audio play button on searched mods
- Larger default window size

## [1.5.0] - 2026-04

### Added
- Drag-and-drop file import on the Installed page
- Filters popover and section icon toggles in Browse
- Shimmer placeholder while hero gallery images load
- Skeleton loaders in the Locker
- Redesigned mod overlay
- Confirm dialogs before destructive operations (clear autoexec, disable conflict, etc.)

### Changed
- WCAG contrast and focus-visibility pass across the app
- Routed pages now use a usable full-height parent layout
- Settings, Profiles, Autoexec, and Conflicts pages share a unified PageHeader

### Fixed
- Three pre-existing TypeScript errors and remaining unused-decl warnings
- Browse mod-card overlay buttons get a darker contrast ring

## [1.4.0] - 2026

### Added
- Available-update flag on installed mods
- Open mod-details overlay from a card's image or info action
- Carousel spinner and fade while the next mod-detail image loads

### Changed
- Tag primitive: tighter padding, softer styling, no more wrapping `pak##` filenames
- Sound cards in Installed now reuse the locker hero render
- Load priority pill moved onto the grid card thumbnail
- Empty states in Installed, Browse, Profiles, and Conflicts route through a shared `EmptyState` primitive

### Fixed
- 10-second conflict poll no longer triggers a Windows system sound
- Browse list now clears when switching section or filters
- Update/reinstall replaces the old VPK instead of leaving stragglers
- Disabled mods raised above AA contrast in Installed

## [1.3.0] - 2026

### Added
- Launch Modded / Launch Vanilla buttons with a crash-safe vanilla stash
- Drag-and-drop reorder and custom VPK import on Installed
- Centered Download More modal with search and outdated filter
- Open Mods Folder button on Installed
- Hide-outdated-mods setting

### Fixed
- Multi-mod rename now batches metadata migration so thumbnails are preserved

## [1.2.0] - 2026

### Added
- GameBanana comments inside the mod-details modal
- Outdated-mod warnings based on the last update date
- Overlay mod cards and sticky Browse header

### Fixed
- Use the correct GameBanana API field name for mod update dates
- Remove Ozone platform switches that caused a white screen on Linux

### Removed
- Dead "auto-configure" toggle

## [1.1.0] - 2026

### Added
- Launch banner for `gameinfo.gi` status
- Locker renders and nameplates for newly added heroes

### Fixed
- Removed Mina-specific messaging from the cleanup-addons feature

## [1.0.10] - 2026

### Added
- Enhanced hero search and download-queue UI
- Auto-sync on first launch
- Update indicator in sidebar and first-run welcome modal

### Fixed
- VPK conflict detection ignores metadata files and validates the directory tree
- Various release-workflow fixes

## [1.0.0] - 2026

Initial public release. Repo rebranded from `modmanager` to `grimoire`.

[1.7.0]: https://github.com/Slush97/grimoire/releases/tag/v1.7.0
[1.6.2]: https://github.com/Slush97/grimoire/releases/tag/v1.6.2
[1.6.1]: https://github.com/Slush97/grimoire/releases/tag/v1.6.1
[1.6.0]: https://github.com/Slush97/grimoire/releases/tag/v1.6.0
[1.5.5]: https://github.com/Slush97/grimoire/releases/tag/v1.5.5
[1.5.0]: https://github.com/Slush97/grimoire/releases/tag/v1.5.0
[1.4.0]: https://github.com/Slush97/grimoire/releases/tag/v1.4.0
[1.3.0]: https://github.com/Slush97/grimoire/releases/tag/v1.3.0
[1.2.0]: https://github.com/Slush97/grimoire/releases/tag/v1.2.0
[1.1.0]: https://github.com/Slush97/grimoire/releases/tag/v1.1.0
[1.0.10]: https://github.com/Slush97/grimoire/releases/tag/v1.0.10
[1.0.0]: https://github.com/Slush97/grimoire/releases/tag/v1.0.0
