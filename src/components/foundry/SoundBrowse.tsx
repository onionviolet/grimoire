import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Search,
    Loader2,
    AlertTriangle,
    Users,
    Play,
    Pause,
    ChevronRight,
    Crosshair,
    Sparkles,
    Footprints,
    Swords,
    AudioLines,
    MessageSquare,
    Wand2,
    Upload,
    X,
    Pencil,
    Check,
    Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/PageComponents';
import Tx from '../translation/Tx';
import { SoundImportEditor, type SoundImportEdits } from './SoundImportEditor';
import AssetSourcesPanel from './AssetSourcesPanel';
import { useClipPlayer, type ClipPlayer, type RowState } from './useClipPlayer';
import { resolveForgeAudioPath } from './resolveForgeAudio';
import { planSoundPool, type PoolAudio, type SoundPoolMode } from './soundPoolPlan';
import {
    foundryHeroSounds,
    foundryInspectSoundConflicts,
    foundryVoicelines,
    foundrySwapSound,
    foundryVoiceclip,
    foundryVoiceclipFile,
    getHeroAbilitySlots,
    foundrySoundAnnotations,
    foundrySoundAnnotationKey,
    saveFoundrySoundAnnotation,
} from '../../lib/api';
import { describeSound, primaryClipName } from '../../lib/soundDescribe';
import { isAnnotated, matchSoundWithAnnotation } from '../../lib/soundAnnotationSearch';
import { showToast } from '../../stores/toastStore';
import { useAppStore } from '../../stores/appStore';
import type { HeroInfo, HeroSound, HeroSoundCategory, VoiceLine, SoundAnnotation, FoundrySoundConflictInspection, SoundConflictResolution } from '../../types/foundry';
import type { HeroAbilitySlot } from '../../types/mod';

/** Context threaded to a row so it can offer an inline sound-swap (drop your own
 *  MP3 onto the event). Hero rows carry the hero; global (non-hero) rows carry
 *  the soundevents file the event lives in instead, since there is no hero to
 *  resolve it from. VO rows swap by clip path and need neither. */
export interface SwapContext {
    hero: string;
    heroName: string;
    /** Global mode: the `.vsndevts_c` entry carrying the event (a
     *  `GlobalSound.soundevents`). When set, `hero`/`heroName` are empty and the
     *  built mod is filed under the Locker's global Sounds bucket. */
    soundeventsEntry?: string;
}

/** Catalog rows name the source `.vsnd`, while VPK directories contain the
 * compiled `.vsnd_c` entry that an addon actually overrides. */
function compiledSoundEntry(path: string): string {
    return path.replace(/\\/g, '/').replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');
}

interface SoundBrowseProps {
    heroes: HeroInfo[];
    heroNames: Map<string, string>;
    /** Restrict the browse to one corpus. `gameplay` = ability/weapon/movement/
     *  melee sounds; `voice` = the VO voice-line list. Omitted shows both (the
     *  catalog tool-first rail). The hero-first workshop splits them across its
     *  Abilities (gameplay) and Voice (VO) sections. */
    only?: 'gameplay' | 'voice';
}

// Cap on rendered VO rows: a hero has ~1600 voice-line events, so the
// supplementary list is bounded with a "refine your search" hint rather than
// dumping every row. Gameplay sounds (~30 events) are never capped.
const VO_ROW_CAP = 500;

// Stable empty references so memo deps don't churn every render.
const NO_SOUNDS: HeroSound[] = [];
const NO_LINES: VoiceLine[] = [];
const NO_SLOT_META = new Map<number, HeroAbilitySlot>();

// Gameplay categories in display order: abilities and gun lead (what players
// reach for), then locomotion, melee, and the odds-and-ends bucket.
const CATEGORY_ORDER: HeroSoundCategory[] = ['ability', 'weapon', 'movement', 'melee', 'other'];

const CATEGORY_ICON: Record<HeroSoundCategory, typeof Sparkles> = {
    ability: Sparkles,
    weapon: Crosshair,
    movement: Footprints,
    melee: Swords,
    other: AudioLines,
};

/**
 * The Sound sub-tool: browse every sound a hero makes. It leads with the hero's
 * gameplay sounds (abilities, gun, movement, melee) grouped by category, read
 * from `soundevents/hero/<code>.vsndevts_c` via `catalog herosounds`. The much
 * larger VO voice-line corpus (~1600 events) is supplementary, in a collapsible
 * section that lazy-loads only when opened.
 *
 * Auditioning is lazy and shared: clicking play extracts that clip's MP3 on
 * demand (cached), and a single shared <audio> element plays at most one clip at
 * a time. The same extractor backs both gameplay clips and voice lines.
 */
export default function SoundBrowse({ heroes, heroNames, only }: SoundBrowseProps) {
    const { t } = useTranslation();
    const showGameplay = only !== 'voice';
    const showVoice = only !== 'gameplay';

    const heroOptions = useMemo(
        () =>
            heroes
                .map((h) => ({ code: h.codename, name: heroNames.get(h.codename) ?? h.codename }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [heroes, heroNames]
    );

    // `hero` is '' until the user picks; the effective hero derives the first
    // option so the tab opens with content (no synchronous default-set effect).
    const [picked, setPicked] = useState('');
    const [search, setSearch] = useState('');
    const [annotationsVisible, setAnnotationsVisible] = useState(false);
    const [annotatedOnly, setAnnotatedOnly] = useState(false);
    const hero = picked || heroOptions[0]?.code || '';
    const heroName = heroOptions.find((h) => h.code === hero)?.name ?? hero;
    const swapContext = useMemo<SwapContext>(() => ({ hero, heroName }), [hero, heroName]);

    // Gameplay-sound fetch, tagged with the hero it belongs to so loading/error
    // derive from whether it matches the current hero (the effect only sets state
    // in its async callbacks, never synchronously).
    const [data, setData] = useState<{
        hero: string;
        sounds: HeroSound[];
        error: string | null;
    } | null>(null);

    useEffect(() => {
        if (!hero || !showGameplay) return;
        let cancelled = false;
        foundryHeroSounds({ hero })
            .then((rows) => {
                if (!cancelled) setData({ hero, sounds: rows, error: null });
            })
            .catch((e) => {
                if (!cancelled)
                    setData({ hero, sounds: [], error: e instanceof Error ? e.message : String(e) });
            });
        return () => {
            cancelled = true;
        };
    }, [hero, showGameplay]);

    const ready = data?.hero === hero ? data : null;
    const loading = !!hero && !ready;
    const error = ready?.error ?? null;
    const sounds = ready?.sounds ?? NO_SOUNDS;

    // Ability slot metadata (icon + display name per slot 1-4) so the gameplay
    // view can render each ability sound group as a proper per-ability card.
    // Tagged with its hero so the effect never sets state synchronously and a
    // hero switch falls back to empty until the new fetch lands (same shape as
    // the gameplay-sound fetch above).
    const [slotData, setSlotData] = useState<{
        heroName: string;
        map: Map<number, HeroAbilitySlot>;
    } | null>(null);
    useEffect(() => {
        if (!heroName || !showGameplay) return;
        let cancelled = false;
        getHeroAbilitySlots(heroName)
            .then((slots) => {
                if (!cancelled) setSlotData({ heroName, map: new Map(slots.map((s) => [s.slot, s])) });
            })
            .catch(() => {
                if (!cancelled) setSlotData({ heroName, map: new Map() });
            });
        return () => {
            cancelled = true;
        };
    }, [heroName, showGameplay]);
    const slotMeta = slotData?.heroName === heroName ? slotData.map : NO_SLOT_META;

    const player = useClipPlayer();

    const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
    useEffect(() => {
        let cancelled = false;
        foundrySoundAnnotations()
            .then((entries) => {
                if (!cancelled) {
                    setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
                }
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const saveAnnotation = useCallback(async (key: string, name: string, note: string, tags: string[]) => {
        const saved = await saveFoundrySoundAnnotation(key, name, note, tags);
        setAnnotations((current) => {
            const next = { ...current };
            if (saved) next[key] = saved.annotation;
            else delete next[key];
            return next;
        });
    }, []);

    // Filter + group gameplay sounds by category (and, within abilities, by
    // ability name ordered by slot).
    const sections = useMemo(() => groupSounds(sounds, search, annotations, annotatedOnly), [sounds, search, annotations, annotatedOnly]);
    const totalShown = sections.reduce((n, s) => n + s.total, 0);

    return (
        <>
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-tertiary px-2 py-1.5">
                    <Users size={14} className="text-text-secondary" />
                    <select
                        value={hero}
                        onChange={(e) => setPicked(e.target.value)}
                        className="bg-transparent text-sm text-text-primary focus:outline-none"
                    >
                        {heroOptions.map((h) => (
                            <option key={h.code} value={h.code} className="bg-bg-secondary">
                                {h.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative min-w-[200px] flex-1">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('foundry.sound.searchPlaceholder', 'Search sounds...')}
                        className="w-full rounded-sm border border-border bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
                    />
                </div>
                <button type="button" aria-pressed={annotationsVisible} onClick={() => { setAnnotationsVisible((value) => !value); setAnnotatedOnly(false); }} className={`flex items-center gap-1.5 rounded-sm border px-3 py-2 text-sm ${annotationsVisible ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-secondary'}`}>
                    <Pencil size={14} /> Annotate
                </button>
                {annotationsVisible && <button type="button" aria-pressed={annotatedOnly} onClick={() => setAnnotatedOnly((value) => !value)} className={`rounded-sm border px-3 py-2 text-sm ${annotatedOnly ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-secondary'}`}>
                    Annotated only
                </button>}
            </div>

            {showGameplay &&
                (loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-text-secondary">
                        <Loader2 size={18} className="animate-spin" />
                        <Tx k="foundry.sound.loading" fallback="Reading sounds from your game files..." />
                    </div>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        variant="error"
                        title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
                        description={error}
                    />
                ) : (
                    <div className="space-y-5">
                        {sections.length === 0 ? (
                            sounds.length === 0 ? (
                                <EmptyState
                                    icon={AudioLines}
                                    title={<Tx k="foundry.sound.empty.title" fallback="No gameplay sounds" />}
                                    description={
                                        <Tx
                                            k="foundry.sound.empty.description"
                                            fallback="This hero has no gameplay sounds in your installed game files."
                                        />
                                    }
                                />
                            ) : (
                                <p className="py-10 text-center text-sm text-text-secondary">
                                    {t('foundry.sound.noMatch', 'No sounds match your search.')}
                                </p>
                            )
                        ) : (
                            <>
                                <p className="text-xs text-text-secondary">
                                    {t('foundry.sound.gameplayCount', '{{count}} gameplay sounds', {
                                        count: totalShown,
                                    })}
                                </p>
                                {sections.map((section) => (
                                    <CategorySection
                                        key={section.category}
                                        section={section}
                                        player={player}
                                        swap={swapContext}
                                        slotMeta={slotMeta}
                                        annotations={annotations}
                                        onSaveAnnotation={saveAnnotation}
                                        annotationsVisible={annotationsVisible}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                ))}

            {showVoice && (
                <VoiceLinesSection
                    key={hero}
                    hero={hero}
                    search={search}
                    player={player}
                    standalone={!showGameplay}
                    swap={swapContext}
                    annotations={annotations}
                    onSaveAnnotation={saveAnnotation}
                    annotationsVisible={annotationsVisible}
                />
            )}
        </>
    );
}

// ----- Gameplay grouping ---------------------------------------------------

interface AbilityGroup {
    ability: string;
    slot: number | null;
    rows: HeroSound[];
}

interface CategorySectionData {
    category: HeroSoundCategory;
    total: number;
    // For abilities, rows are sub-grouped by ability; for everything else the
    // single `null`-keyed group holds the flat row list.
    groups: AbilityGroup[];
}

function groupSounds(sounds: HeroSound[], search: string, annotations: Record<string, SoundAnnotation>, annotatedOnly: boolean): CategorySectionData[] {
    // Same match surface as the global tab, clip names included: every hero's
    // charged-melee pool lives in sounds/player/melee/shared/, so searching a
    // clip name is often the only way to reach the row you mean.
    const q = search.trim();
    const matches = (s: HeroSound) => {
        const annotation = annotations[foundrySoundAnnotationKey(s.event, s.vsnd[0] ?? '')];
        return (!annotatedOnly || isAnnotated(annotation)) && (matchSoundWithAnnotation([s.label, s.event, ...s.vsnd], annotation, q) !== null);
    };

    const byCategory = new Map<HeroSoundCategory, HeroSound[]>();
    for (const s of sounds) {
        if (!matches(s)) continue;
        const list = byCategory.get(s.category) ?? [];
        list.push(s);
        byCategory.set(s.category, list);
    }

    const sections: CategorySectionData[] = [];
    for (const category of CATEGORY_ORDER) {
        const rows = byCategory.get(category);
        if (!rows || rows.length === 0) continue;

        let groups: AbilityGroup[];
        if (category === 'ability') {
            const byAbility = new Map<string, AbilityGroup>();
            for (const r of rows) {
                const ability = r.ability ?? '';
                const g = byAbility.get(ability) ?? { ability, slot: r.slot, rows: [] };
                // Keep the first non-null slot seen for ordering.
                if (g.slot == null && r.slot != null) g.slot = r.slot;
                g.rows.push(r);
                byAbility.set(ability, g);
            }
            groups = [...byAbility.values()].sort(abilityOrder);
        } else {
            groups = [{ ability: '', slot: null, rows }];
        }

        sections.push({ category, total: rows.length, groups });
    }
    return sections;
}

// Slotted abilities first in slot order (1..4), then unslotted alphabetically.
function abilityOrder(a: AbilityGroup, b: AbilityGroup): number {
    if (a.slot != null && b.slot != null) return a.slot - b.slot;
    if (a.slot != null) return -1;
    if (b.slot != null) return 1;
    return a.ability.localeCompare(b.ability);
}

/** Per-ability card icon: the deadlock-api ability art, or a slot-number chip. */
function AbilitySlotIcon({ meta, slot }: { meta?: HeroAbilitySlot; slot: number | null }) {
    const [failed, setFailed] = useState(false);
    if (meta?.image && !failed) {
        return (
            <img
                src={meta.image}
                alt={meta.display}
                className="h-7 w-7 flex-shrink-0 rounded object-contain"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-bg-tertiary text-[11px] font-semibold text-text-secondary">
            {slot ?? '?'}
        </span>
    );
}

function CategorySection({
    section,
    player,
    swap,
    slotMeta,
    annotations,
    onSaveAnnotation,
    annotationsVisible,
}: {
    section: CategorySectionData;
    player: ClipPlayer;
    swap: SwapContext;
    slotMeta: Map<number, HeroAbilitySlot>;
    annotations: Record<string, SoundAnnotation>;
    onSaveAnnotation: (key: string, name: string, note: string, tags: string[]) => Promise<void>;
    annotationsVisible: boolean;
}) {
    const { t } = useTranslation();
    const Icon = CATEGORY_ICON[section.category];
    const title = t(`foundry.sound.category.${section.category}`, CATEGORY_FALLBACK[section.category]);
    const isAbility = section.category === 'ability';

    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <Icon size={14} className="text-accent" />
                {title}
                <span className="font-normal normal-case text-text-secondary/60">{section.total}</span>
            </h3>
            <div className="space-y-2">
                {section.groups.map((group) => (
                    <div key={group.ability || section.category} className="space-y-1.5">
                        {isAbility && (
                            <div className="flex items-center gap-2 px-0.5 pt-1">
                                <AbilitySlotIcon
                                    meta={group.slot != null ? slotMeta.get(group.slot) : undefined}
                                    slot={group.slot}
                                />
                                {group.slot != null && (
                                    <span className="rounded-sm bg-bg-tertiary px-1 py-0.5 text-[10px] tabular-nums text-accent">
                                        {group.slot === 4
                                            ? t('foundry.sound.ult', 'ULT')
                                            : t('foundry.sound.slot', '{{n}}', { n: group.slot })}
                                    </span>
                                )}
                                <span className="text-sm font-medium text-text-primary">
                                    {(group.slot != null ? slotMeta.get(group.slot)?.display : undefined) ||
                                        group.ability ||
                                        t('foundry.sound.unsorted', 'Other')}
                                </span>
                            </div>
                        )}
                        {group.rows.map((row) => (
                            <SoundRow
                                key={row.event}
                                label={row.label}
                                event={row.event}
                                clips={row.vsnd.length}
                                duration={row.duration}
                                state={player.stateFor(row.event)}
                                onToggle={() => player.toggle(row)}
                                poolIndex={player.poolIndexFor(row.event)}
                                swap={swap}
                                targetClip={row.vsnd[0]}
                                sourceClipPaths={row.vsnd}
                                eventSourcePath={`soundevents/hero/${row.hero}.vsndevts_c`}
                                description={describeSound(row)}
                                clipName={primaryClipName(row.vsnd)}
                                annotationKey={foundrySoundAnnotationKey(row.event, row.vsnd[0] ?? '')}
                                annotation={annotations[foundrySoundAnnotationKey(row.event, row.vsnd[0] ?? '')]}
                                onSaveAnnotation={onSaveAnnotation}
                                annotationsVisible={annotationsVisible}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}

const CATEGORY_FALLBACK: Record<HeroSoundCategory, string> = {
    ability: 'Abilities',
    weapon: 'Weapon',
    movement: 'Movement',
    melee: 'Melee',
    other: 'Other',
};

// ----- Supplementary voice lines ------------------------------------------

/**
 * The VO corpus is large (~1600 events/hero), so it's tucked into a collapsible
 * section and only fetched the first time it's opened. This component is keyed by
 * hero in the parent, so a hero switch remounts it (state + cache reset) and we
 * don't have to reconcile a stale list.
 */
function VoiceLinesSection({
    hero,
    search,
    player,
    standalone = false,
    swap,
    annotations,
    onSaveAnnotation,
    annotationsVisible,
}: {
    hero: string;
    search: string;
    player: ClipPlayer;
    /** When this is the only corpus shown (the Voice tab), open by default and
     *  drop the supplementary chrome (top border + "optional" hint). */
    standalone?: boolean;
    /** Hero context so each voice line offers a Swap (clip mode). */
    swap?: SwapContext;
    annotations: Record<string, SoundAnnotation>;
    onSaveAnnotation: (key: string, name: string, note: string, tags: string[]) => Promise<void>;
    annotationsVisible: boolean;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(standalone);
    const [data, setData] = useState<{ lines: VoiceLine[]; error: string | null } | null>(null);

    useEffect(() => {
        if (!open || !hero || data) return; // load once, on first open
        let cancelled = false;
        foundryVoicelines({ hero })
            .then((rows) => {
                if (!cancelled) setData({ lines: rows, error: null });
            })
            .catch((e) => {
                if (!cancelled)
                    setData({ lines: [], error: e instanceof Error ? e.message : String(e) });
            });
        return () => {
            cancelled = true;
        };
    }, [open, hero, data]);

    const ready = data;
    const loading = open && !ready;
    const lines = ready?.lines ?? NO_LINES;

    const visible = useMemo(() => {
        const q = search.trim();
        return lines.filter((line) => matchSoundWithAnnotation([line.label, line.event, ...line.vsnd], annotations[foundrySoundAnnotationKey(line.event, line.vsnd[0] ?? '')], q) !== null);
    }, [lines, search, annotations]);
    const shown = visible.slice(0, VO_ROW_CAP);

    return (
        <section className={standalone ? '' : 'border-t border-border pt-4'}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:text-text-primary"
            >
                <ChevronRight
                    size={14}
                    className={`text-accent transition-transform ${open ? 'rotate-90' : ''}`}
                />
                <MessageSquare size={14} className="text-accent" />
                <Tx k="foundry.sound.voiceLines.title" fallback="Voice lines" />
                {!standalone && (
                    <span className="font-normal normal-case text-text-secondary/60">
                        {t('foundry.sound.voiceLines.hint', 'optional, large list')}
                    </span>
                )}
            </button>

            {open && (
                <div className="mt-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-text-secondary">
                            <Loader2 size={16} className="animate-spin" />
                            <Tx k="foundry.sound.voiceLines.loading" fallback="Reading voice lines..." />
                        </div>
                    ) : ready?.error ? (
                        <EmptyState
                            icon={AlertTriangle}
                            variant="error"
                            title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
                            description={ready.error}
                        />
                    ) : visible.length === 0 ? (
                        <p className="py-6 text-center text-sm text-text-secondary">
                            <Tx
                                k="foundry.sound.voiceLines.empty"
                                fallback="No voice lines match your search."
                            />
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            <p className="text-xs text-text-secondary">
                                {t('foundry.sound.voiceLines.count', '{{shown}} of {{total}} voice lines', {
                                    shown: shown.length,
                                    total: visible.length,
                                })}
                            </p>
                            {shown.map((line) => (
                                <SoundRow
                                    key={line.event}
                                    label={line.label}
                                    event={line.event}
                                    clips={line.vsnd.length}
                                    duration={line.duration}
                                    state={player.stateFor(line.event)}
                                    onToggle={() => player.toggle(line)}
                                    poolIndex={player.poolIndexFor(line.event)}
                                    swap={swap}
                                    clipPaths={line.vsnd}
                                    targetClip={line.vsnd[0]}
                                    sourceClipPaths={line.vsnd}
                                    // VO rows carry a caption when the game ships
                                    // one; the label is already prose, so no
                                    // derived description is added on top.
                                    description={line.caption}
                                    clipName={primaryClipName(line.vsnd)}
                                    annotationKey={foundrySoundAnnotationKey(line.event, line.vsnd[0] ?? '')}
                                    annotation={annotations[foundrySoundAnnotationKey(line.event, line.vsnd[0] ?? '')]}
                                    onSaveAnnotation={onSaveAnnotation}
                                    annotationsVisible={annotationsVisible}
                                />
                            ))}
                            {visible.length > VO_ROW_CAP && (
                                <p className="pt-2 text-center text-xs text-text-secondary">
                                    {t(
                                        'foundry.sound.voiceLines.capped',
                                        'Showing the first {{cap}}. Refine your search to see more.',
                                        { cap: VO_ROW_CAP }
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

// ----- Row + shared audition player ---------------------------------------

interface SoundRowProps {
    label: string;
    event: string;
    clips: number;
    duration: number | null;
    state: RowState;
    onToggle: () => void;
    /** 0-based cursor into a randomizer pool: which clip the next press plays.
     *  Ignored when `clips` is 1. */
    poolIndex?: number;
    /** When present, the row offers an inline sound-swap. */
    swap?: SwapContext;
    /** First clip path of this row, used as the swap normalizer's volume target. */
    targetClip?: string;
    /** Voice-line rows pass their clip entries so the swap uses clip mode (VO has
     *  no per-hero soundevents file). Gameplay rows omit this and use event mode. */
    clipPaths?: string[];
    /** Complete source pool, including gameplay/global event pools. */
    sourceClipPaths?: string[];
    /** Exact soundevents directory entry for gameplay rows. */
    eventSourcePath?: string;
    /** Plain-English "what this actually is", from lib/soundDescribe. Null when
     *  nothing honest can be derived, in which case the row just omits it. */
    description?: string | null;
    /** Filename of the first clip in the pool. Shown because it is the identifier
     *  a modder recognizes (and can paste back into the search box). */
    clipName?: string | null;
    annotationKey?: string;
    annotation?: SoundAnnotation;
    onSaveAnnotation?: (key: string, name: string, note: string, tags: string[]) => Promise<void>;
    /** Keeps personal note controls out of the normal browse flow. */
    annotationsVisible?: boolean;
}

export function SoundRow({ label, event, clips, duration, state, onToggle, poolIndex = 0, swap, targetClip, clipPaths, sourceClipPaths, eventSourcePath, description, clipName, annotationKey, annotation, onSaveAnnotation, annotationsVisible = false }: SoundRowProps) {
    const { t } = useTranslation();
    const [swapOpen, setSwapOpen] = useState(false);
    const [annotationOpen, setAnnotationOpen] = useState(false);
    const [annotationName, setAnnotationName] = useState(annotation?.name ?? '');
    const [annotationNote, setAnnotationNote] = useState(annotation?.note ?? '');
    const [annotationTags, setAnnotationTags] = useState((annotation?.tags ?? []).join(', '));
    const [annotationBusy, setAnnotationBusy] = useState(false);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    useEffect(() => {
        setAnnotationName(annotation?.name ?? '');
        setAnnotationNote(annotation?.note ?? '');
        setAnnotationTags((annotation?.tags ?? []).join(', '));
    }, [annotation?.name, annotation?.note, annotation?.tags]);
    useEffect(() => {
        if (!annotationsVisible) setAnnotationOpen(false);
    }, [annotationsVisible]);
    const seconds = duration && duration > 0 ? `${duration.toFixed(1)}s` : null;
    // The catalog returns source `.vsnd` names, whereas VPK entries and sound
    // mod override targets are the compiled `.vsnd_c` files.
    const compiledClipName = clipName
        ? `${clipName.replace(/\.vsnd(_c)?$/i, '')}.vsnd_c`
        : null;
    // Include every member of a pool—not only the currently auditioned clip—and
    // its event container where the catalog can name one. This is an inspection
    // request only; it never changes enabled state or precedence.
    const sourcePaths = useMemo(() => {
        const paths = (sourceClipPaths ?? clipPaths ?? (targetClip ? [targetClip] : [])).map(compiledSoundEntry);
        if (eventSourcePath ?? swap?.soundeventsEntry) paths.push(eventSourcePath ?? swap!.soundeventsEntry!);
        return [...new Set(paths)];
    }, [sourceClipPaths, clipPaths, targetClip, eventSourcePath, swap]);
    // Randomizer pool: name which clip the next press auditions, so repeated
    // presses read as walking the pool rather than as a stuck button.
    const poolNote =
        clips > 1
            ? ` · ${t('foundry.sound.poolPosition', {
                  defaultValue: 'clip {{n}} of {{total}}',
                  n: (poolIndex % clips) + 1,
                  total: clips,
              })}`
            : '';
    return (
        <div style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
            <div className="flex items-center gap-3 rounded-sm border border-border bg-bg-secondary px-3 py-2">
                <button
                    type="button"
                    onClick={onToggle}
                    title={t('foundry.sound.play', 'Audition')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-accent transition-colors hover:bg-accent/15"
                >
                    {state === 'loading' ? (
                        <Loader2 size={15} className="animate-spin" />
                    ) : state === 'playing' ? (
                        <Pause size={15} />
                    ) : (
                        <Play size={15} className="translate-x-px" />
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary" title={label || event}>
                        <span className="text-text-secondary">Base-game label: </span>{label || event}
                    </p>
                    {annotationsVisible && annotation?.name && <p className="truncate text-[11px] text-accent" title={annotation.name}>My label: {annotation.name}</p>}
                    {(annotationsVisible && annotation?.note ? annotation.note : description) && (
                        <p className="truncate text-[11px] text-text-secondary" title={(annotationsVisible && annotation?.note) || description || undefined}>
                            {(annotationsVisible && annotation?.note) || description}
                        </p>
                    )}
                    {/* Engine identifiers last and dimmer: they are what you
                        search and swap by, but not what tells you what a row is. */}
                    <p
                        className="truncate text-[11px] text-text-secondary/70"
                        title={compiledClipName ? `Event: ${event}\nBase-game file: ${compiledClipName}` : `Event: ${event}`}
                    >
                        <span>Event: {event}</span>
                        {compiledClipName ? ` · Base-game file: ${compiledClipName}` : ''}
                        {poolNote}
                    </p>
                </div>
                {annotationsVisible && annotationKey && onSaveAnnotation && (
                    <button
                        type="button"
                        onClick={() => setAnnotationOpen((open) => !open)}
                        aria-expanded={annotationOpen}
                        aria-controls={`annotation-${annotationKey.replace(/[^a-z0-9]/gi, '-')}`}
                        title={t('foundry.sound.annotation.edit', 'Edit label, note, and tags')}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border transition-colors ${annotationOpen || annotation ? 'border-accent/50 bg-accent/15 text-accent' : 'border-border text-text-secondary hover:text-text-primary'}`}
                    >
                        <Pencil size={14} />
                    </button>
                )}
                {seconds && (
                    <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
                        {seconds}
                    </span>
                )}
                {sourcePaths.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSourcesOpen((open) => !open)}
                        aria-expanded={sourcesOpen}
                        title="Inspect installed VPKs that write these exact sound paths"
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors ${
                            sourcesOpen ? 'border-accent/50 bg-accent/15 text-accent' : 'border-border bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <Layers size={14} />
                        Existing sources
                    </button>
                )}
                {swap && (
                    <button
                        type="button"
                        onClick={() => setSwapOpen((o) => !o)}
                        title={t('foundry.sound.swap.button', 'Swap this sound for your own audio')}
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors ${
                            swapOpen
                                ? 'border-accent/50 bg-accent/15 text-accent'
                                : 'border-border bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <Wand2 size={14} />
                        <Tx k="foundry.sound.swap.buttonLabel" fallback="Swap" />
                    </button>
                )}
            </div>
            {swap && swapOpen && (
                <SwapPanel
                    hero={swap.hero}
                    heroName={swap.heroName}
                    soundeventsEntry={swap.soundeventsEntry}
                    event={event}
                    clipPaths={clipPaths}
                    sourceClipPaths={sourceClipPaths ?? clipPaths ?? (targetClip ? [targetClip] : [])}
                    label={label}
                    clips={clips}
                    targetClip={targetClip}
                    onClose={() => setSwapOpen(false)}
                />
            )}
            {sourcesOpen && (
                <AssetSourcesPanel paths={sourcePaths} />
            )}
            {annotationOpen && annotationKey && onSaveAnnotation && (
                <div id={`annotation-${annotationKey.replace(/[^a-z0-9]/gi, '-')}`} className="mt-1.5 rounded-sm border border-border bg-bg-tertiary/40 p-3">
                    <p className="mb-2 text-xs text-text-secondary">Personal annotations describe this base-game sound; they do not rename it.</p>
                    <div className="flex flex-wrap gap-2">
                        <input aria-label="My label" value={annotationName} onChange={(e) => setAnnotationName(e.target.value)} placeholder="My label (optional)" className="min-w-[180px] flex-1 rounded-sm border border-border bg-bg-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none" />
                        <button type="button" disabled={annotationBusy} onClick={async () => { setAnnotationBusy(true); try { await onSaveAnnotation(annotationKey, annotationName, annotationNote, annotationTags.split(',').map((tag) => tag.trim()).filter(Boolean)); setAnnotationOpen(false); } finally { setAnnotationBusy(false); } }} className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-bg-primary disabled:opacity-40"><Check size={14} />{t('common.actions.save', 'Save')}</button>
                    </div>
                    <textarea value={annotationNote} onChange={(e) => setAnnotationNote(e.target.value)} placeholder={t('foundry.sound.annotation.note', 'What this sound is, or where you found it')} rows={2} className="mt-2 w-full resize-y rounded-sm border border-border bg-bg-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none" />
                    <input aria-label="Searchable tags" value={annotationTags} onChange={(e) => setAnnotationTags(e.target.value)} placeholder="#ult, #loud, #favorite (comma-separated)" className="mt-2 w-full rounded-sm border border-border bg-bg-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none" />
                </div>
            )}
        </div>
    );
}

// ----- Sound-swap panel (drop your own MP3 onto an event) ------------------

/**
 * Inline forge for one sound event: drop or pick an MP3, name it, and build +
 * install a managed local mod that overrides every clip in the event's
 * randomizer pool (`soundswap --event --pool all`). The donor template comes
 * from the live pak, so loop/format are preserved. v1 takes MP3 only (the mint
 * path parses rate/channels from MP3 frame headers, no ffmpeg).
 */
function SwapPanel({
    hero,
    heroName,
    soundeventsEntry,
    event,
    clipPaths,
    sourceClipPaths,
    label,
    clips,
    targetClip,
    onClose,
}: {
    hero: string;
    heroName: string;
    /** Global swap: the soundevents file carrying `event` (no hero involved). */
    soundeventsEntry?: string;
    event: string;
    /** Voice-line swap: the clip entries to override in place (clip mode). When
     *  set, the swap targets these clips instead of the soundevents tree. */
    clipPaths?: string[];
    sourceClipPaths: string[];
    label: string;
    clips: number;
    /** A clip of the sound being replaced, decoded as the normalizer's loudness
     *  target in the import editor. */
    targetClip?: string;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [audioName, setAudioName] = useState('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [library, setLibrary] = useState<PoolAudio[]>([]);
    const [poolMode, setPoolMode] = useState<SoundPoolMode>('replace-all');
    const [selectedTargets, setSelectedTargets] = useState<Set<string>>(() => new Set(sourceClipPaths));
    const [poolSeed, setPoolSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
    const [conflicts, setConflicts] = useState<FoundrySoundConflictInspection | null>(null);
    const [resolution, setResolution] = useState<SoundConflictResolution['action'] | null>(null);
    // A stock clip lives under a game-build fingerprinted cache directory. Keep
    // its UI File for the editor, but never assume its path will survive until
    // Forge: a Deadlock update can prune that cache in between.
    const [usingOriginal, setUsingOriginal] = useState(false);
    const [edits, setEdits] = useState<SoundImportEdits>({});
    // Default mod name: "<Hero> <Sound>" for a hero swap, just the sound's label
    // for a global one (there is no hero to lead with).
    const defaultName = `${heroName} ${label}`.trim();
    const [name, setName] = useState(defaultName);
    const [loop, setLoop] = useState<'auto' | 'on' | 'off'>('auto');
    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const accept = useCallback(
        (file: File | undefined | null) => {
            if (!file) return;
            const path = window.electronAPI.getDroppedFilePath(file);
            if (!path) return;
            setAudioPath(path);
            setAudioName(file.name);
            setAudioFile(file);
            setLibrary([{ path, name: file.name }]);
            setUsingOriginal(false);
            setEdits({});
        },
        []
    );

    const addLibraryFiles = useCallback((files: FileList | File[]) => {
        const next = Array.from(files).flatMap((file) => {
            const path = window.electronAPI.getDroppedFilePath(file);
            return path ? [{ path, name: file.name }] : [];
        });
        if (next.length) setLibrary((current) => [...current, ...next.filter((item) => !current.some((old) => old.path === item.path))]);
    }, []);

    const assignments = useMemo(
        () => planSoundPool(poolMode, sourceClipPaths, selectedTargets, library.length ? library : (audioPath ? [{ path: audioPath, name: audioName }] : []), poolSeed),
        [poolMode, sourceClipPaths, selectedTargets, library, audioPath, audioName, poolSeed]
    );

    // "Retune the original": pull the stock clip out of the pak and load it into
    // the same editor an imported MP3 goes through. Nothing else about the swap
    // changes, so trimming or re-levelling a vanilla sound is the import flow with
    // the donor already filled in.
    const [loadingOriginal, setLoadingOriginal] = useState(false);
    const loadOriginalClip = useCallback(async () => {
        if (!targetClip || loadingOriginal) return;
        setLoadingOriginal(true);
        try {
            // Sequential on purpose. Both calls land in `ensureVoiceclipFile`,
            // which extracts to one fingerprint-keyed path; run in parallel on a
            // cold cache they both miss, and two vpkmerge processes write the
            // same MP3 at once. The first call warms the cache the second reads.
            const path = await foundryVoiceclipFile(targetClip);
            const url = path ? await foundryVoiceclip(targetClip) : null;
            if (!path || !url) {
                showToast(
                    t('foundry.sound.swap.originalUnavailable', 'Could not read the original clip.'),
                    { tone: 'error' }
                );
                return;
            }
            const blob = await (await fetch(url)).blob();
            const fileName = targetClip.split('/').pop() ?? 'original.mp3';
            setAudioPath(path);
            setAudioName(fileName);
            setAudioFile(new File([blob], fileName, { type: 'audio/mpeg' }));
            setLibrary([{ path, name: fileName }]);
            setUsingOriginal(true);
            setEdits({});
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), { tone: 'error' });
        } finally {
            setLoadingOriginal(false);
        }
    }, [targetClip, loadingOriginal, t]);

    const forge = useCallback(async () => {
        if (!audioPath || busy) return;
        const finalName = name.trim() || defaultName;
        setBusy(true);
        try {
            // Re-resolve only stock donors. Imported user files are expected to
            // remain at their selected path; a stock cache is intentionally
            // invalidated when the installed game build changes.
            const forgeAudioPath = await resolveForgeAudioPath({
                audioPath,
                usingOriginal,
                targetClip,
                resolveOriginal: foundryVoiceclipFile,
            });
            if (!forgeAudioPath) {
                throw new Error(t('foundry.sound.swap.originalUnavailable', 'Could not read the original clip.'));
            }
            if (!assignments.length) {
                throw new Error(poolMode === 'n-to-n' ? 'N-to-N needs exactly one audio file for each selected clip.' : 'Select at least one target and audio file.');
            }
            // A preflight makes the choice visible before work starts. The main
            // process repeats inspection over the *generated* VPK write-set,
            // which is authoritative (and catches event sidecars too).
            const inspection = await foundryInspectSoundConflicts(assignments.map((assignment) => compiledSoundEntry(assignment.clipPath)));
            if (inspection.unreadableMods.length || inspection.conflicts.length) {
                setConflicts(inspection);
                if (!resolution) return;
            }
            await foundrySwapSound({
                heroCodename: hero,
                heroName,
                soundeventsEntry,
                event,
                clipPaths,
                audioPath: forgeAudioPath,
                assignments: assignments.map((assignment) => ({
                    ...assignment,
                    // The active original donor may have been refreshed right
                    // before Forge; make the generated write set use it too.
                    audioPath: assignment.audioPath === audioPath ? forgeAudioPath : assignment.audioPath,
                })),
                poolMode,
                poolSeed: poolMode === 'seeded-library' ? poolSeed : undefined,
                conflictResolution: conflicts?.conflicts.length ? { action: resolution!, conflictModIds: conflicts.conflicts.map((conflict) => conflict.modId) } : undefined,
                name: finalName,
                loop,
                trimStartMs: edits.trimStartMs,
                trimEndMs: edits.trimEndMs,
                gainDb: edits.gainDb,
            });
            await useAppStore.getState().loadMods({ silent: true });
            showToast(
                t('foundry.sound.swap.done', 'Installed "{{name}}" - enable it in the Installed tab', {
                    name: finalName,
                }),
                { tone: 'success', duration: 6000 }
            );
            onClose();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), { tone: 'error', duration: 8000 });
        } finally {
            setBusy(false);
        }
    }, [
        audioPath, busy, name, defaultName, heroName, hero, soundeventsEntry,
        event, clipPaths, loop, edits, t, onClose, usingOriginal, targetClip, assignments, poolMode, poolSeed, resolution, conflicts,
    ]);

    return (
        <div className="mt-1.5 rounded-sm border border-accent/30 bg-bg-tertiary/40 p-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
                    <Tx k="foundry.sound.swap.title" fallback="Swap with your own audio" />
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-text-secondary transition-colors hover:text-text-primary"
                    title={t('common.close', 'Close')}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Drop / pick zone */}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    accept(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-sm border border-dashed px-3 py-3 text-xs transition-colors ${
                    dragOver
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
                }`}
            >
                <Upload size={14} />
                {audioName ? (
                    <span className="truncate text-text-primary" title={audioName}>
                        {audioName}
                    </span>
                ) : (
                    <Tx k="foundry.sound.swap.drop" fallback="Drop audio here, or click to pick (MP3, WAV, FLAC, M4A, OGG, and more)" />
                )}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus"
                className="hidden"
                onChange={(e) => {
                    accept(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />

            {sourceClipPaths.length > 1 && audioPath && (
                <div className="mt-2 rounded-sm border border-border bg-bg-secondary/50 p-2 text-xs text-text-secondary">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-text-primary">Pool mode</label>
                        <select value={poolMode} onChange={(e) => setPoolMode(e.target.value as SoundPoolMode)} className="rounded-sm border border-border bg-bg-secondary px-2 py-1 text-xs text-text-primary">
                            <option value="replace-all">Replace all clips</option>
                            <option value="selected-targets">Replace selected targets</option>
                            <option value="n-to-n">Map N uploaded clips to N targets</option>
                            <option value="seeded-library">Seeded user-library randomization</option>
                        </select>
                        {(poolMode === 'n-to-n' || poolMode === 'seeded-library') && (
                            <label className="cursor-pointer rounded-sm border border-border px-2 py-1 hover:text-text-primary">
                                Add audio files
                                <input type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus" multiple className="hidden" onChange={(e) => { addLibraryFiles(e.target.files ?? []); e.target.value = ''; }} />
                            </label>
                        )}
                        {poolMode === 'seeded-library' && (
                            <label className="flex items-center gap-1">Seed <input type="number" value={poolSeed} onChange={(e) => setPoolSeed(Number(e.target.value) || 1)} className="w-24 rounded-sm border border-border bg-bg-secondary px-1 py-0.5 text-text-primary" /></label>
                        )}
                    </div>
                    {poolMode !== 'replace-all' && (
                        <div className="mt-2 max-h-28 space-y-1 overflow-auto">
                            {sourceClipPaths.map((path, index) => <label key={path} className="flex items-center gap-2"><input type="checkbox" checked={selectedTargets.has(path)} onChange={(e) => setSelectedTargets((current) => { const next = new Set(current); if (e.target.checked) next.add(path); else next.delete(path); return next; })} className="accent-accent" />{index + 1}. <span className="truncate" title={path}>{path.split('/').pop()}</span></label>)}
                        </div>
                    )}
                    <p className="mt-2">{assignments.length} exact clip write{assignments.length === 1 ? '' : 's'}{poolMode === 'n-to-n' && assignments.length === 0 ? ' — add one MP3 per selected target.' : ''}</p>
                </div>
            )}
            {targetClip && (
                <button
                    type="button"
                    onClick={() => void loadOriginalClip()}
                    disabled={loadingOriginal}
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60"
                >
                    {loadingOriginal ? (
                        <Loader2 size={11} className="animate-spin" />
                    ) : (
                        <Wand2 size={11} />
                    )}
                    <Tx
                        k="foundry.sound.swap.useOriginal"
                        fallback="Or start from the original clip, and retune it"
                    />
                </button>
            )}

            {/* Trim + normalize the imported clip before forging */}
            {audioFile && (
                <SoundImportEditor
                    file={audioFile}
                    targetClipPath={targetClip}
                    onChange={setEdits}
                />
            )}

            {conflicts && <div className="mt-2 rounded-sm border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs text-text-secondary">
                <p className="font-medium text-text-primary">Resolve VPK entry-path conflicts before forging</p>
                {conflicts.unreadableMods.length > 0 && <p className="mt-1 text-red-300">Cannot safely continue: {conflicts.unreadableMods.map((mod) => mod.modName).join(', ')} could not be inspected.</p>}
                {conflicts.conflicts.map((conflict) => <p key={conflict.modId} className="mt-1 break-all">{conflict.modName} ({conflict.enabled ? 'enabled' : 'disabled'}) owns {conflict.entries.join(', ')}</p>)}
                {conflicts.conflicts.length > 0 && conflicts.unreadableMods.length === 0 && <div className="mt-2 flex flex-wrap gap-2"><select aria-label="Conflict resolution" value={resolution ?? ''} onChange={(event) => setResolution(event.target.value as SoundConflictResolution['action'])} className="rounded-sm border border-border bg-bg-secondary px-2 py-1 text-xs text-text-primary"><option value="">Choose a resolution</option><option value="disable-conflicts">Disable conflicting mods, then forge</option><option value="replace-managed" disabled={conflicts.conflicts.some((conflict) => !conflict.managed)}>Replace managed changes</option></select><button type="button" disabled={!resolution} onClick={() => void forge()} className="rounded-sm bg-accent px-2 py-1 text-xs text-bg-primary disabled:opacity-40">Confirm resolution & forge</button><button type="button" onClick={() => { setConflicts(null); setResolution(null); }} className="rounded-sm border border-border px-2 py-1 text-xs">Cancel</button></div>}
            </div>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('foundry.sound.swap.namePlaceholder', 'Mod name')}
                    className="min-w-[160px] flex-1 rounded-sm border border-border bg-bg-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
                />
                <select
                    value={loop}
                    onChange={(e) => setLoop(e.target.value as 'auto' | 'on' | 'off')}
                    title={t('foundry.sound.swap.loop', 'Loop the swapped clip')}
                    className="rounded-sm border border-border bg-bg-secondary px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                >
                    <option value="auto">{t('foundry.sound.swap.loopAuto', 'Loop: auto')}</option>
                    <option value="on">{t('foundry.sound.swap.loopOn', 'Loop: on')}</option>
                    <option value="off">{t('foundry.sound.swap.loopOff', 'Loop: off')}</option>
                </select>
                <button
                    type="button"
                    disabled={!audioPath || busy}
                    onClick={forge}
                    className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-bg-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    <Tx k="foundry.sound.swap.forge" fallback="Forge & install" />
                </button>
            </div>

            <p className="mt-2 text-[11px] text-text-secondary">
                {clips > 1
                    ? t(
                          'foundry.sound.swap.poolNote',
                          'Replaces all {{count}} clips in this sound so it always plays your audio.',
                          { count: clips }
                      )
                    : t('foundry.sound.swap.singleNote', 'Replaces this sound with your audio.')}
            </p>
        </div>
    );
}

