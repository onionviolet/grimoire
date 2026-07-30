import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Search,
    Loader2,
    AlertTriangle,
    AudioLines,
    MousePointerClick,
    Music,
    Trees,
    Skull,
    ShoppingBag,
    Swords,
    MessageSquare,
    Download,
    Upload,
    Pencil,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/PageComponents';
import Tx from '../translation/Tx';
import { SoundRow, type SwapContext } from './SoundBrowse';
import { useClipPlayer, type ClipPlayer } from './useClipPlayer';
import { foundryGlobalSounds, foundrySoundAnnotations, foundrySoundAnnotationKey, saveFoundrySoundAnnotation, exportFoundrySoundAnnotations, importFoundrySoundAnnotations } from '../../lib/api';
import { showToast } from '../../stores/toastStore';
import { describeSound, primaryClipName } from '../../lib/soundDescribe';
import { isAnnotated, matchSoundWithAnnotation } from '../../lib/soundAnnotationSearch';
import type { GlobalSound, SoundAnnotation } from '../../types/foundry';
import { soundCategoryFromCatalog, type SoundCategory } from '../../lib/soundInventory';
import { globalSoundSectionLabel } from '../../lib/globalSoundSections';
import type { FoundryStagedSoundEdit } from './soundStagedEdit';

// One vocabulary across surfaces, now literally: these are the Locker's own
// SoundCategory values, labelled from the Locker's own keys. A user who learns
// "Items" or "Melee" on the Global shelf finds the same word here.
//
// The catalog engine still groups the base game's ~1100 sounds its own way
// (`gameplay` is a bag holding weapon, ability, movement and melee, `other` is
// a shrug). soundCategoryFromCatalog reads the clip paths first and only falls
// back to those families, which is what finally gives this surface the Melee
// group it could not have while the engine's grouping was the axis.
//
// Display order: what a modder reaches for first (UI clicks, music) leads, then
// the world layers, then the work queue.
const CATEGORY_ORDER: SoundCategory[] = [
    'ui',
    'music',
    'item',
    'melee',
    'weapon',
    'ability',
    'movement',
    'npc',
    'ambience',
    'voice',
    'announcer',
    'unclassified',
];

const CATEGORY_ICON: Record<SoundCategory, typeof AudioLines> = {
    ui: MousePointerClick,
    music: Music,
    item: ShoppingBag,
    melee: Swords,
    weapon: Swords,
    ability: Swords,
    movement: Swords,
    npc: Skull,
    ambience: Trees,
    voice: MessageSquare,
    announcer: MessageSquare,
    unclassified: AudioLines,
};

// The whole index is ~1100 rows, small enough to fetch once and filter in the
// renderer (no per-keystroke round trip to the engine).
const NO_SOUNDS: GlobalSound[] = [];

interface Section {
    category: SoundCategory;
    total: number;
    /** Rows grouped by their source file (`ui`, `npc/troopers`), so a section
     *  spanning several files stays legible. */
    groups: { source: string; rows: GlobalSound[] }[];
}

/**
 * The Global Sound sub-tool: browse and swap every sound that is NOT a hero's.
 * UI clicks, music, ambience, NPCs, shop items, and match gameplay, read from
 * every soundevents file outside the hero and VO trees via `catalog globalsounds`.
 *
 * The hero Sound tab covers `soundevents/hero/` + the VO tree; this is the rest
 * of the game's audible surface. Rows share that tab's row, audition player, and
 * swap panel, with the swap carrying the event's soundevents file (there is no
 * hero to resolve it from), so the built mod lands in the Locker's global Sounds
 * bucket rather than under a hero.
 */
export default function GlobalSoundBrowse({
    initialCategory = 'all',
    onStage,
}: {
    initialCategory?: SoundCategory | 'all';
    onStage?: (edit: FoundryStagedSoundEdit) => void;
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<SoundCategory | 'all'>(initialCategory);
    const [annotationsVisible, setAnnotationsVisible] = useState(false);
    const [annotatedOnly, setAnnotatedOnly] = useState(false);
    const [selectedRow, setSelectedRow] = useState<string | null>(null);
    const [data, setData] = useState<{ sounds: GlobalSound[]; error: string | null } | null>(null);
    const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
    const importRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        foundrySoundAnnotations()
            .then((entries) => {
                if (!cancelled) setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const saveAnnotation = async (key: string, name: string, note: string, tags: string[]) => {
        const saved = await saveFoundrySoundAnnotation(key, name, note, tags);
        setAnnotations((current) => {
            const next = { ...current };
            if (saved) next[key] = saved.annotation;
            else delete next[key];
            return next;
        });
    };

    const exportAnnotations = async () => {
        const blob = new Blob([await exportFoundrySoundAnnotations()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'grimoire-sound-annotations.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const importAnnotations = async (file: File | undefined) => {
        if (!file) return;
        try {
            const entries = await importFoundrySoundAnnotations(await file.text());
            setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
            showToast('Sound annotations imported.', { tone: 'success' });
        } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), { tone: 'error' });
        }
    };

    useEffect(() => {
        let cancelled = false;
        foundryGlobalSounds()
            .then((rows) => {
                if (!cancelled) setData({ sounds: rows, error: null });
            })
            .catch((e) => {
                if (!cancelled)
                    setData({ sounds: [], error: e instanceof Error ? e.message : String(e) });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const loading = !data;
    const error = data?.error ?? null;
    const sounds = data?.sounds ?? NO_SOUNDS;

    const player = useClipPlayer();
    // Classify once for the whole catalog, not per filter keystroke: the row's
    // category is a property of the sound, and recomputing it inside the filter
    // would make typing O(1100 x rules).
    const classified = useMemo(() => {
        const map = new Map<string, SoundCategory>();
        for (const sound of sounds) {
            map.set(rowKey(sound), soundCategoryFromCatalog(sound).category);
        }
        return map;
    }, [sounds]);
    const sections = useMemo(
        () => groupSounds(sounds, classified, search, category, annotations, annotatedOnly),
        [sounds, classified, search, category, annotations, annotatedOnly]
    );
    const totalShown = sections.reduce((n, s) => n + s.total, 0);

    // Only offer the categories the installed pak actually carries, so a game
    // update that drops a tree doesn't leave a dead filter chip behind.
    const present = useMemo(() => {
        const seen = new Set(classified.values());
        return CATEGORY_ORDER.filter((c) => seen.has(c));
    }, [classified]);

    return (
        <>
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelectedRow(null); }}
                        placeholder={t(
                            'foundry.globalSound.searchPlaceholder',
                            'Search UI, music, ambience, NPC and item sounds...'
                        )}
                        className="w-full rounded-sm border border-border bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <button type="button" aria-pressed={annotationsVisible} onClick={() => { setAnnotationsVisible((value) => !value); setAnnotatedOnly(false); setSelectedRow(null); }} className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs ${annotationsVisible ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-secondary'}`}><Pencil size={13} />Annotate</button>
                    {annotationsVisible && <>
                        <button type="button" aria-pressed={annotatedOnly} onClick={() => { setAnnotatedOnly((value) => !value); setSelectedRow(null); }} className={`rounded-sm border px-2 py-1.5 text-xs ${annotatedOnly ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-secondary'}`}>Annotated only</button>
                        <button type="button" onClick={exportAnnotations} className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary" title="Export your sound names and notes"><Download size={13} />Export notes</button>
                        <button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary" title="Import sound names and notes"><Upload size={13} />Import notes</button>
                        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importAnnotations(event.target.files?.[0]); event.target.value = ''; }} />
                    </>}
                </div>
            </div>

            {present.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                        active={category === 'all'}
                        onClick={() => { setCategory('all'); setSelectedRow(null); }}
                        label={t('foundry.globalSound.category.all', 'All')}
                    />
                    {present.map((c) => (
                        <FilterChip
                            key={c}
                            active={category === c}
                            onClick={() => { setCategory(c); setSelectedRow(null); }}
                            icon={CATEGORY_ICON[c]}
                            label={globalSoundSectionLabel(t, c)}
                        />
                    ))}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-text-secondary">
                    <Loader2 size={18} className="animate-spin" />
                    <Tx
                        k="foundry.globalSound.loading"
                        fallback="Reading sounds from your game files..."
                    />
                </div>
            ) : error ? (
                <EmptyState
                    icon={AlertTriangle}
                    variant="error"
                    title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
                    description={error}
                />
            ) : sections.length === 0 ? (
                sounds.length === 0 ? (
                    <EmptyState
                        icon={AudioLines}
                        title={
                            <Tx k="foundry.globalSound.empty.title" fallback="No global sounds" />
                        }
                        description={
                            <Tx
                                k="foundry.globalSound.empty.description"
                                fallback="Your installed game files carry no non-hero soundevents."
                            />
                        }
                    />
                ) : (
                    <p className="py-10 text-center text-sm text-text-secondary">
                        {t('foundry.globalSound.noMatch', 'No sounds match your search.')}
                    </p>
                )
            ) : (
                <div className="space-y-5">
                    <p className="text-xs text-text-secondary">
                        {t('foundry.globalSound.count', '{{count}} sounds', { count: totalShown })}
                    </p>
                    {sections.map((section) => (
                        <CategorySection key={section.category} section={section} player={player} annotations={annotations} onSaveAnnotation={saveAnnotation} annotationsVisible={annotationsVisible} onStage={onStage} selectedRow={selectedRow} onSelectRow={setSelectedRow} />
                    ))}
                </div>
            )}
        </>
    );
}

function FilterChip({
    active,
    onClick,
    label,
    icon: Icon,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: typeof AudioLines;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors ${
                active
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
        >
            {Icon && <Icon size={13} />}
            {label}
        </button>
    );
}

function CategorySection({ section, player, annotations, onSaveAnnotation, annotationsVisible, onStage, selectedRow, onSelectRow }: { section: Section; player: ClipPlayer; annotations: Record<string, SoundAnnotation>; onSaveAnnotation: (key: string, name: string, note: string, tags: string[]) => Promise<void>; annotationsVisible: boolean; onStage?: (edit: FoundryStagedSoundEdit) => void; selectedRow: string | null; onSelectRow: (key: string) => void }) {
    const { t } = useTranslation();
    const Icon = CATEGORY_ICON[section.category];
    const title = globalSoundSectionLabel(t, section.category);

    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <Icon size={14} className="text-accent" />
                {title}
                <span className="font-normal normal-case text-text-secondary/60">
                    {section.total}
                </span>
            </h3>
            <div className="space-y-2">
                {section.groups.map((group) => (
                    <div key={group.source} className="space-y-1.5">
                        {/* Only label the file when the section spans several, so a
                            single-file section (Interface) isn't noisy. */}
                        {section.groups.length > 1 && (
                            <p className="px-0.5 pt-1 text-[11px] text-text-secondary/70">
                                {group.source}
                            </p>
                        )}
                        {group.rows.map((row) => (
                            <SoundRow
                                key={`${row.soundevents}:${row.event}`}
                                label={row.label}
                                event={row.event}
                                clips={row.vsnd.length}
                                duration={row.duration}
                                state={player.stateFor(row.event)}
                                onToggle={() => player.toggle(row)}
                                poolIndex={player.poolIndexFor(row.event)}
                                swap={swapContextFor(row)}
                                targetClip={row.vsnd[0]}
                                sourceClipPaths={row.vsnd}
                                description={describeSound(row)}
                                clipName={primaryClipName(row.vsnd)}
                                annotationKey={foundrySoundAnnotationKey(row.event, row.vsnd[0] ?? '')}
                                annotation={annotations[foundrySoundAnnotationKey(row.event, row.vsnd[0] ?? '')]}
                                onSaveAnnotation={onSaveAnnotation}
                                annotationsVisible={annotationsVisible}
                                onStage={onStage}
                                selected={selectedRow === `${row.soundevents}:${row.event}`}
                                onSelect={() => onSelectRow(`${row.soundevents}:${row.event}`)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}

/** A global row swaps by event + its soundevents file; there is no hero, so the
 *  hero fields stay empty and the installed mod is left untagged. */
function swapContextFor(row: GlobalSound): SwapContext {
    return { hero: '', heroName: '', soundeventsEntry: row.soundevents };
}

/** Stable per-row identity: an event name repeats across soundevents files. */
function rowKey(sound: GlobalSound): string {
    return `${sound.soundevents}:${sound.event}`;
}

function groupSounds(
    sounds: GlobalSound[],
    classified: ReadonlyMap<string, SoundCategory>,
    search: string,
    category: SoundCategory | 'all',
    annotations: Record<string, SoundAnnotation>,
    annotatedOnly: boolean
): Section[] {
    // Clip filenames and paths are part of the match surface, not just the
    // event/label/source triple. A modder holds a clip name (`charged_melee_full`)
    // far more often than an event name, and pasting one used to return nothing.
    // See lib/soundDescribe.ts for why, and its test for the pinned case.
    const q = search.trim();
    const categoryOf = (s: GlobalSound): SoundCategory => classified.get(rowKey(s)) ?? 'unclassified';
    const matches = (s: GlobalSound) => {
        const annotation = annotations[foundrySoundAnnotationKey(s.event, s.vsnd[0] ?? '')];
        return (category === 'all' || categoryOf(s) === category) && (!annotatedOnly || isAnnotated(annotation))
            && matchSoundWithAnnotation([s.label, s.event, s.source, ...s.vsnd], annotation, q) !== null;
    };

    const byCategory = new Map<SoundCategory, Map<string, GlobalSound[]>>();
    for (const s of sounds) {
        if (!matches(s)) continue;
        const own = categoryOf(s);
        let sources = byCategory.get(own);
        if (!sources) {
            sources = new Map();
            byCategory.set(own, sources);
        }
        const rows = sources.get(s.source);
        if (rows) rows.push(s);
        else sources.set(s.source, [s]);
    }

    return CATEGORY_ORDER.flatMap((c) => {
        const sources = byCategory.get(c);
        if (!sources) return [];
        const groups = [...sources.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([source, rows]) => ({ source, rows }));
        const total = groups.reduce((n, g) => n + g.rows.length, 0);
        return [{ category: c, total, groups }];
    });
}
