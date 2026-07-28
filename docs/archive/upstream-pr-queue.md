# Upstream PR queue (fork-only doc)

Triage of what this fork (`onionviolet/grimoire`) carries over `upstream/main`
(`Slush97/grimoire`), and which parts are worth sending back.

Not intended to be upstreamed itself. Keep it out of any PR branch.

## Method

A commit is a good PR candidate when every file it touches already exists
upstream and it has no dependency on a fork-only patch. Check with:

```bash
git cat-file -e upstream/main:<path> && echo upstream || echo fork-only
```

## Branch convention

Same model `scripts/sync-upstream.sh` describes: single-concern branches cut
from `upstream/main`, never from the integration branch, with an `-upstream`
suffix when a fork-local sibling of the same patch exists. Worked example:
`feat/audition-randomizer-pools-upstream` is the one commit, rebased clean off
`upstream/main`, with the fork-only Global Sounds dependency stripped out.

Upstream `CONTRIBUTING.md` asks for: fork, branch from `main`, conventional
commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ui:`, `ci:`),
test locally, open a PR. CI runs typecheck and build. AI contributions are
explicitly allowed.

Gates to run before pushing (husky pre-push + CI enforce these):

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && pnpm i18n:manifest
```

`pnpm build` additionally needs `GRIMOIRE_SOCIAL_BASE_URL` set, or it fails at
config load with an unrelated-looking error.

## Ready / in progress

| Commit | Status |
|---|---|
| `61f8874` advanced gameinfo HUD controls | Branch `feat/gameinfo-hud-controls-upstream` exists locally (`60b7154`), rewired for i18n, sliders debounced. **Not pushed. Not runtime-tested.** |

## Good candidates, not started

| Commit | Notes |
|---|---|
| `f46ed67` model compatibility load-order repair | 6 files, all upstream. Self-contained. |
| `7bf7900` locker shuffle hero cards + sounds on launch | All files upstream, ships a test. Drop the README hunk. Overlaps upstream PR #275 ("Locker: shuffle skins on launch"), so this reads as an extension of the maintainer's own feature. Rebase after the randomizer-pools PR: both touch `src/lib/lockerRandomizer.ts`. |
| `9e357f3` local ability sounds in hero workshop | 3 files, all upstream. Small. |
| `c8f9920` sound search by clip name | Split. `src/lib/soundDescribe.ts` + test + `SoundBrowse.tsx` are upstream-safe; the `GlobalSoundBrowse.tsx` hunk is fork-only and stays behind. |
| `feat/audition-randomizer-pools-upstream` | Already prepped and pushed to `origin`, never opened as a PR. |

## Do not send as-is

- **ChatLane** (`445f9b5`) commits `ChatLane.exe`, `libSkiaSharp.dll` and
  `TinyEXR.Native.dll` into `resources/`. Upstream does not take vendored
  binaries. The fix is the vpkmerge convention in `scripts/fetch-vpkmerge.mjs`:
  pin a release tag, fetch per-platform at postinstall, verify a hardcoded
  sha256, wire through `extraResources`. Reworked that way it becomes viable.
- **Saved mods** (`040e260`..`9e12f60`, 9 commits, new page + nav entry). Too
  large to drop unannounced. Ask first.
- **Everything prefixed `feat(local)`** (engine switcher, fork feature flags,
  in-app browser, updater disable, social URL bake). Fork-only by construction;
  the `c1a1903` commit message says so.

## Upstream context worth knowing

- Outside contributors do land: `oldreceipt` (#287, #264, #242) and `TinyDerp`
  (#277, #273) have merged PRs. The maintainer typically merges, then opens his
  own follow-up hardening PR (#274 after #273, #288 after #287).
- Foundry is the maintainer's own active area (#251, #252, #259, #263, #265).
  Receptive to Foundry work, but likely has his own plans there.
- **PR #263** (`feat(foundry): hero sound-swap with import editor`) was CLOSED,
  not merged, and superseded by #265 ("Foundry sound: cleanup + revived
  sound-swap + per-ability & voice swap"). Its own body said "Not yet
  click-tested in the running app". Read as: land Foundry sound work only after
  checking current plans, and never ship it untested.
- There are zero Foundry-related issues in the upstream tracker. Feature
  requests arrive via Discord and get harvested into PRs by the maintainer
  (#289 "Quick wins from Discord feature requests", #296). PR bodies credit the
  requester by Discord handle.
- PR body convention (see #289): What / Changes / Not included (deliberately) /
  Verification, with the gate output quoted.

## Open questions

- Ask in Discord whether the Foundry patches (excluding Global/world sounds)
  duplicate work already planned, given #263's fate.
- The HUD PR overlaps existing Autoexec presets: `citadel_minimap_unit_click_radius`,
  `citadel_minimap_player_width`, `citadel_minimap_local_player_width`,
  `citadel_minimap_zip_line_thickness` and `minimap_update_rate_hz` already ship
  as one-click autoexec.cfg presets in `COMMAND_PRESETS`. The new sliders write
  the same ConVars to gameinfo.gi instead. Two surfaces, two files, last-loaded
  wins. Needs an answer before the PR goes out.
