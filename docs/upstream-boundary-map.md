# Upstream boundary map

Which files this fork owns outright and which it shares with
`Slush97/grimoire`, so a change can be aimed at the cheap side of the line
before it is written rather than discovered at the next merge.

Generated 2026-07-30 against `upstream/main` at `f401f87 2026-07-29 fix(performance): hold the unit-status readability convars back as opt-ins (#326)`.
Fork `HEAD` at `826f66a 2026-07-30`; merge base `1612680df76f`.

Regenerate with:

```bash
git fetch upstream && git diff --diff-filter=A --name-only upstream/main...HEAD -- src electron
```

## How to read it

- **Fork-only** files do not exist upstream. Changing them costs nothing at
  merge time. Prefer putting fork behaviour here.
- **Shared and modified** files exist in both trees and have already diverged.
  Every further edit is paid for again at each absorption, so a change here
  should be small, or should move the logic into a fork-only module.
- Churn is `insertions + deletions` versus upstream, not a quality signal: a
  high number means the two versions are far apart, which is exactly what
  makes the next merge expensive.

Totals: **169 fork-only**, **97 shared-and-modified**, **0 deleted-from-upstream** under `src/` and `electron/`.

## What this pass touched (2026-07-30, Pass A)

Recorded per the plan's rule that each pass names the upstream files it moved.

**Fork-only (free at merge time):** `assetSearch.ts`, `heroPortraitIdentity.ts`,
`CatalogDiagnostics.tsx` (new), `SoundEntryRow.tsx`, `soundInventory.ts`,
`foundryPortraitImages.ts`, `PortraitBrowse.tsx`, `PortraitEditor.tsx`,
`FoundryBuildTray.tsx`.

**Shared and modified (paid for again at the next absorption):**
`LibraryBrowse.tsx` (new hero-scope props), `HeroWorkshop.tsx` (passes the hero
down, two lines), `pages/Locker.tsx` (default category), `foundryCatalog.ts` (two
new exported functions), `ipc/foundry.ts`, `preload/index.ts`, `lib/api.ts`,
`types/electron.ts` (the four append-only plumbing files this repo's work order
already names as the shared-surface tax).

The classification logic that could have gone into `LibraryBrowse` deliberately
went into the fork-only `assetSearch.ts` instead, so the shared component keeps
only the props and the dropdown. That is the shape to repeat.

## Notes worth acting on

- `src/pages/Settings.tsx` shows +106 / -1840: upstream has grown a large
  Settings surface this fork has not taken. Absorbing it will be a project of
  its own, not a merge.
- `performanceConfigData.ts` (+2742) and `performanceConfig.ts` (+475) are the
  single largest divergence and are almost pure data. If any of it is
  upstreamable, sending it back is worth more than carrying it.
- `translation.json` (+1044) diverges on every pass that adds copy and cannot be
  avoided; it just has to be merged carefully, since a bad merge here is
  invisible until a string renders (see the cp1252 gate).

## The expensive shared files (top 25 by churn)

| File | +/- vs upstream |
| --- | --- |
| `electron/main/services/performanceConfigData.ts` | +2742 / -281 |
| `src/pages/Settings.tsx` | +106 / -1840 |
| `src/locales/en/translation.json` | +1044 / -32 |
| `src/pages/Locker.tsx` | +692 / -177 |
| `src/components/foundry/SoundBrowse.tsx` | +550 / -141 |
| `electron/main/services/performanceConfig.ts` | +475 / -86 |
| `electron/main/ipc/mods.ts` | +495 / -32 |
| `src/components/performance/PerformanceConfigCard.tsx` | +506 / -3 |
| `src/components/foundry/HeroWorkshop.tsx` | +299 / -130 |
| `src/pages/LockerHero.tsx` | +157 / -269 |
| `src/pages/Installed.tsx` | +196 / -184 |
| `electron/main/services/foundryCatalog.ts` | +316 / -32 |
| `electron/main/services/modDatabase.ts` | +291 / -1 |
| `src/pages/Browse.tsx` | +226 / -39 |
| `src/types/electron.ts` | +252 / -5 |
| `src/lib/api.ts` | +247 / -8 |
| `src/components/locker/HeroSoundPicker.tsx` | +225 / -22 |
| `electron/main/services/extract.ts` | +229 / -15 |
| `electron/main/ipc/foundry.ts` | +229 / -1 |
| `src/components/locker/HeroCardPicker.tsx` | +179 / -48 |
| `src/pages/Foundry.tsx` | +190 / -28 |
| `src/components/foundry/LibraryBrowse.tsx` | +187 / -28 |
| `src/types/foundry.ts` | +207 / -0 |
| `src/types/mod.ts` | +196 / -6 |
| `electron/main/services/vpk.ts` | +201 / -0 |

## Shared and modified, in full

- `electron/main/index.ts`
- `electron/main/ipc/abilityColors.ts`
- `electron/main/ipc/abilitySounds.ts`
- `electron/main/ipc/foundry.ts`
- `electron/main/ipc/gamebanana.ts`
- `electron/main/ipc/modDatabase.ts`
- `electron/main/ipc/mods.ts`
- `electron/main/ipc/performanceConfig.ts`
- `electron/main/ipc/settings.ts`
- `electron/main/services/dmmMigration.guards.test.ts`
- `electron/main/services/dmmMigration.nondestructive.test.ts`
- `electron/main/services/dmmMigration.ts`
- `electron/main/services/download.ts`
- `electron/main/services/extract.test.ts`
- `electron/main/services/extract.ts`
- `electron/main/services/foundryCatalog.ts`
- `electron/main/services/foundryExport.ts`
- `electron/main/services/heroColors.ts`
- `electron/main/services/heroPortraits.ts`
- `electron/main/services/heroPoseModels.ts`
- `electron/main/services/heroSounds.ts`
- `electron/main/services/metadata.ts`
- `electron/main/services/modDatabase.ts`
- `electron/main/services/modMerger.addSources.test.ts`
- `electron/main/services/modMerger.ts`
- `electron/main/services/performanceConfig.ts`
- `electron/main/services/performanceConfigData.ts`
- `electron/main/services/searchService.ts`
- `electron/main/services/settings.ts`
- `electron/main/services/social.ts`
- `electron/main/services/updater.ts`
- `electron/main/services/vpk.ts`
- `electron/preload/index.ts`
- `src/App.tsx`
- `src/components/AppUpdateBanner.tsx`
- `src/components/Layout.tsx`
- `src/components/MergeModsModal.tsx`
- `src/components/MergedContentsModal.tsx`
- `src/components/ModDetailsModal.tsx`
- `src/components/Sidebar.tsx`
- `src/components/UpdateModal.tsx`
- `src/components/common/AnchoredPopover.tsx`
- `src/components/common/HeroSelect.test.tsx`
- `src/components/common/HeroSelect.tsx`
- `src/components/common/Modal.tsx`
- `src/components/common/ui.tsx`
- `src/components/conflicts/ConflictFileList.tsx`
- `src/components/foundry/FoundryHeroGrid.tsx`
- `src/components/foundry/HeroWorkshop.tsx`
- `src/components/foundry/LibraryBrowse.tsx`
- `src/components/foundry/SoundBrowse.tsx`
- `src/components/foundry/SoundImportEditor.tsx`
- `src/components/foundry/TextureBrowse.tsx`
- `src/components/foundry/TextureCard.tsx`
- `src/components/foundry/TextureGrid.tsx`
- `src/components/foundry/TextureLightbox.tsx`
- `src/components/locker/CardCropper.tsx`
- `src/components/locker/HeroCardPicker.tsx`
- `src/components/locker/HeroColorPicker.tsx`
- `src/components/locker/HeroPoseViewer.test.ts`
- `src/components/locker/HeroPoseViewer.tsx`
- `src/components/locker/HeroSkinsPanel.tsx`
- `src/components/locker/HeroSoundPicker.tsx`
- `src/components/locker/LockerImageCropper.tsx`
- `src/components/locker/LockerModImagePicker.tsx`
- `src/components/locker/SoulContainerImportModal.tsx`
- `src/components/locker/SpiritUrnImportModal.tsx`
- `src/components/locker/heroPoseRenderFeatures.ts`
- `src/components/performance/PerformanceConfigCard.tsx`
- `src/components/settings/AppearanceArtSection.tsx`
- `src/components/social/MyPublishedSection.tsx`
- `src/components/social/SocialProfileHeader.tsx`
- `src/components/stats/PlayerSelect.tsx`
- `src/index.css`
- `src/lib/api.ts`
- `src/lib/lockerRandomizer.test.ts`
- `src/lib/lockerRandomizer.ts`
- `src/lib/lockerUtils.ts`
- `src/locales/en/translation.json`
- `src/locales/manifest.json`
- `src/pages/Autoexec.tsx`
- `src/pages/Browse.tsx`
- `src/pages/Conflicts.tsx`
- `src/pages/Crosshair.tsx`
- `src/pages/Discover.tsx`
- `src/pages/Foundry.tsx`
- `src/pages/Installed.tsx`
- `src/pages/Locker.tsx`
- `src/pages/LockerHero.tsx`
- `src/pages/Servers.tsx`
- `src/pages/Settings.tsx`
- `src/stores/appStore.ts`
- `src/types/electron.ts`
- `src/types/foundry.ts`
- `src/types/mod.ts`
- `src/types/portrait.ts`
- `src/types/social.ts`

## Fork-only

- `electron/main/ipc/chatWheel.ts`
- `electron/main/services/__fixtures__/stock-gameinfo.gi`
- `electron/main/services/audioConversion.test.ts`
- `electron/main/services/audioConversion.ts`
- `electron/main/services/browserContentFilter.test.ts`
- `electron/main/services/browserContentFilter.ts`
- `electron/main/services/chatWheel.test.ts`
- `electron/main/services/chatWheel.ts`
- `electron/main/services/dmmMigration.vpkGate.test.ts`
- `electron/main/services/foundryAssetSources.test.ts`
- `electron/main/services/foundryAssetSources.ts`
- `electron/main/services/foundryForge.test.ts`
- `electron/main/services/foundryForge.ts`
- `electron/main/services/foundryPortraitImages.test.ts`
- `electron/main/services/foundryPortraitImages.ts`
- `electron/main/services/foundrySoundConflicts.test.ts`
- `electron/main/services/foundrySoundConflicts.ts`
- `electron/main/services/foundrySourceThumbs.test.ts`
- `electron/main/services/foundrySourceThumbs.ts`
- `electron/main/services/foundryTextureReplace.test.ts`
- `electron/main/services/foundryTextureReplace.ts`
- `electron/main/services/globalSoundSwapClassify.test.ts`
- `electron/main/services/heroColors.previewHeroColor.test.ts`
- `electron/main/services/heroPoseRiggedClip.test.ts`
- `electron/main/services/performanceConfig.test.ts`
- `electron/main/services/previewVpkRegistry.test.ts`
- `electron/main/services/previewVpkRegistry.ts`
- `electron/main/services/soundAnnotations.test.ts`
- `electron/main/services/soundAnnotations.ts`
- `electron/main/services/updaterCache.test.ts`
- `electron/main/services/updaterCache.ts`
- `electron/main/services/version.test.ts`
- `electron/main/services/version.ts`
- `electron/main/services/vpkImpostors.test.ts`
- `electron/main/services/vpkImpostors.ts`
- `src/assets/chatlane-icons/defend.svg`
- `src/assets/chatlane-icons/going_in.svg`
- `src/assets/chatlane-icons/group_up.svg`
- `src/assets/chatlane-icons/heal.svg`
- `src/assets/chatlane-icons/heart.svg`
- `src/assets/chatlane-icons/help.svg`
- `src/assets/chatlane-icons/question.svg`
- `src/assets/chatlane-icons/quick.svg`
- `src/assets/chatlane-icons/retreat.svg`
- `src/assets/chatlane-icons/shop.svg`
- `src/assets/chatlane-icons/thanks.svg`
- `src/components/MergeReviewPanel.tsx`
- `src/components/VpkImpostorBanner.tsx`
- `src/components/chatwheel/RadialWheelPreview.tsx`
- `src/components/common/HeroDetailFrame.tsx`
- `src/components/common/ResultSummary.tsx`
- `src/components/common/SearchInput.tsx`
- `src/components/common/confirm.tsx`
- `src/components/common/confirmContext.ts`
- `src/components/common/useDismissable.ts`
- `src/components/common/useEscapeKey.ts`
- `src/components/common/useSegmentedTabs.ts`
- `src/components/foundry/AlternativesGallery.tsx`
- `src/components/foundry/AssetSourcesPanel.tsx`
- `src/components/foundry/CatalogDiagnostics.tsx`
- `src/components/foundry/ChangePools.tsx`
- `src/components/foundry/FoundryBuildTray.tsx`
- `src/components/foundry/GlobalSoundBrowse.tsx`
- `src/components/foundry/MyChanges.tsx`
- `src/components/foundry/MySoundChanges.tsx`
- `src/components/foundry/PortraitBrowse.tsx`
- `src/components/foundry/PortraitEditor.tsx`
- `src/components/foundry/alternativePreview.test.ts`
- `src/components/foundry/alternativePreview.ts`
- `src/components/foundry/assetSearch.test.ts`
- `src/components/foundry/assetSearch.ts`
- `src/components/foundry/buildTray.test.ts`
- `src/components/foundry/buildTray.ts`
- `src/components/foundry/changeList.test.ts`
- `src/components/foundry/changeList.ts`
- `src/components/foundry/poolView.test.ts`
- `src/components/foundry/poolView.ts`
- `src/components/foundry/portraitFamily.test.ts`
- `src/components/foundry/portraitFamily.ts`
- `src/components/foundry/resolveForgeAudio.test.ts`
- `src/components/foundry/resolveForgeAudio.ts`
- `src/components/foundry/soundPoolPlan.test.ts`
- `src/components/foundry/soundPoolPlan.ts`
- `src/components/foundry/soundSeed.test.ts`
- `src/components/foundry/soundStagedEdit.test.ts`
- `src/components/foundry/soundStagedEdit.ts`
- `src/components/foundry/soundTuning.test.ts`
- `src/components/foundry/soundTuning.ts`
- `src/components/foundry/sourceGating.test.ts`
- `src/components/foundry/sourceGating.ts`
- `src/components/foundry/useClipPlayer.test.ts`
- `src/components/foundry/useClipPlayer.ts`
- `src/components/foundry/useTrayPreview.ts`
- `src/components/foundry/visualEdits.test.ts`
- `src/components/foundry/visualEdits.ts`
- `src/components/locker/GlobalSoundShelf.tsx`
- `src/components/locker/HeroSkinOverlapPanel.tsx`
- `src/components/locker/HeroSoundShelf.tsx`
- `src/components/locker/SoundEntryRow.tsx`
- `src/components/locker/cardSlotStyles.test.ts`
- `src/components/locker/cardSlotStyles.ts`
- `src/components/locker/soundPickConsequence.test.ts`
- `src/components/locker/soundPickConsequence.ts`
- `src/components/locker/useSoundAnnotations.ts`
- `src/components/performance/GameplayOptIns.tsx`
- `src/components/performance/OutOfRangeDialog.tsx`
- `src/components/performance/PresetPicker.tsx`
- `src/components/settings/AccentColorPicker.tsx`
- `src/components/settings/BackgroundGradientPicker.tsx`
- `src/components/settings/BrowserFilterControls.tsx`
- `src/components/settings/ForkBuildCard.tsx`
- `src/components/settings/SettingsNav.tsx`
- `src/components/settings/sections/AppearanceSection.tsx`
- `src/components/settings/sections/ExperimentalSection.tsx`
- `src/components/settings/sections/GameSection.tsx`
- `src/components/settings/sections/MaintenanceSection.tsx`
- `src/components/settings/sections/PreferencesSection.tsx`
- `src/components/settings/sections/PrivacySection.tsx`
- `src/components/settings/sections/SupportSection.tsx`
- `src/components/settings/sections/UpdatesSection.tsx`
- `src/components/social/MissingModsBadge.tsx`
- `src/components/social/ModsAvailableBadge.tsx`
- `src/components/social/SocialStateNotice.tsx`
- `src/components/social/availability.test.ts`
- `src/components/social/availability.ts`
- `src/components/social/socialErrors.test.ts`
- `src/components/social/socialErrors.ts`
- `src/lib/backgroundGradient.ts`
- `src/lib/browserImportHandoff.test.ts`
- `src/lib/browserImportHandoff.ts`
- `src/lib/chatWheelGeometry.test.ts`
- `src/lib/chatWheelGeometry.ts`
- `src/lib/chatWheelIcons.ts`
- `src/lib/chatWheelModel.test.ts`
- `src/lib/chatWheelModel.ts`
- `src/lib/conflictSearch.test.ts`
- `src/lib/conflictSearch.ts`
- `src/lib/foundryChanges.test.ts`
- `src/lib/foundryChanges.ts`
- `src/lib/globalSoundSections.ts`
- `src/lib/globalSoundSwapBucket.test.ts`
- `src/lib/heroFavorites.ts`
- `src/lib/heroPortraitIdentity.test.ts`
- `src/lib/heroPortraitIdentity.ts`
- `src/lib/heroRenderFallback.ts`
- `src/lib/lockerFoundryBuild.test.ts`
- `src/lib/lockerHeroTypeahead.test.ts`
- `src/lib/lockerHeroTypeahead.ts`
- `src/lib/lockerMode.test.ts`
- `src/lib/lockerMode.ts`
- `src/lib/portraitInventory.test.ts`
- `src/lib/portraitInventory.ts`
- `src/lib/soundAnnotationSearch.test.ts`
- `src/lib/soundAnnotationSearch.ts`
- `src/lib/soundDescribe.test.ts`
- `src/lib/soundDescribe.ts`
- `src/lib/soundInventory.test.ts`
- `src/lib/soundInventory.ts`
- `src/lib/soundLabels.test.ts`
- `src/lib/soundLabels.ts`
- `src/lib/uiPrefs.test.ts`
- `src/lib/uiPrefs.ts`
- `src/lib/useScrollRestore.test.ts`
- `src/lib/useScrollRestore.ts`
- `src/lib/vpkImpostorNotice.test.ts`
- `src/lib/vpkImpostorNotice.ts`
- `src/pages/Browser.tsx`
- `src/pages/ChatWheel.tsx`
- `src/pages/Saved.tsx`
