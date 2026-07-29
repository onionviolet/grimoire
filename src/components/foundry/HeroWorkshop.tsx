import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Layers3,
  Loader2,
  Sparkles,
  Swords,
  Volume2,
  Image as ImageIcon,
  Images,
  ListChecks,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FoundryForgeRequest, HeroInfo } from '../../types/foundry';
import type { Mod } from '../../types/mod';
import type { HeroPoseSkinSource } from '../../types/portrait';
import {
  getHeroChipIconPath,
  inferHeroFromTitle,
  isLockerManagedMod,
} from '../../lib/lockerUtils';
import HeroDetailFrame, { type HeroDetailSection } from '../common/HeroDetailFrame';
import HeroEffectsPanel from '../locker/HeroEffectsPanel';
import HeroSoundPicker from '../locker/HeroSoundPicker';
import FloatingModelPanel from '../locker/FloatingModelPanel';
import SoundBrowse from './SoundBrowse';
import TextureBrowse from './TextureBrowse';
import LibraryBrowse from './LibraryBrowse';
import PortraitBrowse from './PortraitBrowse';
import FoundryBuildTray from './FoundryBuildTray';
import MyChanges from './MyChanges';
import type { FoundryStagedEdit } from './buildTray';
import { useTrayPreview } from './useTrayPreview';
import Tx from '../translation/Tx';
import { useAppStore } from '../../stores/appStore';
// three.js viewer is heavy; only pull the chunk when the user flips to 3D, the
// same way the Locker does. It must not enter the Foundry bundle for users who
// never open the preview.
const HeroPoseViewer = lazy(() => import('../locker/HeroPoseViewer'));

interface HeroWorkshopProps {
  hero: HeroInfo;
  /** Full roster codename -> display name map (for the reused browse panels). */
  heroNames: Map<string, string>;
  onBack: () => void;
  /** The shared Foundry tray. The workshop hosts the same staged edits as the
   *  catalog mode: a staged edit that cannot be reviewed here would be worse
   *  than one that was never staged at all. */
  stagedEdits: readonly FoundryStagedEdit[];
  onStage: (edit: FoundryStagedEdit) => void;
  onRemoveStagedEdit: (id: string) => void;
  outputName: string;
  onOutputNameChange: (name: string) => void;
  onForge: (request: FoundryForgeRequest) => Promise<void>;
  /** Install the reviewed build instead of exporting it, so it is tracked and
   *  listed in My changes. Optional, exactly as on the tray itself. */
  onInstall?: (request: FoundryForgeRequest) => Promise<void>;
  /** Section to open on (deep links like `/foundry?hero=X&section=portraits`).
   *  Unknown values fall back to the default first section. */
  initialSection?: string;
}

type SectionId = 'appearance' | 'abilities' | 'voice' | 'portraits' | 'icons' | 'myChanges';

const SECTION_IDS: readonly SectionId[] = ['appearance', 'abilities', 'voice', 'portraits', 'icons', 'myChanges'];

/**
 * The per-hero Foundry workshop: pick a hero, edit everything about them. Mirrors
 * the Locker's hero-detail frame (full-bleed render backdrop + frosted-glass rail
 * + section nav) but the sections are creation surfaces over the asset catalog:
 *
 *   Appearance  recolor / prism / body+gun materials  (HeroEffectsPanel, live)
 *   Abilities   per-ability SFX (HeroSoundPicker, live) + gameplay-sound browse;
 *               per-ability icon + VFX editing is the next phase
 *   Voice       hero VO voice-line browse + audition   (SoundBrowse only=voice)
 *   Icons       ability icons + model textures         (Texture/LibraryBrowse, live browse)
 *
 * Immediate-apply sections (recolor, sound picker) still write their own managed
 * mod through the existing Locker engines (e.g. sound via `applyHeroSound`).
 * Authoring surfaces that stage instead (sound swaps, texture and icon
 * replacements) feed the shared build tray this view docks on the right, so the
 * hero-first mode reviews and forges the same write set the catalog mode does.
 */
export default function HeroWorkshop({
  hero,
  heroNames,
  onBack,
  stagedEdits,
  onStage,
  onRemoveStagedEdit,
  outputName,
  onOutputNameChange,
  onForge,
  onInstall,
  initialSection,
}: HeroWorkshopProps) {
  const { t } = useTranslation();
  const mods = useAppStore((s) => s.mods);
  const modsLoaded = useAppStore((s) => s.modsLoaded);
  const loadMods = useAppStore((s) => s.loadMods);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const [section, setSection] = useState<SectionId>(
    SECTION_IDS.find((id) => id === initialSection) ?? 'appearance'
  );
  // The workshop is a full-bleed hero view, so the tray docks on demand rather
  // than permanently eating width. Staging opens it: an edit the user cannot
  // see landing is an edit they cannot review.
  const [trayOpen, setTrayOpen] = useState(false);
  // The other half of the trade with the Locker: Foundry could review a write
  // set but never look at it. Authoring a visual edit blind is the largest
  // quality gap in the app, so the workshop gets the Locker's 3D panel.
  const [view3d, setView3d] = useState(false);
  const stage = useCallback((edit: FoundryStagedEdit) => {
    onStage(edit);
    setTrayOpen(true);
  }, [onStage]);

  // A single-hero roster so the reused browse panels are pre-scoped to this hero
  // (they each carry their own hero filter; handing them one hero pins it).
  const scopedRoster = useMemo<HeroInfo[]>(() => [hero], [hero]);

  useEffect(() => {
    if (!modsLoaded) void loadMods();
  }, [modsLoaded, loadMods]);

  // The whole point of the preview is to answer "what will this look like in my
  // game", not "what does this look like on a vanilla model", so the tray build
  // stacks on top of whatever the user already has enabled for this hero.
  const enabledHeroSkins = useMemo(
    () =>
      mods.filter(
        (mod: Mod) =>
          mod.enabled &&
          isLockerManagedMod(mod) &&
          (mod.lockerHero ?? inferHeroFromTitle(mod.name))?.toLowerCase() ===
            hero.name.toLowerCase()
      ),
    [mods, hero.name]
  );

  // Lower priority wins a file conflict (see modLoadOrder), so "above the
  // enabled stack" means one below the lowest priority currently in it.
  const previewPriority = useMemo(
    () => Math.min(0, ...enabledHeroSkins.map((mod: Mod) => mod.priority)) - 1,
    [enabledHeroSkins]
  );

  const trayPreview = useTrayPreview(stagedEdits, view3d);

  const poseSkinSources = useMemo<HeroPoseSkinSource[]>(() => {
    const sources: HeroPoseSkinSource[] = enabledHeroSkins.map((mod: Mod) => ({
      metaKey: mod.metaKey,
      priority: mod.priority,
    }));
    if (trayPreview.previewId) {
      sources.push({
        // Stable synthetic identity: the pose cache is content-addressed on
        // (metaKey, size, mtime), so a rebuilt preview VPK invalidates it for
        // free and needs no bespoke invalidation rule.
        metaKey: 'foundry-tray-preview',
        priority: previewPriority,
        previewId: trayPreview.previewId,
      });
    }
    return sources.sort(
      (a, b) => b.priority - a.priority || a.metaKey.localeCompare(b.metaKey)
    );
  }, [enabledHeroSkins, previewPriority, trayPreview.previewId]);

  const poseSourceKey =
    poseSkinSources
      .map((source) => `${source.priority}:${source.metaKey}:${source.previewId ?? ''}`)
      .join('|') || 'vanilla';

  const heroSoundMods = useMemo(
    () =>
      mods.filter((mod: Mod) =>
        mod.abilitySounds?.perHero.some((entry) => entry.hero.toLowerCase() === hero.name.toLowerCase()),
      ),
    [mods, hero.name],
  );

  const sections: Array<HeroDetailSection<SectionId>> = [
    { id: 'appearance', label: t('foundry.workshop.appearance', 'Appearance'), icon: Sparkles },
    { id: 'abilities', label: t('foundry.workshop.abilities', 'Abilities'), icon: Swords },
    { id: 'voice', label: t('foundry.workshop.voice', 'Voice'), icon: Volume2 },
    { id: 'portraits', label: t('foundry.workshop.portraits', 'Portraits'), icon: Images },
    { id: 'icons', label: t('foundry.workshop.icons', 'Icons & Textures'), icon: ImageIcon },
    { id: 'myChanges', label: t('foundry.workshop.myChanges', 'My changes'), icon: ListChecks },
  ];

  return (
    <HeroDetailFrame
      surface="foundry"
      heroName={hero.name}
      // Third fallback step, matching the grid: a hero with no render still
      // gets their chip icon rather than dropping straight to bare text.
      heroIconUrl={getHeroChipIconPath(hero.name)}
      backLabel={t('foundry.workshop.back', 'All heroes')}
      onBack={onBack}
      navLabel={t('foundry.workshop.sections', 'Workshop sections')}
      sections={sections}
      activeSection={section}
      onSectionChange={setSection}
      contentWidth="fluid"
      railTop={
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-text-primary">
          <p className="font-medium">{t('foundry.workshop.createNewMod', 'Create a new mod')}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {stagedEdits.length > 0
              ? t('foundry.workshop.stagedEdits', '{{count}} staged edit ready for the Build tray', { count: stagedEdits.length })
              : t('foundry.workshop.stagedEditsEmpty', 'Stage an edit, then review it in the Build tray.')}
          </p>
        </div>
      }
      topRight={
        <button
          type="button"
          onClick={() => setView3d((open) => !open)}
          aria-pressed={view3d}
          title={
            view3d
              ? t('foundry.workshop.hide3dPreview', 'Hide the 3D preview')
              : t('foundry.workshop.show3dPreview', 'Preview the build tray on the 3D model')
          }
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            view3d
              ? 'border-accent/60 bg-accent/20 text-text-primary'
              : 'border-border/70 bg-bg-secondary/70 text-text-secondary hover:text-text-primary backdrop-blur'
          }`}
        >
          <Box className="h-3.5 w-3.5" />
          3D
        </button>
      }
      railExtra={
        <button
          type="button"
          onClick={() => setTrayOpen((open) => !open)}
          aria-expanded={trayOpen}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
            trayOpen ? 'border-accent/60 bg-accent/15' : 'border-transparent hover:bg-white/10'
          }`}
        >
          <Layers3 className="h-4 w-4 flex-shrink-0 text-white/80" />
          <span className="flex-1 truncate text-sm font-medium text-white">
            {stagedEdits.length > 0
              ? t('foundry.buildTray.openWithCount', 'Build tray ({{count}})', { count: stagedEdits.length })
              : t('foundry.buildTray.panelToggle', 'Build tray')}
          </span>
        </button>
      }
      after={
        <>
          {trayOpen && (
            <div className="relative z-10 overflow-y-auto scrollbar-glass">
              <FoundryBuildTray
                edits={stagedEdits}
                outputName={outputName}
                onOutputNameChange={onOutputNameChange}
                onForge={onForge}
                onInstall={onInstall}
                onRemove={onRemoveStagedEdit}
                className="h-full bg-bg-secondary/80"
              />
            </div>
          )}

          {/* The staged edits, built into a throwaway VPK and stacked over the
              user's own enabled skins. Mounted only while open so the heavy
              three.js chunk loads on demand. */}
          {view3d && (
            <FloatingModelPanel
              title={t('foundry.workshop.preview3dTitle', '{{hero}} preview', { hero: hero.name })}
              onClose={() => setView3d(false)}
            >
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white/80" />
                  </div>
                }
              >
                <HeroPoseViewer
                  key={`${hero.name}:${poseSourceKey}`}
                  heroName={hero.name}
                  skinSources={poseSkinSources}
                />
              </Suspense>
              {trayPreview.building && (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
                  <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('foundry.workshop.previewBuilding', 'Building preview')}
                  </span>
                </div>
              )}
              {trayPreview.error && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center">
                  <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200 backdrop-blur">
                    {t('foundry.workshop.previewFailed', 'Preview build failed: {{error}}', {
                      error: trayPreview.error,
                    })}
                  </span>
                </div>
              )}
            </FloatingModelPanel>
          )}
        </>
      }
    >
      {section === 'appearance' ? (
        <HeroEffectsPanel key={hero.name} heroName={hero.name} />
      ) : section === 'abilities' ? (
        <div className="space-y-6">
          <HeroSoundPicker
            heroName={hero.name}
            soundList={heroSoundMods}
            onSelect={(modId) => void toggleMod(modId)}
          />
          {/* Each ability card lists its gameplay sounds with play + Swap (drop
              your own MP3), forged through the soundswap engine. The ability
              axis lives here (not under Voice); Voice is VO only. */}
          <SoundBrowse heroes={scopedRoster} heroNames={heroNames} only="gameplay" onStage={stage} />
          <AbilitiesComingNote />
        </div>
      ) : section === 'voice' ? (
        <SoundBrowse heroes={scopedRoster} heroNames={heroNames} only="voice" onStage={stage} />
      ) : section === 'portraits' ? (
        // The family-first portrait surface, pinned to this hero. Staging goes
        // through the same editor and preflight as the catalog-mode tab.
        <PortraitBrowse hero={hero.codename} heroNames={heroNames} onStage={stage} />
      ) : section === 'icons' ? (
        <div className="space-y-8">
          <TextureBrowse heroes={scopedRoster} heroNames={heroNames} onStage={stage} />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/90">
              {t('foundry.workshop.abilityIcons', 'Ability & item icons')}
            </h4>
            <LibraryBrowse heroNames={heroNames} initialCategory="ability-icon" onStage={stage} />
          </div>
        </div>
      ) : section === 'myChanges' ? (
        // Scoped to this hero: the workshop is a per-hero surface, so a
        // global change would read as belonging to a hero it does not.
        <MyChanges heroName={hero.name} onAddNew={() => setSection('icons')} />
      ) : null}
    </HeroDetailFrame>
  );
}

function AbilitiesComingNote() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-bg-secondary/50 p-4 text-sm leading-relaxed text-text-secondary">
      <p className="mb-1 font-medium text-text-primary">
        <Tx k="foundry.workshop.abilitiesSoon.title" fallback="More per-ability editing coming" />
      </p>
      <Tx
        k="foundry.workshop.abilitiesSoon.body"
        fallback="Per-ability icon and VFX color editing will land here next, one row per ability. For now, recolor all ability VFX at once under Appearance, and browse ability icons under Icons & Textures."
      />
    </div>
  );
}
