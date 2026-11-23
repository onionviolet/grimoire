# Upstream v1.35 intake

Source intake checked 2026-11-22. Merges upstream `6fec44a1` (159 commits past
the v1.30.1 base, through v1.35.1 and the 2026-11-21 nightly) into the fork's
`codex/absorb-upstream-1.33` line. That branch already carried the v1.33
intake (`docs/upstream-absorption-1.33.md`) and the 2026-10-17 transfer
snapshot's work: all 49 files the snapshot added exist there, 46 byte-identical.
This is source integration evidence, not a release or an engine acceptance
record.

## Decisions

| Surface | Decision | Reason |
|---|---|---|
| `@grimoire/social-types` | Take upstream | Upstream now pins a release tarball, so the sibling `../grimoire-social` checkout is no longer needed. `check-sibling-repos.mjs`, the `preinstall` hook and the sibling CI/release checkout steps are removed. |
| Workflows | Keep fork | `nightly.yml` and `package.yml` stay deleted. `release.yml` keeps the fork matrix and pinned engine. `ci.yml` takes upstream's layout and keeps the fork gates (version, encoding, engine pin, upstream backlink guard with full history). |
| Conflicts page | Take upstream Overlap | Upstream renamed and redesigned it with its own search. Ported: scroll restore, "Open in Installed", busy blocker line. `/conflicts` redirects to `/overlap`. |
| Update channel | Keep fork | `updateReleaseChannel` and `checkUpdatesOnStartup` stay. Upstream's nightly channel and auto-check toggle are not wired; the settings search entries point at the fork controls. |
| Theme | Take upstream | `theme` replaces the OLED flag as the first-paint argument. The dev-slot argument and `webviewTag` are kept. |
| Performance config | Merge | Sidecar keeps both fork `userConvars` and upstream `pinnedConvars`. Apply order: preset, per-preset overrides, pins, user convars. A pin on a key owned by a HUD/Advanced control is refused. The fork's atomic `writeConfigText` is used for every write. |
| Installed and Browse | Take upstream, keep fork | Upstream rewrites are the base. Re-added: bulk undo, chat wheel unbind review, merge recipe arguments, `?focusMod=`, model compatibility check, Saved mods, browser `?item=` handoff. |
| Locker | Keep fork | Upstream #593 removed the Global controls and custom categories the fork still ships. The fork page is kept with upstream's shuffle exclusions and toggles ported. The Global priority folder chain (`setModPriorityFolder`) is restored end to end. |
| Foundry | Fork base, upstream additions | Skin and Mechanics links, hero navigation, remembered state and the Mechanics section are added on the fork workshop. |
| Profiles apply | Merge | Upstream pre-apply snapshot, then the fork's reviewed apply with mappings, then upstream's Locker rebuild and shuffle restore. |
| Local import | Merge | Upstream's prepared import flow now rejects an archive when the fork VPK identity gate rejected any member. |
| Global sound bucket | Take upstream | Hero-less sound mods, including Foundry global swaps, file under the General `sounds` bucket. The announcer misclassification stays pinned by test. |
| i18n | Union | Both catalogs merged by key with no value conflicts. 66 keys upstream deleted that nothing references were pruned. |

## Open gates

- **Lockfile.** Regenerated with pnpm 10.22.0 while `devEngines` asks for pnpm
  12 (`onFail: ignore`). Run CI before trusting it.
- **Test suite on Windows.** The full parallel run fails 20 tests in 7 files.
  Every failure also occurs on the pre-merge branch, or passes when its file
  runs alone: symlink EPERM, and timeouts under load in `profileRecovery`,
  `profileLoadOrder`, `configWorkspace` and `downloadTransfer`.
- **Local mod identity.** Upstream's `toggleMod` resolves by `modRestoreKey`
  (`name:size` for local mods), so two local mods with the same name and size
  can resolve to each other. Found through `useBulkUndoOffer.test.tsx`; the test
  fixture was changed, the product behavior was not.
- **Two codename tables.** `src/lib/heroCodenames.ts` (fork) and upstream's
  `electron/main/services/heroCodenames.ts` now coexist.
- **Two 3D viewers.** In Foundry, the Parts editor's viewer can open beside the
  fork model plate. Not checked in the app.
- **Not run:** the app itself, a packaged build, CI, and any Source 2 behavior.
