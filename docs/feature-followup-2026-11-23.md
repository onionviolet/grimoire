# Fork feature follow-up, November 23, 2026

This is the earlier November 23 intake. The later
[feature audit](./feature-audit-2026-11-23.md#follow-through) and
[Discord follow-through](./discord-feature-requests-audit-2026-11-23.md#implementation-follow-through)
record the source changes made after this review.

## What is available

The fork’s main branch at `619a03ba` contains upstream through v1.35.1 and the
fork features below. This is a source check. The latest published fork version
is [v1.28.2](https://github.com/onionviolet/grimoire/releases/tag/v1.28.2).
CI passed on `619a03ba`. In the release run for that commit, Windows and Linux
built, the macOS job was cancelled without a recorded runner or steps, and
publication was skipped. Game behavior still needs an installed-app check.
[CI run](https://github.com/onionviolet/grimoire/actions/runs/45264174037) · [Release run](https://github.com/onionviolet/grimoire/actions/runs/45265713602)

| Area | What is in the current source | Open work |
|---|---|---|
| Chat Wheel | Native ChatLane VPK conversion, a radial editor, drag and keyboard ordering, and round-trip YAML. Enable it in Settings → Experimental. | Live switching among named presets and testing on the current game build. |
| Foundry and Locker | Sound search, audition, trim and gain, texture swaps, compiled model bundle inspection and staging, a shared build tray, and experimental ability auditions. Enable Foundry and ability previews separately in Settings → Experimental. | General model authoring and matching cast effects to exact game events. |
| Config, Profiles and Recovery | Reviewed config writes, profile apply review and restore points, setup history, manual isolation trials, and redacted diagnostics. | Full Locker-owned recovery and application update rollback. |
| Browse, Saved and Browser | GameBanana browsing, saved items, download and cache recovery, and opted-in browsing with filter controls. | Surface removed GameBanana sources on installed mods while preserving the local files. |
| DeadlockForge | The separate browser workshop can send VPKs through Grimoire’s opt-in install bridge. Grimoire asks for confirmation and imports the mod disabled. | Test the handoff with a current packaged fork build. |

The earlier [implementation inventory](./feature-status.md) and [open backlog](../.planning/BACKLOG.md)
have per-feature details and verification limits. For the Forge install workflow,
see the [Grimoire install guide](https://grimoiremods.com/docs/installing-mods/).

## Upstream intake

Fetching upstream returned `6fec44a1` on `main`, already reachable from the
fork. The fork engine is already based on upstream’s latest published vpkmerge,
`v0.30.1`, with the fork’s catalog and texture-write changes. [Engine release](https://github.com/Slush97/vpkmerge/releases/tag/v0.30.1) · [Fork engine pin](./fork-maintenance.md#engine-build-policy-d-02)

The upstream single-file variant fix is applied locally with a regression
assertion. It hides **Remove from group** when only one file remains. This
pass also pins the line endings of ChatLane’s YAML reference inputs so Windows
checkouts can verify the original VPKs byte for byte.
[Upstream variant fix](https://redirect.github.com/Slush97/grimoire/pull/602)

Review these open upstream proposals against the fork once they merge.

| Candidate | Fork integration point |
|---|---|
| GameBanana removal badges | Surface the reason in Installed and mod details using the existing update check. This also helps explain why a profile cannot re-download a missing file. [Upstream proposal](https://redirect.github.com/Slush97/grimoire/pull/599) |
| Drag-to-reorder profiles | Adopt alongside the fork’s reviewed profile apply flow. Check that ordering persists and Installed uses the same list. [Upstream proposal](https://redirect.github.com/Slush97/grimoire/pull/600) |
| Responsive Locker cards | Compare narrow-window sizing and scroll fixes against the fork’s hero layout and preview controls before adopting. [Upstream proposal](https://redirect.github.com/Slush97/grimoire/pull/598) |

## Community ideas that extend existing features

1. **Switch chat wheels in a match.** Trobador’s Multi Chat Wheels CFG switches
   among four presets using held modifiers. Prototype this as named presets in
   Chat Wheel, with Config owning review and undo of the generated config.
   Test both key release orders, collisions with actual game bindings, and
   whether stock commands and ChatLane custom menus can share the mechanism.
   The live switching test on the current Deadlock build should come before
   the full editor. [GameBanana script](https://gamebanana.com/scripts/13594) · [GameBanana submission data](https://gamebanana.com/apiv11/Script/13594/ProfilePage)
2. **Make the first Foundry build easy.** DeadlockForge has direct paths for
   one sound, item image, texture or VPK merge. Give Foundry a short path from
   search to replacement preview to the existing build tray. That keeps the
   project’s write-set review and collision handling available for both single
   edits and larger builds. [DeadlockForge](https://deadlockforge.net/)
3. **Batch voice replacements.** GameBanana’s VO Batch Replacement Tool and
   Moonah’s Mod Maker suggest a focused next step for Foundry Sound. Map a
   folder of clips to one hero’s voice events, review matched, missing and
   ambiguous entries, then audition selected rows and build one VPK. The
   current single-clip editor already supplies trim and gain. [Deadlock tools](https://gamebanana.com/tools/games/20948) · [Moonah’s Mod Maker](https://gamebanana.com/tools/23422)
4. **Make isolation easier to find.** Deadlock Mod Doctor points to a concrete
   need Grimoire already covers in Recovery. Link the existing isolation trial
   from the crash advisory, carrying the original setup and suspected mods
   into the review. [Deadlock tools](https://gamebanana.com/tools/games/20948)
5. **Export clean source assets.** Deadlock Playground offers texture export
   for external editors. Make the original texture and exact game path easy to
   copy from Foundry’s existing asset view before tackling painting or rigging.
   Verify which formats the existing export supports before adding controls.
   [Deadlock Playground](https://gamebanana.com/tools/24316)

## Local verification

Typecheck, the UI rules check, and the ChatLane resource fingerprint check
passed. Lint completed with 114 warnings and zero errors. All 143 focused
tests passed across variants, load-order lock, Chat Wheel, DeadlockForge, and
the managed download queue. The full Windows run had 7,075 passes, 27 skips,
and 13 failures in cache cleanup, mod healing, profile load order, profile
recovery, and setup history. Failures included denied symlink creation,
timeouts, and recovery journal errors.
