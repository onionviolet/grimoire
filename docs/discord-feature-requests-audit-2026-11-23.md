# Grimoire Discord feature requests, November 23, 2026

Reviewed messages in [#feature-requests](https://discord.com/channels/1504216474812944534/1504233550755401910) from September 2 through November 23, 2026. This is a shortlist of product suggestions from that window. Checked the fork working tree at `619a03ba`, upstream main at `6fec44a1`, both repositories' open PRs, recent merged PRs, and targeted older GitHub PR searches. Source and merge status are distinct from release availability. No app behavior was tested.

## Candidates from the original Discord review

| Ref | Request | Status and evidence |
|---|---|---|
| F5 | Clarify “Test in-game” | Installed still uses this label for the solo launch action. “Launch with only this mod” would state the effect. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1574532797517926532) |
| F6 | Profile notes | The request is for private notes attached to local profiles, so short names can stay in the dropdown. Discover's publish description is a separate field. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1573109391480197201) |
| F8 | Toggle installed mods while a download runs | A user reported waiting for a download before toggling other mods. No matching PR surfaced. Reproduction on the current download queue is pending. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1571195318480011399) |
| F9 | Merge localization edits from multiple mods | Requested in September and November. The second requester shared a standalone prototype that compares game and mod text, offers a choice on conflicts, and exports a VPK. No matching Grimoire integration surfaced. [September](https://discord.com/channels/1504216474812944534/1504233550755401910/1548181470890303498) · [November](https://discord.com/channels/1504216474812944534/1504233550755401910/1571083290675249165) · [Prototype post](https://discord.com/channels/1504216474812944534/1504233550755401910/1571108229407055973) |
| F10 | Name local variants in Overlap | The current Overlap page derives variant labels from siblings with the same GameBanana ID. Groups made entirely from local files still lack equivalent labels on the overlap cards. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1568040603172737175) |
| F11 | Preserve archive folders in the VPK picker | The request is to show which archive folder each VPK came from. Newer local variant grouping is adjacent work. I found no PR specifically covering folder-grouped choices in a downloaded archive. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1564898883979710486) · [Related PR](https://redirect.github.com/Slush97/grimoire/pull/593) |
| F12 | Rebase stale hero or ability data | Grimoire detects outdated VData. I found no matching feature or PR that carries a mod's edits forward onto the current game version. [October](https://discord.com/channels/1504216474812944534/1504233550755401910/1561132216288022729) · [November](https://discord.com/channels/1504216474812944534/1504233550755401910/1566494267264991325) · [Detection PR](https://redirect.github.com/Slush97/grimoire/pull/419) |
| F13 | Tune sound from mods that also replace textures or models | Locker already has volume and pitch controls for eligible sound sources. I found no matching PR for exposing those controls on mixed-asset packs. The reported example was not tested. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1569682437074849905) |
| F14 | Compress loose VPK storage | The proposal is optional compression for local library storage, with decompression for use. No matching implementation or PR surfaced. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1567687081516601365) |
| F15 | Indicate whether Deadlock is running in the taskbar | Grimoire already distinguishes the game process from CSDK on Windows. I found no toggleable taskbar indicator or matching PR. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1570244129370406964) · [Process detection PR](https://redirect.github.com/Slush97/grimoire/pull/508) |
| F16 | Edit the paintings in the Hideout | The viewer can show the Hideout as a scene. No painting replacement action or matching PR surfaced. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1569571989361000491) · [Viewer PR](https://redirect.github.com/Slush97/grimoire/pull/543) |
| F17 | Direct CompLock support or automatic updates | The draft GitHub preset PR tests an unofficial CompLock mirror as an example. It does not claim direct CompLock integration or automatic updates. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1573000944936026285) · [Related draft](https://redirect.github.com/Slush97/grimoire/pull/572) |
| F18 | Show live match details in Discord activity | Grimoire's opt-in Rich Presence reports app screens and the hero being customized. I found no match, party or current in-game hero reporting. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1562044068169777213) |

## Requests with an implementation or PR

| Request | Verified state |
|---|---|
| Locker cards too large, jump when enabling a skin, shortcut to mod details | F7 has an open PR covering responsive sizing, the scroll jump and a mod-page shortcut. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1573863939585081465) · [Open PR](https://redirect.github.com/Slush97/grimoire/pull/598) |
| Drag to reorder profiles | Open PR. The request goes back to October 17. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1561059466626080799) · [Open PR](https://redirect.github.com/Slush97/grimoire/pull/600) |
| Badge installed mods removed from GameBanana | Open upstream PR. Fork working tree also contains an uncommitted implementation. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1574178483251322983) · [Open PR](https://redirect.github.com/Slush97/grimoire/pull/599) |
| Use the download enable setting for manually imported mods | Merged for imports with Mod safety review enabled. With review off, manual imports still enable regardless of the download toggle. The request to import disabled in that configuration remains broader than the merged change. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1570701625079763048) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/591) |
| Allow revoking a Mod safety approval | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1573093201303183491) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/592) |
| Favorite skins from Locker and put favorites first | The refresh merged shared favorites, and the fork's Locker source sorts favorites first. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1572508130682736742) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/593) |
| Update source mods without unmerging | Merged. The Installed action opens the existing in-place update dialog. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1562941362431721584) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/510) |
| Pin or manually rotate the Installed preview | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1568060211913166920) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/564) |
| Add previews and notes to hidden mods and creators | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1569783901310820374) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/580) |
| Save custom accent and glow swatches | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1569791894219657386) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/581) |
| Sort installed mods by size | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1565544100650946612) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/544) |
| Update enabled mods only | Implemented in the fork's Installed update dialog, including tests for target selection. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1567259303931416597) · [Source](../src/components/installed/ModUpdatesModal.tsx) |
| Edit an already-published Discover profile | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1563800066429427765) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/524) |
| See the shuffle pool and save it with a profile | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1562253468985589823) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/507) |
| Search the Conflicts tab | Implemented in the fork's Overlap page. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1557020405812699219) · [Source](../src/pages/Overlap.tsx) |
| Reorder Locker Global mods | Originally merged. The later Locker refresh removed the dedicated Global priority-placement tab and its controls upstream. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1564386536437317764) · [Original PR](https://redirect.github.com/Slush97/grimoire/pull/534) · [Later refresh](https://redirect.github.com/Slush97/grimoire/pull/593) |
| Reorder Installed lists | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1564414804846841927) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/526) |
| Show Mods, Sounds and WIPs in one Browse feed | Merged. [Discord](https://discord.com/channels/1504216474812944534/1504233550755401910/1561913783277068349) · [Merged PR](https://redirect.github.com/Slush97/grimoire/pull/495) |

F5 is the smallest candidate. F10 has a narrower verified gap than the other new feature requests. F9 has two independent requests and a prototype to evaluate.

## Implementation follow-through

| Ref | Current state |
|---|---|
| F5 | Installed calls the existing action “Launch with only this mod.” The target selection and restore behavior are the existing ones. |
| F6 | Local profile notes can be added, edited, and cleared from Profiles. Installed shows a short preview below the profile name. Notes stay in the local profile record and are omitted from the portable and Discover formats. |
| F8 | The existing mutation queue allows changes during a network transfer. A regression holds a real HTTP transfer open and checks that two mod mutations finish in order before release. No runtime fix was needed. |
| F9 | Overlap offers a localization review and standalone VPK export for a pair. Users explicitly choose the source or current game text for each differing token. Export rechecks source and baseline content, writes a new file, and leaves source mods in place. It handles supported quoted KeyValues text, including both current stock English files named in the requests. Users can import the result and give it higher load priority. |
| F10 | Overlap uses Installed's group identity for local and downloaded variants, labels members, and searches displayed variant names. |
| F11 | The download and one-click VPK picker groups files by their full original folder, including nested folders. Existing install and variant identity keys are preserved. |
| F12 | Open. The existing compatibility repair can restore missing VData fields. The pinned engine at `c34fadf` can encode verified KV3 resources, but a faithful full rebase also needs the exact stock VData from the mod's authoring build. Current Grimoire metadata provides no matching baseline. Native detection and encode fixtures passed, along with the Grimoire compatibility suite. |
| F13 | Locker includes mixed-asset packs in the ability sound picker when their VPK has a recognized hero ability slot. Added Rat King's slots from the installed build and verified that both sound clips in the reported mixed pack map to his ultimate. Older cached classifications refresh on scan. The existing scoped override and volume/pitch controls apply. In-game playback remains unverified. [Reported pack](https://gamebanana.com/mods/737329) |
| F14 | Windows Preferences can compress or expand currently disabled VPKs, including chunk siblings, with NTFS file compression. Paths and logical bytes are preserved. The operation is manual, and compression can persist when a file is enabled. The native test uses temporary files. |
| F15 | Windows Preferences adds an off-by-default running-game taskbar badge. It uses the existing game status probe. Lifecycle tests pass. A native visual check is still open. |
| F16 | Foundry's Hideout paintings category exposes three verified color textures. Multi-painting textures are atlases. The map, material, and color-texture references were verified in build `26875936`. Temporary native bakes succeeded for all three, and no game files were changed. |
| F17 | Open. The official updater source embeds its current manifest in the pack builder page. A sample download matched compressed and expanded sizes, CRC32 and its SHA-256 URL prefix. Grimoire needs a recorded CompLock component identity for updates and a reviewed Config path for companion settings the current writer rejects. [Official guide](https://deadlockconfig.com/docs/guide/) · [Updater source](https://github.com/jcStani/CompLock-Updater/tree/786435426d911966aae062bf1ba1b89ea11bf3df) |
| F18 | Open. Current game binaries contain candidate log messages, but the installed game has no console log to confirm real match transitions or local hero ownership. [Live presence evidence](discord-live-presence-evidence.md) |

## Verification

Typecheck, ESLint's error gate, UI conventions, and localization checks passed.
The final focused Node 24 run had 139 passes and one skip. The complete Node 24
run with a 20-second test deadline had 7,148 passes, 32 skips and one failure in
`BrowserBlockerControl.test.tsx`, which has concurrent workspace edits. Its
isolated rerun passed all four tests. The recovery suite passed in isolation with
the same longer deadline after timing out at the original five-second deadline.

Two current stock localization files parsed successfully. The native painting
and Windows compression checks used temporary VPKs. Packaged and in-game
acceptance remain open.
