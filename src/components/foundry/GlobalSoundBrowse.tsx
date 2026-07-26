import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../common/PageComponents';
import Tx from '../translation/Tx';
import { SoundRow, type SwapContext } from './SoundBrowse';
import { useClipPlayer, type ClipPlayer } from './useClipPlayer';
import { foundryGlobalSounds } from '../../lib/api';
import type { GlobalSound, GlobalSoundCategory } from '../../types/foundry';

// Display order: what a modder reaches for first (UI clicks, music) leads, then
// the world layers, then the odds-and-ends bucket.
const CATEGORY_ORDER: GlobalSoundCategory[] = [
    'ui',
    'music',
    'item',
    'gameplay',
    'npc',
    'ambience',
    'voice',
    'other',
];

const CATEGORY_ICON: Record<GlobalSoundCategory, typeof AudioLines> = {
    ui: MousePointerClick,
    music: Music,
    item: ShoppingBag,
    gameplay: Swords,
    npc: Skull,
    ambience: Trees,
    voice: MessageSquare,
    other: AudioLines,
};

const CATEGORY_FALLBACK: Record<GlobalSoundCategory, string> = {
    ui: 'Interface',
    music: 'Music',
    item: 'Shop items',
    gameplay: 'Gameplay',
    npc: 'NPCs',
    ambience: 'Ambience',
    voice: 'Voice',
    other: 'Other',
};

// The whole index is ~1100 rows, small enough to fetch once and filter in the
// renderer (no per-keystroke round trip to the engine).
const NO_SOUNDS: GlobalSound[] = [];

interface Section {
    category: GlobalSoundCategory;
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
export default function GlobalSoundBrowse() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<GlobalSoundCategory | 'all'>('all');
    const [data, setData] = useState<{ sounds: GlobalSound[]; error: string | null } | null>(null);

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
    const sections = useMemo(() => groupSounds(sounds, search, category), [sounds, search, category]);
    const totalShown = sections.reduce((n, s) => n + s.total, 0);

    // Only offer the categories the installed pak actually carries, so a game
    // update that drops a tree doesn't leave a dead filter chip behind.
    const present = useMemo(() => {
        const seen = new Set(sounds.map((s) => s.category));
        return CATEGORY_ORDER.filter((c) => seen.has(c));
    }, [sounds]);

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
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t(
                            'foundry.globalSound.searchPlaceholder',
                            'Search UI, music, ambience, NPC and item sounds...'
                        )}
                        className="w-full rounded-sm border border-border bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
                    />
                </div>
            </div>

            {present.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                        active={category === 'all'}
                        onClick={() => setCategory('all')}
                        label={t('foundry.globalSound.category.all', 'All')}
                    />
                    {present.map((c) => (
                        <FilterChip
                            key={c}
                            active={category === c}
                            onClick={() => setCategory(c)}
                            icon={CATEGORY_ICON[c]}
                            label={t(`foundry.globalSound.category.${c}`, CATEGORY_FALLBACK[c])}
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
                        <CategorySection key={section.category} section={section} player={player} />
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

function CategorySection({ section, player }: { section: Section; player: ClipPlayer }) {
    const { t } = useTranslation();
    const Icon = CATEGORY_ICON[section.category];
    const title = t(
        `foundry.globalSound.category.${section.category}`,
        CATEGORY_FALLBACK[section.category]
    );

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
                                swap={swapContextFor(row)}
                                targetClip={row.vsnd[0]}
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

function groupSounds(
    sounds: GlobalSound[],
    search: string,
    category: GlobalSoundCategory | 'all'
): Section[] {
    const q = search.trim().toLowerCase();
    const matches = (s: GlobalSound) =>
        (category === 'all' || s.category === category) &&
        (!q ||
            s.label.toLowerCase().includes(q) ||
            s.event.toLowerCase().includes(q) ||
            s.source.toLowerCase().includes(q));

    const byCategory = new Map<GlobalSoundCategory, Map<string, GlobalSound[]>>();
    for (const s of sounds) {
        if (!matches(s)) continue;
        let sources = byCategory.get(s.category);
        if (!sources) {
            sources = new Map();
            byCategory.set(s.category, sources);
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
