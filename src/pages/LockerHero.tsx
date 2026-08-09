import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Star,
  Hammer,
  Music,
  Shirt,
  Images,
  Loader2,
  Sparkles,
  ImageIcon,
  PictureInPicture2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import HeroDetailFrame, { type HeroDetailSection } from '../components/common/HeroDetailFrame';
import { IconButton, SegmentedControl } from '../components/common/ui';
import { useSegmentedTabs } from '../components/common/useSegmentedTabs';
import HeroSkinsPanel, { SkinLoadOrderStrip } from '../components/locker/HeroSkinsPanel';
import HeroSkinOverlapPanel from '../components/locker/HeroSkinOverlapPanel';
import { LockerModImagePicker } from '../components/locker/LockerModImagePicker';
import HeroCardPicker from '../components/locker/HeroCardPicker';
import HeroSoundShelf from '../components/locker/HeroSoundShelf';
import HeroEffectsPanel from '../components/locker/HeroEffectsPanel';
import FloatingModelPanel from '../components/locker/FloatingModelPanel';
import { useModelPanelOpen } from '../components/locker/useModelPanelOpen';
import { useHeroStageMode, type HeroStageMode } from '../components/locker/heroStageMode';
// three.js viewer is heavy; only pull the chunk when the user flips to 3D.
const HeroPoseViewer = lazy(() => import('../components/locker/HeroPoseViewer'));
import type { HeroPoseFailureKind } from '../components/locker/HeroPoseViewer';
import { useAppStore } from '../stores/appStore';
import { useTrippyPreviewStore } from '../stores/trippyPreviewStore';
import type { Mod } from '../types/mod';
import type { HeroPoseSkinSource } from '../types/portrait';
import {
  activeLockerSkin,
  countLockerSkins,
  getLockerSkinKey,
  type HeroCategory,
} from '../lib/lockerUtils';
import { heroPlateComposition } from '../lib/heroStage';
import type { VariantChoice } from '../lib/lockerRandomizer';

interface LockerHeroViewProps {
  hero: HeroCategory;
  skinList: Mod[];
  /** Sound-section mods mapped to this hero. Optional because the gallery
   *  view in `Locker.tsx` keeps the same prop surface and may not split sounds
   *  out yet. Empty/undefined hides the Sounds section entirely. */
  soundList?: Mod[];
  skinCount: number;
  isFavorite: boolean;
  onBack: () => void;
  /** Open this hero's Foundry workshop. Optional: hosts that have no route to
   *  Foundry simply do not show the entry point. */
  onEditInFoundry?: () => void;
  onToggleFavorite: () => void;
  onSelect: (modId: string) => void | Promise<void>;
  onToggleVariant: (modId: string) => void | Promise<void>;
  /** Reorder the load order of this hero's enabled skins. `orderedModIds` is
   *  the new desired order of enabled skin VPK ids (lower index = loads first). */
  onReorderSkins?: (orderedModIds: string[]) => void | Promise<void>;
  /** Request deletion of a skin group (all its variant VPKs). The page owns the
   *  confirmation dialog and the actual delete. */
  onRequestDeleteSkin?: (modIds: string[], name: string) => void;
  hideNsfwPreviews?: boolean;
  /** Launch-shuffle pool set + toggle, threaded to the skins panel cards. */
  includedSkinKeys?: Set<string>;
  onToggleShuffleIncluded?: (skinKey: string) => void;
  shuffleVariantChoices?: ReadonlyMap<string, VariantChoice>;
  onSetShuffleVariant?: (skinKey: string, choice: VariantChoice | null) => void;
  /** Whether the master shuffle switch is armed (keeps per-skin toggles visible). */
  shuffleArmed?: boolean;
  /** Section to open on first render, for deep links like the grid's sound chip. */
  initialSection?: SectionId;
}

type SectionId = 'skins' | 'sounds' | 'cards' | 'effects';

function poseSkinSelectionKey(mod: Mod): string {
  if (typeof mod.gameBananaId === 'number') {
    return [
      'gb',
      mod.gameBananaId,
      mod.gameBananaFileId ?? mod.sourceFileName ?? mod.sha256 ?? mod.id,
    ].join(':');
  }
  if (mod.sha256) return `sha:${mod.sha256}`;
  if (mod.sourceFileName) return `source:${mod.sourceFileName.toLowerCase()}`;
  return `id:${mod.id}`;
}

export function LockerHeroView({
  hero,
  skinList,
  soundList = [],
  skinCount,
  isFavorite,
  onBack,
  onEditInFoundry,
  onToggleFavorite,
  onSelect,
  onToggleVariant,
  onReorderSkins,
  onRequestDeleteSkin,
  hideNsfwPreviews = false,
  includedSkinKeys,
  onToggleShuffleIncluded,
  shuffleVariantChoices,
  onSetShuffleVariant,
  shuffleArmed,
  initialSection,
}: LockerHeroViewProps) {
  const { t } = useTranslation();
  // Issue #208: the backdrop reflects the active skin's chosen Locker image, if
  // the user picked one (set per skin in the skins list below).
  const lockerModThumbnails = useAppStore((s) => s.lockerModThumbnails);
  const lockerModBackgrounds = useAppStore((s) => s.lockerModBackgrounds);
  const lockerBgHideHeroName = useAppStore((s) => s.lockerBgHideHeroName);
  const activeSkin = useMemo(() => activeLockerSkin(skinList), [skinList]);
  const activeSkinKey = activeSkin ? getLockerSkinKey(activeSkin) : undefined;
  // The "Locker image" (grid-thumbnail surface) the picker mirrors from.
  const thumbnailImage = activeSkinKey ? lockerModThumbnails[activeSkinKey] : undefined;
  // The full-bleed backdrop is its own per-skin image (issue #208), independent
  // of the 3:4 card image. Unset = the hero render. The card image is shown only
  // on the grid card, never here.
  const backdropImage = activeSkinKey ? lockerModBackgrounds[activeSkinKey] : undefined;
  // Hide the hero name logo when the active skin's backdrop already shows the
  // name (only meaningful when a custom backdrop is in play).
  const hideHeroName = activeSkinKey ? Boolean(lockerBgHideHeroName[activeSkinKey]) : false;
  const [pickerOpen, setPickerOpen] = useState(false);
  // Remembered across visits: see useModelPanelOpen. This is the floating
  // panel's open state, which under the stage design means "popped out".
  const [modelPanelOpen, setModelPanelOpen] = useModelPanelOpen('locker');
  // Remembered per surface under its own key (heroStage.mode), not a
  // reinterpretation of the panel-open boolean above.
  const [stageMode, setStageMode] = useHeroStageMode('locker');
  const tabs = useSegmentedTabs<HeroStageMode>();
  // A definitive pose failure (unsupported hero or failed export) forces the
  // displayed mode to Image for this mount only. Never persisted: one
  // unposable hero must not demote the standing choice for the whole roster.
  const [poseFailure, setPoseFailure] = useState<Exclude<HeroPoseFailureKind, 'skin'> | null>(
    null
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const handlePoseFailureChange = useCallback((kind: HeroPoseFailureKind | null) => {
    // `'skin'` means the base pose IS showing: that is a usable stage, not a
    // fallback trigger. Only `'unsupported'` and `'export'` leave the plate
    // with nothing.
    const definitive = kind === 'unsupported' || kind === 'export';
    setPoseFailure(definitive ? kind : null);
    // A definitive failure while popped out would otherwise leave the
    // FloatingModelPanel open with a viewer that fails again on the same key:
    // close the pop-out so the Image fallback is the only surface on screen.
    if (definitive) setModelPanelOpen(false);
  }, [setModelPanelOpen]);
  const displayedMode: HeroStageMode = poseFailure ? 'image' : stageMode;
  const retryModel = useCallback(() => {
    setPoseFailure(null);
    setRetryNonce((n) => n + 1);
  }, []);
  // `?section=sounds` opens straight into the Sounds tab. It is only the
  // initial value: once the user picks a section, the rail owns the choice.
  const [section, setSection] = useState<SectionId>(initialSection ?? 'skins');
  const [poseSkinSelection, setPoseSkinSelection] = useState<{
    heroId: number;
    key: string;
  } | null>(null);
  const selectedPoseSkinKey =
    poseSkinSelection?.heroId === hero.id ? poseSkinSelection.key : null;

  // Single-skin fallback: prefer the last skin the user enabled in this view,
  // then fall back to the first enabled skin.
  const fallbackPoseSkinMetaKey = useMemo(() => {
    const selected = selectedPoseSkinKey
      ? skinList.find((mod) => poseSkinSelectionKey(mod) === selectedPoseSkinKey && mod.enabled)
      : null;
    return (selected ?? skinList.find((mod) => mod.enabled))?.metaKey;
  }, [skinList, selectedPoseSkinKey]);

  // Default 3D preview source: every currently enabled visual VPK for this hero.
  // The main process uses priority to build a preview merge that matches game
  // load order, and falls back to fallbackPoseSkinMetaKey if the stack cannot export.
  const activeSkinSources = useMemo<HeroPoseSkinSource[]>(
    () =>
      skinList
        .filter((mod) => mod.enabled)
        .map((mod) => ({ metaKey: mod.metaKey, priority: mod.priority }))
        .sort((a, b) => b.priority - a.priority || a.metaKey.localeCompare(b.metaKey)),
    [skinList]
  );
  const activeSkinSourceKey =
    activeSkinSources.map((source) => `${source.priority}:${source.metaKey}`).join('|') ||
    'vanilla';
  // A hero or active-skin-stack change is a fresh attempt: the failure was for
  // the previous mount, not this one. Reset during render (React's documented
  // "adjust state when props change" pattern) rather than in an effect, so a
  // stale failure can never paint a newer hero or stack.
  const poseMountKey = `${hero.name}:${activeSkinSourceKey}`;
  const [poseMountKeyState, setPoseMountKeyState] = useState(poseMountKey);
  if (poseMountKeyState !== poseMountKey) {
    setPoseMountKeyState(poseMountKey);
    setPoseFailure(null);
  }

  // Live Body + Gun trippy params, pushed by TrippySkinPanel. Only feed the
  // viewer when it targets the hero currently shown so a stale entry from
  // another hero never paints the wrong model.
  const trippyPreview = useTrippyPreviewStore((s) => s.preview);
  const matchedTrippyPreview =
    trippyPreview && trippyPreview.heroName === hero.name ? trippyPreview : undefined;
  const hasSounds = soundList.length > 0;
  // If the active section runs out of mods (e.g. user deleted their last
  // sound for this hero) drop back to skins so the panel isn't stuck empty.
  const activeSection: SectionId = section === 'sounds' && !hasSounds ? 'skins' : section;
  // Group sound variants the same way skins are counted so the count matches
  // the gallery/list cards and the grouped rows rendered below.
  const soundCount = countLockerSkins(soundList);

  // Section rows, formatted like the Global view's type selector: label +
  // count, with empty sections disabled rather than hidden.
  const sections: Array<HeroDetailSection<SectionId>> = [
    { id: 'skins', label: t('locker.hero.skins'), icon: Shirt, count: skinCount },
    {
      id: 'sounds',
      label: t('locker.hero.sounds'),
      icon: Music,
      count: soundCount,
      disabled: !hasSounds,
      disabledReason: !hasSounds ? t('locker.hero.noSounds', 'No installed sounds for this hero.') : undefined,
    },
    { id: 'cards', label: t('locker.hero.cardsPortraits', 'Cards & portraits'), icon: Images, count: null },
    { id: 'effects', label: t('locker.hero.effects'), icon: Sparkles, count: null },
  ];

  const rememberPoseSkinSelection = (modId: string) => {
    const mod = skinList.find((entry) => entry.id === modId);
    if (!mod) return;
    const key = poseSkinSelectionKey(mod);

    setPoseSkinSelection((current) => {
      const currentKey = current?.heroId === hero.id ? current.key : null;
      if (mod.enabled) {
        return currentKey === key ? null : current;
      }
      return { heroId: hero.id, key };
    });
  };

  const handleSelect = async (modId: string) => {
    rememberPoseSkinSelection(modId);
    await onSelect(modId);
  };

  const handleToggleVariant = async (modId: string) => {
    rememberPoseSkinSelection(modId);
    await onToggleVariant(modId);
  };

  // Content-pane heading, Global-view style (section title + count). The Cards
  // and Effects panels render their own headers, so they skip it.
  const contentHeading =
    activeSection === 'skins'
      ? {
          title: t('locker.hero.skins'),
          count: skinCount > 0 ? t('locker.hero.skinCount', { count: skinCount }) : t('locker.hero.noSkins'),
        }
      : activeSection === 'sounds'
        ? {
            title: t('locker.hero.sounds'),
            count:
              soundCount > 0 ? t('locker.hero.soundCount', { count: soundCount }) : t('locker.hero.noSounds'),
          }
        : null;

  const selectionPanel =
    activeSection === 'cards' ? (
      <HeroCardPicker heroName={hero.name} />
    ) : activeSection === 'effects' ? (
      <HeroEffectsPanel key={hero.name} heroName={hero.name} />
    ) : activeSection === 'sounds' ? (
      <HeroSoundShelf heroName={hero.name} soundList={soundList} onSelect={onSelect} />
    ) : (
      <HeroSkinsPanel
        mods={skinList}
        onSelect={handleSelect}
        onToggleVariant={handleToggleVariant}
        onRequestDelete={onRequestDeleteSkin}
        hideNsfwPreviews={hideNsfwPreviews}
        categoryId={hero.id}
        showDownloadable
        heroName={hero.name}
        emptyMessage={t('locker.hero.downloadASkinForThisHero')}
        layout="cards"
        includedSkinKeys={includedSkinKeys}
        onToggleShuffleIncluded={onToggleShuffleIncluded}
        shuffleVariantChoices={shuffleVariantChoices}
        onSetShuffleVariant={onSetShuffleVariant}
        shuffleArmed={shuffleArmed}
      />
    );


  return (
    <HeroDetailFrame
      surface="locker"
      heroName={hero.name}
      backdropImage={backdropImage}
      heroIconUrl={hero.iconUrl}
      // Issue #208: the active skin's backdrop may already show the hero name.
      hideHeroName={hideHeroName && Boolean(backdropImage)}
      backLabel={t('locker.hero.back')}
      onBack={onBack}
      navLabel={t('locker.hero.lockerSections')}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setSection}
      backRowExtra={
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
            isFavorite
              ? 'border-yellow-400/60 bg-yellow-400/20 text-yellow-300'
              : 'border-border/70 text-text-secondary hover:text-text-primary'
          }`}
        >
          <Star className="w-4 h-4" />
          {isFavorite ? t('locker.hero.unfavorite') : t('locker.hero.favorite')}
        </button>
      }
      railTop={
        /* The other half of the Foundry link: the Locker is where you manage
           what you have, Foundry is where you make more of it. */
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {t('locker.hero.manageInstalled', 'Manage installed')}
          </p>
          {onEditInFoundry ? (
            <button
              type="button"
              onClick={onEditInFoundry}
              className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary"
            >
              <Hammer className="w-4 h-4" />
              {t('locker.hero.editInFoundry', 'Edit in Foundry')}
            </button>
          ) : null}
        </div>
      }
      railExtra={
        /* Load order for stacked skins. Lives in the sidebar (not over the
           grid) and self-hides unless 2+ skins are active. Only relevant to
           the Skins section. */
        activeSection === 'skins' && onReorderSkins ? (
          <SkinLoadOrderStrip
            mods={skinList}
            onReorder={onReorderSkins}
            hideNsfwPreviews={hideNsfwPreviews}
          />
        ) : null
      }
      /* Adjust the hero-detail backdrop image, choose the stage view (live
         model on the plate vs the 2D chain), and pop the model out into the
         floating panel. The stage-mode control decides what fills the plate;
         the pop-out moves the model into FloatingModelPanel while keeping the
         Model segment selected, so closing the panel returns it to the stage. */
      topRight={
        <>
          {activeSkin && activeSkinKey && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title={t('locker.hero.lockerImages')}
              aria-label={t('locker.hero.lockerImages')}
              className="flex items-center gap-1.5 rounded-full border border-border/70 bg-bg-secondary/70 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary backdrop-blur cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <SegmentedControl
            options={[
              { value: 'model', label: t('locker.hero.stageMode.model') },
              { value: 'image', label: t('locker.hero.stageMode.image') },
            ]}
            value={displayedMode}
            onChange={setStageMode}
            tabs={tabs}
            label={t('locker.hero.stageModeLabel')}
          />
          <IconButton
            icon={PictureInPicture2}
            label={t('locker.hero.popOutModel')}
            onClick={() => setModelPanelOpen(!modelPanelOpen)}
            disabled={displayedMode !== 'model'}
          />
        </>
      }
      platePreview={
        displayedMode === 'model' && !modelPanelOpen ? (
          <div className={heroPlateComposition({ kind: 'model' }).className}>
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white/80" />
                </div>
              }
            >
              <HeroPoseViewer
                key={`${hero.name}:${activeSkinSourceKey}:${fallbackPoseSkinMetaKey ?? ''}:${retryNonce}`}
                heroName={hero.name}
                skinSources={activeSkinSources}
                fallbackSkinMetaKey={fallbackPoseSkinMetaKey}
                trippyPreview={matchedTrippyPreview}
                onFailureChange={handlePoseFailureChange}
              />
            </Suspense>
          </div>
        ) : undefined
      }
      platePanel={tabs.panelProps(displayedMode)}
      after={
        <>
          {/* Live 3D model, popped out of the stage: the same viewer, now
              floating/dockable. Exactly one instance of the viewer exists at
              any moment: it fills the plate when Model is selected and the
              panel is closed, and moves in here when the panel is open. */}
          {/* Gated on the displayed mode too: a definitive pose failure flips
              `displayedMode` to Image, and the pop-out must never keep a dead
              3D viewer mounted under the "switched to Image" banner. */}
          {modelPanelOpen && displayedMode !== 'image' && (
            <FloatingModelPanel
              surface="locker"
              /* Name the skin, not just the hero: while comparing skins the
                 title is otherwise the one thing that does not say what you
                 are looking at. */
              title={
                activeSkin
                  ? t('locker.hero.hero3dModelSkin', { hero: hero.name, skin: activeSkin.name })
                  : t('locker.hero.hero3dModel', { hero: hero.name })
              }
              onClose={() => setModelPanelOpen(false)}
            >
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white/80" />
                  </div>
                }
              >
                <HeroPoseViewer
                  key={`${hero.name}:${activeSkinSourceKey}:${fallbackPoseSkinMetaKey ?? ''}:${retryNonce}`}
                  heroName={hero.name}
                  skinSources={activeSkinSources}
                  fallbackSkinMetaKey={fallbackPoseSkinMetaKey}
                  trippyPreview={matchedTrippyPreview}
                  onFailureChange={handlePoseFailureChange}
                />
              </Suspense>
            </FloatingModelPanel>
          )}

          {/* Unified per-skin image picker (issue #208): tabbed for the 3:4 grid
              thumbnail, the 16:9 skin-panel card and the 16:9 backdrop, opening
              on the thumbnail tab. */}
          {pickerOpen && activeSkin && activeSkinKey && (
            <LockerModImagePicker
              mod={activeSkin}
              skinKey={activeSkinKey}
              heroName={hero.name}
              lockerImageDataUrl={thumbnailImage}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      }
    >
      {/* Auto-fallback banner (UI-SPEC E4): a definitive pose failure defaults
          the stage to Image for this hero, and says so. Rendered above the
          overlap panel; Retry clears the recorded failure and remounts the
          viewer so the model is re-attempted. */}
      {poseFailure && (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-4 text-xs text-text-secondary">
          <AlertTriangle
            size={13}
            className="mt-0.5 shrink-0 text-state-warning"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{t('locker.hero.stageAutoFallback')}</p>
          <button
            type="button"
            onClick={retryModel}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:border-accent/60 hover:text-text-primary cursor-pointer"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            {t('locker.pose.retry')}
          </button>
        </div>
      )}
      {/* Say what the stack overwrites before the user has to go looking for it
          on Conflicts. Self-hides below two enabled skins. */}
      {activeSection === 'skins' && <HeroSkinOverlapPanel mods={skinList} />}
      {contentHeading && (
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {contentHeading.title}
          </h3>
          <span className="text-xs text-white/60">{contentHeading.count}</span>
        </div>
      )}
      {selectionPanel}
    </HeroDetailFrame>
  );
}
