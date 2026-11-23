# Grimoire fork feature audit, November 23, 2026

This pass covers the fork’s desktop routes, the main-process workflows that
support them, and the changes proposed in the [feature follow-up](feature-followup-2026-11-23.md).
The starting point was fork `main` at `619a03ba` with the local ChatLane and
variant-picker fixes from that follow-up. The [feature inventory](feature-status.md)
holds the detailed shipped history. This table records what was inspected and
the highest-value check or improvement still open in each area.

| Feature | Source or test evidence | Remaining check or improvement |
|---|---|---|
| Installed | `VariantPickerModal.heroes.test.tsx`, `modsHeal.test.ts` and `modInterchange/interchange.test.ts` cover variant actions, inventory identity and transfer. | Verify update, import and rollback against a representative installed library. |
| Browse and Saved | `Browse.test.tsx`, `gamebanana.fileList.test.ts`, the Saved route and saved filters cover catalog navigation, source file rows and library entry points. | Show unavailable GameBanana submissions in Installed using the existing update check. Verify saved entries remain usable when a source disappears. |
| Downloads | `download.managedQueue.test.ts` and `downloadCacheManagement.test.ts` exercise resumption, review tokens and cache boundaries. The cache test now exercises a real junction on Windows. | Drive GameBanana and Browser downloads through cancellation, restart and resume in a packaged app. |
| Browser | `Browser.test.tsx`, the Browser IPC suite and `browserDownloadCapture.test.ts` exercise navigation, filtering and download handling. | Verify site exceptions persist across restart, and use a real download to confirm the sandboxed handoff reaches review. |
| Foundry sound | `SoundImportEditor.test.tsx`, `soundPoolPlan.test.ts` and `foundrySoundConflicts.test.ts` cover edit controls, pooling and overlapping writes. | Verify a batch voice mapping prototype in-game, including missing and ambiguous entries. |
| Foundry textures and portraits | `foundryTextureReplace.test.ts`, `PortraitEditor.test.tsx` and `foundryAssetExport.test.ts` cover supported swaps and asset export. | Check hero card, minimap and ability-icon output on the current game build. |
| Foundry models, particles and merge | `ModelBrowse.test.tsx`, `modelReplacement.test.ts`, `foundryForge.test.ts` and `mergeRecipes.integration.test.ts` cover selection, compiled dependencies, staging and reviewed builds. Replacement previews now load on demand and retry with a different preview after an error. | Prove newly staged VPKs mount in-game. Arbitrary model authoring and cast-particle fidelity remain open. |
| Locker | `HeroPortraitFamilies.test.tsx`, `abilityPlaybackController.test.ts` and the [verification record](ingame-verification-record.md) cover layout relationships, preview state and recorded app checks. | Test stock and applied ability auditions with real hero assets, then check narrow-window behavior. |
| DeadlockForge | `forgeBridge.test.ts`, `forgeProtocol.test.ts` and `download.forgeInstall.test.ts` cover opt-in, confirmation and disabled imports. | Perform the current browser-to-packaged-app handoff with a throwaway install. |
| Chat Wheel | `ChatWheel.test.tsx` and `chatWheelNative.test.ts` exercise editing, validation and exact VPK/YAML round trips. | Try held-modifier switching in the current game, including both key release orders and conflicts with existing bindings. |
| Config, Autoexec, Crosshair and performance presets | `Config.test.tsx`, `configWorkspace.test.ts`, `autoexec.test.ts`, `crosshairShareCode.test.ts` and `performanceConfig.test.ts` exercise reviewed writes and format contracts. | Verify a managed launch applies the reviewed settings and a cancelled edit leaves files unchanged. |
| Profiles and Recovery | `profiles.applyReview.test.ts`, `profileLoadOrder.test.ts`, `profileRecovery.test.ts`, `recovery.test.ts` and `setupTestHistory.test.ts` cover apply review, rollback, isolation and setup evidence. | Capture Locker-owned state in restoration and measure profile apply with a realistic large library. |
| Overlap, compatibility and crash advisories | The overlap route, conflict tests, `compatibilityHeal.test.ts` and `CrashAdvisories.test.tsx` cover diagnosis and repair entry points. The crash dialog now opens Recovery directly. | Bring suspected mods into an explicit isolation review, with the user choosing whether to start a trial. |
| Discover, social, Stats and Servers | `dormantService.test.ts`, `availability.test.ts`, `playerStore.test.ts` and the route and IPC wiring cover availability, local stats state and external entry points. | Check live service availability and server join behavior with the appropriate signed-in account and opt-ins. |
| Settings, packaging and updates | `settings.test.ts`, `updater.channel.test.ts`, `updaterCache.test.ts` and the engine-pin check cover core settings and release contracts. | Complete a current release matrix. Published updates still need publisher verification and a previous-app rollback contract. |

## Findings and changes

- **F1. Recovery could return a scan from the previous installation.** Pending
  scans now share a promise only when the game path matches. The IPC regression
  covers switching paths while the first scan is in flight and rescanning after
  either request completes.
- **F2. Profile reorder wrote separate recovery checkpoints for files and
  metadata.** Each rename now persists its file preimages, metadata and
  mutation marker in one checkpoint before moving anything. The two overflow
  test cases now use the same deadline as the other large profile cases.
- **F3. Windows test paths hid the actual recovery assertions.** The inventory
  test now reads the native path, and the isolation test injects a failure at
  the actual session filename. The root-link rejection and cache cleanup cases
  use directory junctions on Windows. The file-link case skips only when the
  host denies creating that link.
- **F4. Crash details stopped at the suspect mod.** The advisory now links to
  Recovery, where the user can choose a scan and review isolation. Opening
  Recovery preserves the advisory and starts no mod operation.
- **F5. A static Foundry import defeated the model preview’s lazy loading.**
  Replacement and catalog previews now both load the viewer on demand. The
  replacement preview resets its error boundary when the selected URL changes.

## Verification

The full Windows suite passed on Node 24 and pnpm 12 with two workers,
7,091 tests passed and 28 skipped across 595 files. The skipped tests include
the file-symlink case on this account. The Windows junction coverage ran.
Typecheck, the UI rules check, the native ChatLane fingerprints, the fork
engine pin, and validation of the 42-row app and engine verification record
passed. Lint reported 114 warnings and zero errors. The fork build completed
and emitted the Foundry model preview as its own chunk.

The unpacked Windows x64 build passed the packaged smoke with a fresh profile.
It verified preload IPC, SQLite and FTS5, the mod-safety worker, and the custom
asset protocols under the packaged content security policy. A second run
rendered 12 routes or expected empty states and validated ChatLane YAML
through the packaged preload and main process. Signing and publishing were
disabled for the local package. No live Deadlock install was used, so the
in-game checks in the table remain open.

## Follow-through

| Audit item | Result | Remaining check |
|---|---|---|
| Unavailable GameBanana sources | Ported the removal status into the existing file-list request. Installed now shows a badge, a filter and an explanation in mod details. Local files and enabled state are unaffected. [Upstream proposal](https://redirect.github.com/Slush97/grimoire/pull/599) | Check real GameBanana status responses in the current packaged UI. |
| Saved entries after source loss | Missing and failed cache lookups both fall back to the stored bookmark. Notes remain editable, and a failure to load the bookmark list offers a retry. The new Windows package saved a note on a bookmark with no catalog row. | Verify a live removed submission with an existing bookmark. |
| Isolation review from crash details | Recovery receives the advisory identifier and shows the suspect beside isolation. The user still starts and confirms the trial, which keeps the complete setup in scope. | Exercise the flow after a real crash with a representative mod library. |
| Foundry and Locker with local game assets | The pinned engine read 44 heroes from local Deadlock build `26875936`. It built a temporary VPK containing the exact Vindicta hero card, minimap icon, and crow ability-icon paths. The extracted Assassinate MP3 decoded successfully. | Check how the VPK mounts and displays in-game and how the applied sound plays. |
| DeadlockForge install | A packaged loopback request with a generated VPK reached the confirmation dialog. Cancel left the fixture empty. Install wrote an exact, disabled copy to the fixture. The real game directory was untouched. | Confirm the live site’s handoff in a browser, including the browser’s local-network permission. |
| Browser filter exceptions | A temporary packaged profile saved an origin exception, reloaded the filter, and reported the same exception from both settings and the filter after a restart. | Exercise a live Browser download through the sandboxed review handoff. |

Mid-match Chat Wheel switching, the broader in-game and signed-in checks,
full Locker restoration, and the release matrix remain open. The local game
installation was read for the asset checks. It was neither launched nor
modified for this pass. The packaged Forge and Browser checks reused the
unpacked Windows build from the original audit.

The final follow-through suite had 7,101 passes and 28 skips. The 199-mod
profile case passed with a 60-second deadline after exceeding the previous
30-second deadline under concurrent Windows tests. Typecheck, UI and locale
checks, the fork build, and a fresh unpacked Windows smoke passed. Lint
reported 114 warnings and zero errors.

## Live checks and release follow-through

| Item | Evidence | Open |
|---|---|---|
| Chat Wheel | Deadlock build `26875936` showed the original slot 0 value `3` in its Hideout console. Session-only aliases changed it to `2` and returned it to `3`. No binding was written. | Real held-key order, all eight slots, and ChatLane custom menus in a private match. The computer-use session stopped responding before that matrix completed. |
| Foundry | The earlier export verified exact paths. Steam left the game's active `gameinfo.gi` without the Grimoire addon search paths, and the fixture was never mounted in the running game. | Load a temporary Foundry fixture in a private session and verify the changed icon, minimap and card visually. |
| Live Forge | Edge loaded Texture Forge and selected Vindicta's Crow icon. The site reported that it could not detect the manager after a manual probe. Grimoire's temporary loopback listener answered a direct HTTP request with `ready: true`. The site uses the browser's loopback access feature. | Establish where the browser request stops, then verify the website transfer and disabled import. |
| Locker | New profile restore points include the four reserved applied VPK sets, including chunks, and their paired selection metadata. Preview binds the live state to the review token. The restore journals preimages and checks changed retained packs before placement. The test covers changed metadata, deleted chunks and a slot added after capture. | Review and exercise custom source inputs stored outside the managed VPKs. Older points and isolation sessions keep their prior scope. |
| Release | The release job now smokes the unpacked app on each runner before attestations and uploads only distributables, update metadata and checksums. Local engine-pin and version checks passed. A fresh Windows x64 build produced the 1.35.1 NSIS and portable executables, both verified unsigned. The unpacked app passed the release smoke with a fresh profile. | Run the updated hosted matrix, including Linux and macOS smoke. The previous hosted run passed Windows and Linux, then skipped publication after the macOS job was canceled before its steps began. Verify signing where credentials are configured. |
| Animation playback | Source 2 Viewer 21.1 exported two selected clips on the current Vindicta model. The fork engine exported a different Crow cast clip from an installed animation override. The [work brief](mod-animation-playback-brief.md) records the exact inputs and the comparison to implement. | Verify timeline and graph behavior visually with selected skin and animation combinations. |

The Windows suite for this pass recorded 7,102 passes and 28 skips. The
packaged smoke verified SQLite and FTS5, the mod-safety worker, the custom
asset protocols under the packaged content security policy, and zero renderer
console errors or uncaught exceptions. Neither Windows executable was installed
or published during this check.

## Deadlock Forge connection and local editing

With the browser's access available, the current Texture Forge page in Edge
detected the running Grimoire listener. Its Grimoire button changed from setup
help to asking for a replacement image on Vindicta's Crow icon. This verified
the browser probe. The live page stopped before a VPK transfer.

Grimoire's existing Integrations settings now offer a direct link to Texture
Forge and show whether an approved Forge origin has reached the listener.
The observation stays in memory while the listener is running. Returning to
the window refreshes the display. The website keeps the same protocol,
and incoming files still require confirmation and install disabled.

The focused Forge and animation suites passed 82 tests. Typecheck, the
production build, and the UI and locale checks passed. The full run recorded
7,125 passes with 15 failures in the profile recovery and load-order suites.
The two suites then passed 48 tests with one skip in a single-worker rerun
using a 45-second default timeout.

| Area | Existing pieces | Next useful test |
| --- | --- | --- |
| Local editing | Foundry reads assets from the installed game, stages sound and texture replacements, and can build a single VPK. Texture Forge also presents grouped texture selection, hideout art, rank labels, signs, and graffiti. | Try one batch replacement against several selected local textures in the existing Foundry tray, with per-target dimensions, previews, and the current winning mod where there is a conflict. Use the game's installed files as the catalog. |
| Website handoff | The browser can deliver a finished VPK. Grimoire records Forge provenance, then lets users inspect the disabled import. | Confirm a browser-generated fixture through the normal review dialog, and compare its payload with the disabled file on disk. |
| Editable handoff | A VPK gives Grimoire the output paths and compiled assets. Returning to an editable session also needs the original replacement input and edit settings. | Only if both projects want this, try a versioned recipe for one texture, with its exact game path and user-selected replacement. Use explicit import/export and local validation before expanding to batches or sound. |

Sources are [Deadlock Forge](https://deadlockforge.net/),
[the Forge wiki](https://deadlockforge.net/wiki/) and
[Foundry's local design](foundry-tab-design.md).
