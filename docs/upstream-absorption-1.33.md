# Upstream v1.33.0 intake

Source intake checked 2026-10-20, from the fork's v1.30.1 intake base
(`de1e4a51`) to upstream `01d6822c` (70 non-merge commits, v1.31.0 through
v1.33.0). This is source integration evidence, not a published release or a
game-engine acceptance record. No upstream repository objects were changed.

## Decisions

| Surface | Decision | Reason |
|---|---|---|
| Update channel and startup check | Keep fork | The fork's `updateReleaseChannel` (`stable`/`preview`) and `checkUpdatesOnStartup` (default off) own the job. Upstream's `updateChannel` (`stable`/`nightly`) and `autoCheckAppUpdates` (default on) are removed from `AppSettings`, the updater service, IPC, Sidebar and Welcome. A fresh install sends nothing until the user opts in. The welcome screen's opt-in toggle now binds to `checkUpdatesOnStartup`. |
| Updater header | Port | `x-user-staging-id` is blanked so the per-install id on disk is never sent. |
| Nightly, package and dependabot workflows | Drop | A two-hour cron on the fork would spend Actions minutes and publish nightlies nobody asked for. `release.yml` stays the fork's (pinned fork engine build, onionviolet publish); only its Node version moves to 24 to match CI. |
| rpm target and signed dnf repo | Drop | Needs secrets and hosting the fork does not have. `electron-builder.yml` is unchanged. |
| Mod identity | Keep fork | Mod ids are sidecar `modUid` values. `generateModId(metaKey)` stays as a compatibility function that returns or mints the uid, so upstream callers (interchange importer, forge install) keep working. `scanModsReadOnly` falls back to the metaKey. |
| DMM migration | Take upstream | The `dmmMigrate` IPC is replaced by manager-neutral `interchange` (`dmmMigration.ts` is a thin wrapper over `modInterchange`). The fork's VPK identity gate (magic bytes, single-VPK unwrap, per-file rejection reasons) is re-added in `modInterchange/importer.ts`. |
| Download engine | Merge | One transfer path. Upstream's queue (pause, priority, proxy, route fallback) is the base; the fork's durable cache and on-disk resume run through the same `downloadFile`. A 4xx response tries the next server but never starts another retry round. |
| Archive extraction | Merge | Fork magic-byte gate and nested-archive unwrap kept; upstream's code page decoding and duplicate-entry fallback to 7-Zip added. |
| Foundry asset save | Take upstream UI, keep fork API | The lightbox uses `SaveAssetButton` (`foundry:exportAsset`). The fork's `exportSound`/`exportTexture` IPC and types remain for formats upstream's button does not offer (raw container); the lightbox no longer calls them. |
| Conflict search | Keep fork UI | `Conflicts.tsx` keeps the fork's search with highlighting and scroll restore. `conflictSearch.ts` exports both the fork and upstream searchers; upstream's is unused. |
| Installed page | Take upstream | Update-all runs in the main process (`modUpdates`); the fork's renderer-side update runner is gone. Its replacement safety, local-variant restore and enabled-state snapshot behavior live in `modReplacement.ts`. Fork additions kept: Saved handoff, scroll restore, undo offer, chat wheel unbind review, merge recipe controls, impostor banner. |
| Compatibility review | Rename fork | Two features used `reviewModCompatibility`. Upstream's mod repair keeps the name (`reviewModCompatibility`/`repairModCompatibility`); the fork's setup health check becomes `reviewSetupCompatibility` (channel `recovery:compatibility`). |
| Locker 3D preview | Take upstream, keep fork panels | Upstream's toolbar, clip menu, GIF capture, studio scene and exporter replace the fork's effect export. Ability playback and event details, failure banners and spin persistence stay. The fork's exact-attachment particle policy is superseded (see open items). |
| Performance presets | Take upstream, keep fork staging | video.txt support, refreshed presets and the Ultra Potato preset come in; HUD/advanced ConVar staging and the standing user store are kept. |
| Privacy links | Fork | The welcome and settings privacy links point at the fork's `docs/guide/privacy.md`. |
| Toolchain | Take upstream | Electron 44, electron-vite 6 (`externalizeDeps`, `rolldownOptions`), ESLint 10, Vite plugin React 6. Fork bundle excludes (`yaml`, `@ghostery/adblocker-electron`) and the fork build marker are carried into the new config; the proxy agents are added to the exclude list. `jsdom` stays at 24 (Node 20 safe). |

## Open gates

- **Engine pin.** `scripts/fetch-vpkmerge.mjs` now pins stock v0.23.2 for dev
  and CI. Release builds still use the pinned fork engine
  `798f3a7d` (see `check-release-engine-pin.mjs`, passing). Upstream features
  that call newer vpkmerge verbs (outdated vdata check, attachment heal, video
  and model tooling) have not been run against the fork engine. Rebase the fork
  engine before the next release.
- **Nix.** `nix/grimoire.nix` carries upstream's store hash; the fork lockfile
  differs, so the hash is stale until `nix.yml` or a local nix build refreshes it.
- **Lockfile.** Regenerated with pnpm 11.1.1 (`lockfileVersion` 9.0). CI pins
  pnpm 10; run CI before trusting it. `@ghostery/adblocker-electron` resolved to
  a newer minor than before.
- **Locker effects.** Upstream's particle exporter has a hand-alias attachment
  fallback that replaces the fork's exact-attachment, no-guessing policy for the
  hero viewer. Foundry inspection still uses the fork's `particleBundle`.
- **Spin default.** The hero preview now starts paused on a fresh install,
  following upstream; a saved fork choice still wins.
- **Model pins.** Upstream's `MODEL_ENTRY_OVERRIDES` rows sit in
  `heroPoseModels.ts` as a stopgap; they belong in `heroIdentity.ts`.
- **Locker artwork gate.** `pnpm locker-art:check` fails locally because the
  sibling `../grimoire-social` checkout is one commit behind its origin (the
  commit that adds the six 2026-09-29 heroes to the shared roster). The artwork
  list already has those six. Fast-forward the sibling, then re-run the check
  (it also downloads the artwork, so it needs network).
- **Not run:** a packaged build, `electron-rebuild` for Electron 44, and any
  Source 2 behavior. Unit tests prove file bytes and logic, not the engine.

## Verification state

On the merged working tree: `pnpm typecheck` clean, `pnpm lint` 0 errors
(114 warnings), `pnpm test` 4973 passed and 12 skipped (the fork alone was 3208
before the merge), `pnpm build` succeeds with 0 unresolved main-process
imports, and the i18n, locale manifest, encoding, upstream-reference, engine-pin
and UI gates pass. Not verified: CI on pnpm 10, a packaged build, the
Electron 44 native rebuild, and the Locker artwork gate above.
