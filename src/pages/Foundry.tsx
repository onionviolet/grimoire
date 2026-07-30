import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScrollRestore } from '../lib/useScrollRestore';
import {
  Hammer,
  Library,
  Volume2,
  Globe,
  Image as ImageIcon,
  Images,
  ShoppingBag,
  Palette,
  ArrowLeft,
  ListChecks,
  Flag,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/common/PageComponents';
import { canonicalHeroName } from '../lib/lockerUtils';
import { CATEGORY_ORDER, type SoundCategory } from '../lib/soundInventory';
import Tx from '../components/translation/Tx';
import { useAppStore } from '../stores/appStore';
import { foundryForge, foundryForgeInstall, foundryHeroes, foundryScanNonStandard, foundryWarmCache } from '../lib/api';
import { showToast } from '../stores/toastStore';
import type { HeroInfo } from '../types/foundry';
import LibraryBrowse from '../components/foundry/LibraryBrowse';
import PortraitBrowse from '../components/foundry/PortraitBrowse';
import SoundBrowse from '../components/foundry/SoundBrowse';
import GlobalSoundBrowse from '../components/foundry/GlobalSoundBrowse';
import TextureBrowse from '../components/foundry/TextureBrowse';
import RecolorTool from '../components/foundry/RecolorTool';
import FoundryHeroGrid from '../components/foundry/FoundryHeroGrid';
import HeroWorkshop from '../components/foundry/HeroWorkshop';
import FoundryBuildTray from '../components/foundry/FoundryBuildTray';
import MyChanges from '../components/foundry/MyChanges';
import NonStandardReportView from '../components/foundry/NonStandardReport';
import type { FoundryChangeFilter } from '../components/foundry/changeList';
import type { FoundryStagedEdit } from '../components/foundry/buildTray';

// Sub-tools shown in the left rail of the Catalog (tool-first) mode. Library /
// Sound / Global sounds / Texture / Recolor are live; Items rides the Library
// grid for now. Sound is hero-scoped (`soundevents/hero/` + VO); Global covers
// everything else the game plays (UI, music, ambience, NPCs, shop items).
const SUBTOOLS = [
  { id: 'library', icon: Library, labelKey: 'foundry.subtools.library', enabled: true },
  { id: 'sound', icon: Volume2, labelKey: 'foundry.subtools.sound', enabled: true },
  { id: 'myChanges', icon: ListChecks, labelKey: 'foundry.subtools.myChanges', enabled: true },
  { id: 'globalSound', icon: Globe, labelKey: 'foundry.subtools.globalSound', enabled: true },
  { id: 'texture', icon: ImageIcon, labelKey: 'foundry.subtools.texture', enabled: true },
  { id: 'portraits', icon: Images, labelKey: 'foundry.subtools.portraits', enabled: true },
  { id: 'items', icon: ShoppingBag, labelKey: 'foundry.subtools.items', enabled: true },
  { id: 'recolor', icon: Palette, labelKey: 'foundry.subtools.recolor', enabled: true },
] as const;

type SubtoolId = (typeof SUBTOOLS)[number]['id'];
type Mode = 'heroes' | 'catalog';

/** Where "make a new one" lands for the shelf the user is looking at. The
 *  Library grid covers portraits and ability icons; Items and Texture have
 *  their own sub-tools. Sounds default to the hero browser, which is the one
 *  that can also reach global events. */
function subtoolForChangeFilter(filter: FoundryChangeFilter): SubtoolId {
  switch (filter) {
    case 'sound':
      return 'sound';
    case 'item-icon':
      return 'items';
    case 'other':
      return 'texture';
    case 'hero-image':
      return 'portraits';
    case 'ability-icon':
      return 'library';
    default:
      return 'library';
  }
}

export default function Foundry() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const hasGamePath = Boolean(settings?.deadlockPath || (settings?.devMode && settings?.devDeadlockPath));

  // Hero-first is the primary Foundry experience: pick a hero, edit everything.
  // The Catalog (tool-first) mode keeps the original asset-browse rail.
  const [mode, setMode] = useState<Mode>('heroes');
  const [selectedHero, setSelectedHero] = useState<HeroInfo | null>(null);
  const [active, setActive] = useState<SubtoolId>('library');
  const [heroes, setHeroes] = useState<HeroInfo[]>([]);
  const [nonStandardReport, setNonStandardReport] = useState<import('../types/foundry').NonStandardReport | null>(null);
  const [scanningNonStandard, setScanningNonStandard] = useState(false);
  // The tray is intentionally ephemeral until all forge flows can hand a single
  // typed build request to main. Merely browsing Foundry never mutates a mod.
  const [stagedEdits, setStagedEdits] = useState<FoundryStagedEdit[]>([]);
  const [outputName, setOutputName] = useState('Foundry mod');
  const stageEdit = useCallback((edit: FoundryStagedEdit) => setStagedEdits((current) => [...current.filter((item) => item.id !== edit.id), { ...edit, precedence: current.length }]), []);
  const removeEdit = useCallback((id: string) => setStagedEdits((current) => current.filter((item) => item.id !== id)), []);
  // Cancelling the native save dialog is a normal outcome, not an error: main
  // reports { exported: false } and has already removed its own build temp, so
  // the only correct renderer response is to keep every staged edit exactly as
  // it was and say so. Clearing the tray is reserved for a real export.
  const forge = useCallback(async (request: import('../types/foundry').FoundryForgeRequest) => {
    const result = await foundryForge(request);
    if (result.exported) {
      setStagedEdits([]);
      showToast(t('foundry.buildTray.exported', 'Exported {{path}}', { path: result.path }), { tone: 'success', duration: 6000 });
    } else {
      showToast(t('foundry.buildTray.cancelled', 'Nothing was exported. Your staged edits are still here.'), { tone: 'info', duration: 6000 });
    }
  }, [t]);

  // The other output for the same reviewed build: it becomes a tracked mod, so
  // it keeps its provenance and shows up in My changes. Unlike export there is
  // no dialog to cancel, so a success always clears the tray.
  const install = useCallback(async (request: import('../types/foundry').FoundryForgeRequest) => {
    await foundryForgeInstall(request);
    await useAppStore.getState().loadMods({ silent: true });
    setStagedEdits([]);
    showToast(t('foundry.buildTray.installed', 'Installed "{{name}}". Find it in My changes.', { name: request.name }), { tone: 'success', duration: 6000 });
  }, [t]);
  const scanNonStandard = useCallback(async () => {
    setScanningNonStandard(true);
    try {
      setNonStandardReport(await foundryScanNonStandard());
    } catch (error) {
      showToast(t('foundry.nonStandard.failed', 'Couldn’t scan non-standard files: {{error}}', { error: error instanceof Error ? error.message : String(error) }), { tone: 'error', duration: 7000 });
    } finally {
      setScanningNonStandard(false);
    }
  }, [t]);

  // Roster (codename -> name) loads once; warm the catalog cache opportunistically
  // so the Sound tool opens without the cold voice-line rescan.
  useEffect(() => {
    if (!hasGamePath) return;
    let cancelled = false;
    foundryHeroes()
      .then((roster) => {
        if (!cancelled) setHeroes(roster);
      })
      .catch(() => {
        /* roster failure is non-fatal: labels fall back to the codename */
      });
    void foundryWarmCache();
    return () => {
      cancelled = true;
    };
  }, [hasGamePath]);

  // `/foundry?hero=<display name>` opens that hero's workshop: the Locker links
  // here by name because it only knows GameBanana category names, not the
  // catalog codenames. This is derived from the URL rather than copied into
  // state, so the link is the single source of truth while it is present and
  // there is no render cascade to resolve it. Resolution waits for the roster,
  // and an unknown name leaves the user on the hero grid rather than opening
  // the wrong workshop. Backing out clears the query (see `leaveWorkshop`).
  const linkedHero = useMemo(() => {
    const wanted = new URLSearchParams(location.search).get('hero');
    if (!wanted || !heroes.length) return null;
    const canonical = canonicalHeroName(wanted);
    return heroes.find((hero) => canonicalHeroName(hero.name) === canonical) ?? null;
  }, [heroes, location.search]);
  // `/foundry?tool=<subtool>` opens the catalog rail on that tool. The hero
  // workshop rail has no home for the non-hero tools (Global sounds most of
  // all), so the Sound Locker's Global shelf links here by tool id the same way
  // the Locker links here by hero. Derived from the URL for the same reason
  // `linkedHero` is: the link stays the single source of truth while it is
  // present, and picking another tool clears the query rather than fighting it.
  const linkedTool = useMemo(() => {
    const wanted = new URLSearchParams(location.search).get('tool');
    return SUBTOOLS.find((entry) => entry.id === wanted)?.id ?? null;
  }, [location.search]);
  // The link carries a Locker SoundCategory verbatim now: both surfaces group
  // by the same vocabulary, so there is nothing left to translate between them
  // (the old `gameplay`/`other` spellings were the engine's, not ours).
  const linkedGlobalSoundCategory = useMemo(() => {
    const category = new URLSearchParams(location.search).get('category');
    return category && (CATEGORY_ORDER as readonly string[]).includes(category)
      ? (category as SoundCategory)
      : 'all';
  }, [location.search]);
  const clearLinkedTool = useCallback(() => {
    if (linkedTool) navigate('/foundry', { replace: true });
  }, [linkedTool, navigate]);

  const workshopHero = selectedHero ?? linkedHero;
  const activeTool: SubtoolId = linkedTool ?? active;
  const toolScrollRef = useScrollRestore<HTMLDivElement>(`foundry:${activeTool}`, [activeTool]);
  const activeMode: Mode = linkedHero ? 'heroes' : linkedTool ? 'catalog' : mode;
  const leaveWorkshop = useCallback(() => {
    setSelectedHero(null);
    if (linkedHero) navigate('/foundry', { replace: true });
  }, [linkedHero, navigate]);

  const heroNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of heroes) map.set(h.codename, h.name);
    return map;
  }, [heroes]);

  // No game path: same gate regardless of mode.
  if (!hasGamePath) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader
          title={<Tx k="foundry.header.title" fallback="Foundry" />}
          description={
            <Tx
              k="foundry.header.description"
              fallback="Browse the game's own asset catalog, built offline from your installed files."
            />
          }
        />
        <EmptyState
          icon={Hammer}
          title={<Tx k="foundry.empty.noPath.title" fallback="Set your Deadlock path" />}
          description={
            <Tx
              k="foundry.empty.noPath.description"
              fallback="Foundry reads the asset catalog from your installed game. Set the Deadlock path in Settings to get started."
            />
          }
        />
      </div>
    );
  }

  // Hero workshop: full-bleed, no page chrome (mirrors the Locker hero view).
  if (activeMode === 'heroes' && workshopHero) {
    return (
      <HeroWorkshop
        hero={workshopHero}
        heroNames={heroNames}
        // Only meaningful alongside `?hero=`: a deep link opens a specific
        // hero's workshop on a specific section (the Locker links portraits).
        initialSection={new URLSearchParams(location.search).get('section') ?? undefined}
        onBack={leaveWorkshop}
        stagedEdits={stagedEdits}
        onStage={stageEdit}
        onRemoveStagedEdit={removeEdit}
        outputName={outputName}
        onOutputNameChange={setOutputName}
        onForge={forge}
        onInstall={install}
      />
    );
  }

  // Hero roster landing.
  if (activeMode === 'heroes') {
    return (
      <div className="space-y-4 p-6">
        <PageHeader
          title={<Tx k="foundry.header.title" fallback="Foundry" />}
          description={
            <Tx
              k="foundry.heroes.subtitle"
              fallback="Pick a hero to edit their look, abilities, voice, and icons."
            />
          }
          action={
            // Global sounds is not hero-scoped, so the workshop rail has no home
            // for it and it was reachable only by knowing to open the catalog
            // first. Surface it here as its own jump-in.
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void scanNonStandard()}
                disabled={scanningNonStandard}
                className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:cursor-wait disabled:opacity-60 cursor-pointer"
              >
                <Flag size={15} />
                {scanningNonStandard
                  ? t('foundry.nonStandard.scanning', 'Scanning files…')
                  : <Tx k="foundry.nonStandard.action" fallback="Flag non-standard files" />}
              </button>
              {settings?.forkGlobalSounds !== false && (
                <button
                  type="button"
                  onClick={() => {
                    setActive('globalSound');
                    setMode('catalog');
                  }}
                  className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
                >
                  <Globe size={15} />
                  <Tx k="foundry.subtools.globalSound" fallback="Global sounds" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('catalog')}
                className="flex items-center gap-2 rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
              >
                <Library size={15} />
                <Tx k="foundry.browseCatalog" fallback="Browse full catalog" />
              </button>
            </div>
          }
        />
        <FoundryHeroGrid heroes={heroes} onPick={setSelectedHero} />
        {nonStandardReport && <NonStandardReportView report={nonStandardReport} />}
      </div>
    );
  }

  // Catalog (tool-first) mode: the original asset-browse rail.
  return (
    <div className="flex h-full">
      <aside className="flex w-44 shrink-0 flex-col gap-1 border-r border-border bg-bg-secondary/40 p-3">
        <button
          type="button"
          onClick={() => {
            clearLinkedTool();
            setMode('heroes');
          }}
          className="mb-1 flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft size={15} />
          <Tx k="foundry.backToHeroes" fallback="Heroes" />
        </button>
        <span className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary/70">
          <Tx k="foundry.subtools.heading" fallback="Workshop" />
        </span>
        {SUBTOOLS.filter(
          // Fork flag: hide the Global sounds tool when switched off, so this
          // build can be compared against stock behaviour without rebuilding.
          (tool) => tool.id !== 'globalSound' || settings?.forkGlobalSounds !== false
        ).map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={!tool.enabled}
              onClick={() => {
                if (!tool.enabled) return;
                clearLinkedTool();
                setActive(tool.id);
              }}
              className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-accent/10 font-medium text-accent'
                  : tool.enabled
                    ? 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    : 'cursor-default text-text-secondary/50'
              }`}
            >
              <Icon size={16} />
              <span className="flex-1 text-left"><Tx k={tool.labelKey} fallback={tool.id} /></span>
              {!tool.enabled && (
                <span className="text-[9px] uppercase tracking-wide text-text-secondary/40">
                  <Tx k="foundry.subtools.soon" fallback="soon" />
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* The tool pane owns its scroll, keyed per tool, so switching away
          from a long catalog and back returns to where you were reading.
          Layout's shared container is keyed by route and remounts. */}
      <div ref={toolScrollRef} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-4 p-6">
          <PageHeader
            title={<Tx k="foundry.header.title" fallback="Foundry" />}
            description={
              <Tx
                k="foundry.header.description"
                fallback="Browse the game's own asset catalog, built offline from your installed files."
              />
            }
          />

          {activeTool === 'sound' ? (
            <SoundBrowse heroes={heroes} heroNames={heroNames} onStage={stageEdit} />
          ) : activeTool === 'myChanges' ? (
            <MyChanges
              onAddNew={(filter) => {
                clearLinkedTool();
                setActive(subtoolForChangeFilter(filter));
              }}
            />
          ) : activeTool === 'globalSound' && settings?.forkGlobalSounds !== false ? (
            <GlobalSoundBrowse initialCategory={linkedGlobalSoundCategory} onStage={stageEdit} />
          ) : activeTool === 'texture' ? (
            <TextureBrowse heroes={heroes} heroNames={heroNames} onStage={stageEdit} />
          ) : activeTool === 'portraits' ? (
            <PortraitBrowse heroNames={heroNames} onStage={stageEdit} />
          ) : activeTool === 'recolor' ? (
            <RecolorTool heroes={heroes} />
          ) : activeTool === 'items' ? (
            <LibraryBrowse heroNames={heroNames} initialCategory="item-icon" onStage={stageEdit} />
          ) : (
            <LibraryBrowse heroNames={heroNames} onStage={stageEdit} />
          )}
        </div>
      </div>
      <FoundryBuildTray edits={stagedEdits} outputName={outputName} onOutputNameChange={setOutputName} onForge={forge} onInstall={install} onRemove={removeEdit} />
    </div>
  );
}
