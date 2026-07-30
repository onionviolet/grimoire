import type { AbilitySlot, Mod } from '../types/mod';
import { canonicalHeroName, getEffectiveGlobalType } from './lockerUtils';
import { overlappingRecordedClaims, type RecordedClaimOverlap } from './recordedClaims';
import {
    CATEGORY_ORDER,
    categoryRank,
    classifyDownloadCategory,
    classifySound,
    type SoundCategory,
} from './soundVocabulary';

export { CATEGORY_ORDER };
export type { SoundCategory };

/**
 * The sound inventory: what sound content you already have, folded out of the
 * installed mod list.
 *
 * This is the read model behind the Sound Locker (docs/sound-locker-plan.md). It
 * is deliberately pure and IPC-free: everything here comes off `Mod` fields the
 * main process already projects, so the surface can render the whole inventory
 * without a single round trip, and only pays for a call when the user expands a
 * row to ask the ownership question.
 *
 * OWNERSHIP INVARIANT. Nothing in this module decides who wins a file. The
 * `paths` it reports are the exact normalized entries a mod *recorded* that it
 * writes; who actually wins them at runtime is answered by
 * `foundryInspectAssetSources`, which reads real VPK directories. A label, a
 * hero name, or a classification count is never an ownership signal.
 */

/**
 * `SoundCategory` and `CATEGORY_ORDER` are re-exported above from
 * `soundVocabulary.ts`, which owns the terms, the classification rules, and the
 * English labels for the whole app (S2). They used to be defined here, which is
 * how the Locker and Foundry's base-game catalog came to describe one domain
 * with two word lists and neither of them containing `Melee`.
 */

/** Where an entry belongs: a hero's shelf, or the Global shelf. */
export type SoundScope = 'hero' | 'global';

/**
 * How this mod got here. Same ladder as `foundrySoundConflicts.ts` uses, plus
 * `locker` for the Locker's own managed sound VPK, which that module never sees
 * because it inspects candidates rather than outputs.
 */
export type SoundProvenance = 'locker' | 'forged' | 'downloaded' | 'imported' | 'third-party';

export interface SoundInventoryEntry {
    /** Stable per (mod, hero) identity, so React keys survive a hero switch. */
    key: string;
    modId: string;
    metaKey: string;
    name: string;
    enabled: boolean;
    priority: number;
    /** Canonical hero display name, or null for a global entry. */
    hero: string | null;
    scope: SoundScope;
    /** Every category this entry covers, in display order (see CATEGORY_ORDER). */
    categories: SoundCategory[];
    /** Ability slots this entry supplies clips for under `hero`. */
    slots: AbilitySlot[];
    /** Soundevent names this entry is known to change. Empty when unrecorded:
     *  only a forged swap records its event. */
    events: string[];
    /** Exact clip entry paths this entry recorded. Empty when unrecorded, which
     *  is the common case for a downloaded VPK: the surface must then resolve
     *  them on demand rather than invent them. */
    paths: string[];
    /** Sound files attributed to this (mod, hero), or the recorded path count. */
    fileCount: number;
    provenance: SoundProvenance;
    /** True for Grimoire's own outputs (the Locker sound VPK, a Foundry build). */
    managed: boolean;
}

export interface SoundInventory {
    /** Hero entries keyed by canonical hero display name. */
    byHero: Map<string, SoundInventoryEntry[]>;
    /** Entries with no hero: announcer packs, music, UI, unknown third-party. */
    global: SoundInventoryEntry[];
    /** Every entry, hero and global, in one list. */
    all: SoundInventoryEntry[];
}

const canonicalPath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

/**
 * Category of a single recorded clip path or soundevent name.
 *
 * The rules (path tree first, then word-matching, with a reviewed override
 * table above both) live in `soundVocabulary.ts`, shared with Foundry's
 * base-game catalog. They return the reason alongside the verdict; this wrapper
 * drops it for the callers that only need to file a mod on a shelf. A surface
 * that wants to explain a classification should call `classifySound` itself.
 */
export function classifySoundToken(token: string): SoundCategory {
    return classifySound(token).category;
}

/**
 * De-duplicate and order categories, dropping `unclassified` whenever something
 * concrete is also present. `unclassified` means "nothing could be read from
 * this token", so once one token has been read, keeping it only files the mod
 * under a heading that tells the reader nothing.
 */
function sortCategories(categories: Iterable<SoundCategory>): SoundCategory[] {
    const unique = new Set(categories);
    if (unique.size > 1) unique.delete('unclassified');
    return [...unique].sort((a, b) => categoryRank(a) - categoryRank(b));
}

/**
 * Whether this mod is sound content at all. Broad on purpose: the Sound Locker
 * would rather list an unknown VPK it cannot describe than silently omit a mod
 * the user installed for its sounds. `isLockerManagedSound` is the narrower
 * hero-shelf test and is not a substitute, because it drops the global buckets
 * this surface exists to give a home to.
 */
export function isSoundContent(mod: Mod): boolean {
    if (mod.lockerSounds) return true;
    if (mod.soundSwap) return true;
    if (mod.abilitySounds && (mod.abilitySounds.abilitySoundFiles > 0 || mod.abilitySounds.voSoundFiles > 0)) {
        return true;
    }
    if (mod.sourceSection === 'Sound') return true;
    const globalType = getEffectiveGlobalType(mod);
    return globalType === 'announcer' || globalType === 'killstreak-music';
}

/**
 * The sound entries inside a VPK's raw file list.
 *
 * The read model above reports what a mod *recorded* that it writes, which for
 * a plain downloaded or imported sound mod is nothing at all. That is a gap in
 * our metadata, not a fact about the mod: its VPK directory names every file it
 * ships. `list-unknown-mod-files` already reads that directory for the Installed
 * page, so the write set is one existing call away, and a row can say what a
 * mod changes instead of explaining why it cannot.
 *
 * Still not an ownership signal (see the invariant at the top): these are the
 * entries this mod contains. Who wins them is `foundryInspectAssetSources`.
 */
export function soundEntriesInVpk(paths: readonly string[]): string[] {
    const sounds = paths.filter((path) => {
        const lower = path.toLowerCase();
        return (
            lower.endsWith('.vsnd') ||
            lower.endsWith('.vsnd_c') ||
            lower.endsWith('.vsndevts') ||
            lower.endsWith('.vsndevts_c') ||
            lower.includes('sounds/') ||
            lower.includes('soundevents/')
        );
    });
    return [...new Set(sounds.map(canonicalPath))].sort();
}

function provenanceOf(mod: Mod): SoundProvenance {
    if (mod.lockerSounds) return 'locker';
    if (mod.soundSwap || mod.foundryBuild) return 'forged';
    if (typeof mod.gameBananaId === 'number' && mod.gameBananaId > 0) return 'downloaded';
    if (mod.isUnknown) return 'third-party';
    return 'imported';
}

/** Recorded clip paths for a forged swap, normalized and de-duplicated. */
function recordedSwapPaths(mod: Mod): string[] {
    const reforge = mod.soundSwap?.reforge;
    if (!reforge) return [];
    const clips = reforge.assignments?.map((assignment) => assignment.clipPath) ?? reforge.clipPaths ?? [];
    return [...new Set(clips.map(canonicalPath))].sort();
}

/** Global category for a mod with no hero, from the signals the Locker already
 *  derives (path classification, then the GameBanana category name). */
function globalCategory(mod: Mod): SoundCategory {
    const globalType = getEffectiveGlobalType(mod);
    if (globalType === 'announcer') return 'announcer';
    if (globalType === 'killstreak-music') return 'music';
    // The download's own category name, read through the shared vocabulary's
    // weakest tier. It is the last resort on purpose: an author's label says how
    // an upload was filed, not what it changes.
    return classifyDownloadCategory(mod.categoryName).category;
}

interface HeroDraft {
    hero: string;
    categories: Set<SoundCategory>;
    slots: Set<AbilitySlot>;
    events: Set<string>;
    paths: Set<string>;
    fileCount: number;
}

function draftFor(drafts: Map<string, HeroDraft>, hero: string): HeroDraft {
    const existing = drafts.get(hero);
    if (existing) return existing;
    const draft: HeroDraft = {
        hero,
        categories: new Set(),
        slots: new Set(),
        events: new Set(),
        paths: new Set(),
        fileCount: 0,
    };
    drafts.set(hero, draft);
    return draft;
}

/**
 * Every hero this mod carries sound for, with what it carries for each.
 *
 * Three independent signals feed it and they are additive, never exclusive: the
 * VPK-tree classification (`abilitySounds.perHero`), the Locker sound VPK's own
 * manifest (`lockerSounds.sounds`), and a forged swap's recorded provenance
 * (`soundSwap`). A mod can legitimately have more than one (a forged swap that
 * was also classified), and dropping either would understate what it changes.
 */
function heroDrafts(mod: Mod): HeroDraft[] {
    const drafts = new Map<string, HeroDraft>();

    for (const contribution of mod.abilitySounds?.perHero ?? []) {
        const hero = canonicalHeroName(contribution.hero);
        if (!hero) continue;
        const draft = draftFor(drafts, hero);
        draft.fileCount += contribution.total;
        for (const [slot, count] of Object.entries(contribution.slots)) {
            if (!count) continue;
            draft.slots.add(Number(slot) as AbilitySlot);
            draft.categories.add('ability');
        }
        if (contribution.voFiles > 0) draft.categories.add('voice');
        // Files under the hero that matched no slot are still that hero's sound.
        if (contribution.unclassified > 0 && draft.categories.size === 0) draft.categories.add('unclassified');
    }

    for (const selection of mod.lockerSounds?.sounds ?? []) {
        const hero = canonicalHeroName(selection.heroName);
        if (!hero) continue;
        const draft = draftFor(drafts, hero);
        draft.slots.add(selection.slot);
        draft.categories.add('ability');
        for (const path of selection.clipPaths) draft.paths.add(canonicalPath(path));
        draft.fileCount += selection.clipPaths.length;
    }

    const swap = mod.soundSwap;
    if (swap) {
        const hero = canonicalHeroName(swap.reforge?.heroName ?? mod.lockerHero ?? '');
        const paths = recordedSwapPaths(mod);
        // A swap with no hero name is a global-sounds swap; it falls through to
        // the global bucket rather than being filed under a guessed hero.
        if (hero) {
            const draft = draftFor(drafts, hero);
            draft.events.add(swap.event);
            for (const path of paths) draft.paths.add(path);
            draft.fileCount += paths.length;
            draft.categories.add(classifySoundToken(swap.event));
            for (const path of paths) draft.categories.add(classifySoundToken(path));
        }
    }

    // An explicit hero tag with nothing else known is still a hero shelf entry:
    // the user said which hero this belongs to, and the surface should not
    // second-guess that just because the VPK tree was unreadable.
    const tagged = canonicalHeroName(mod.lockerHero ?? '');
    if (tagged && drafts.size === 0) draftFor(drafts, tagged).categories.add('unclassified');

    return [...drafts.values()];
}

/**
 * Fold installed mods into the sound inventory.
 *
 * One entry per (mod, hero) pair: a sound mod can carry files for several heroes
 * and has to appear on each of their shelves. A mod with no hero yields exactly
 * one global entry.
 *
 * Entries are sorted the way the surface reads them: enabled first, then by load
 * order (lower priority wins file conflicts), then by name, so the mod most
 * likely to be the one you hear is the one at the top.
 */
export interface SoundEvidence {
    /**
     * Sound entries read out of a mod's own VPK directory, keyed by mod id.
     *
     * A downloaded or imported sound VPK records no write set, so before this
     * existed the only evidence for a global entry was its GameBanana category
     * name: a marketing label. That is how six item-sound mods ended up on the
     * Announcer shelf. The VPK directory is the mod's own statement of what it
     * writes, and `SoundEntryRow` already reads it on demand, so supplying it
     * here just lets the classifier see what the expanded row already shows.
     *
     * Optional on purpose: this module stays pure and IPC-free, and every
     * surface works (less precisely) without it.
     */
    discoveredPaths?: Readonly<Record<string, readonly string[]>>;
}

export function buildSoundInventory(
    mods: readonly Mod[],
    evidence: SoundEvidence = {}
): SoundInventory {
    const byHero = new Map<string, SoundInventoryEntry[]>();
    const global: SoundInventoryEntry[] = [];
    const all: SoundInventoryEntry[] = [];

    for (const mod of mods) {
        if (!isSoundContent(mod)) continue;
        const provenance = provenanceOf(mod);
        const managed = Boolean(mod.lockerSounds || mod.foundryBuild || mod.soundSwap);
        const drafts = heroDrafts(mod);

        if (drafts.length === 0) {
            const recorded = recordedSwapPaths(mod);
            // Recorded first (a forged swap knows exactly what it wrote), then
            // whatever was read out of the VPK. Both are exact entries; neither
            // is a guess from a label.
            const discovered = evidence.discoveredPaths?.[mod.id] ?? [];
            const paths = recorded.length
                ? recorded
                : [...new Set(discovered.map(canonicalPath))].sort();
            const categories = new Set<SoundCategory>();
            if (mod.soundSwap) {
                categories.add(classifySoundToken(mod.soundSwap.event));
                for (const path of paths) categories.add(classifySoundToken(path));
            } else {
                for (const path of paths) categories.add(classifySoundToken(path));
                // The GameBanana category is the fallback, not the first word:
                // it describes how a download was filed, not what it changes.
                if (![...categories].some((category) => category !== 'unclassified')) {
                    categories.clear();
                    categories.add(globalCategory(mod));
                }
            }
            const entry: SoundInventoryEntry = {
                key: `${mod.id}:global`,
                modId: mod.id,
                metaKey: mod.metaKey,
                name: mod.name || mod.fileName.replace(/_dir\.vpk$/i, ''),
                enabled: mod.enabled,
                priority: mod.priority,
                hero: null,
                scope: 'global',
                categories: sortCategories(categories),
                slots: [],
                events: mod.soundSwap ? [mod.soundSwap.event] : [],
                paths,
                fileCount: paths.length,
                provenance,
                managed,
            };
            global.push(entry);
            all.push(entry);
            continue;
        }

        for (const draft of drafts) {
            const entry: SoundInventoryEntry = {
                key: `${mod.id}:${draft.hero}`,
                modId: mod.id,
                metaKey: mod.metaKey,
                name: mod.name || mod.fileName.replace(/_dir\.vpk$/i, ''),
                enabled: mod.enabled,
                priority: mod.priority,
                hero: draft.hero,
                scope: 'hero',
                categories: sortCategories(draft.categories.size ? draft.categories : ['unclassified']),
                slots: [...draft.slots].sort((a, b) => a - b),
                events: [...draft.events].sort(),
                paths: [...draft.paths].sort(),
                fileCount: draft.fileCount,
                provenance,
                managed,
            };
            const list = byHero.get(draft.hero);
            if (list) list.push(entry);
            else byHero.set(draft.hero, [entry]);
            all.push(entry);
        }
    }

    for (const list of byHero.values()) list.sort(compareEntries);
    global.sort(compareEntries);
    return { byHero, global, all };
}

function compareEntries(a: SoundInventoryEntry, b: SoundInventoryEntry): number {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.priority - b.priority || a.name.localeCompare(b.name);
}

/** Entries in `list` that cover `category`. */
export function entriesInCategory(
    list: readonly SoundInventoryEntry[],
    category: SoundCategory
): SoundInventoryEntry[] {
    return list.filter((entry) => entry.categories.includes(category));
}

/** Categories present in `list`, in display order. Unlike an entry's own
 *  category list this keeps 'other': a list whose entries are mostly readable
 *  can still contain one that is not, and that entry needs a section to sit in. */
export function categoriesPresent(list: readonly SoundInventoryEntry[]): SoundCategory[] {
    return [...new Set(list.flatMap((entry) => entry.categories))].sort(
        (a, b) => categoryRank(a) - categoryRank(b)
    );
}

/** Count of distinct mods (not entries) in a list, for hero-card counts. */
export function countMods(list: readonly SoundInventoryEntry[]): number {
    return new Set(list.map((entry) => entry.modId)).size;
}

/** Count of distinct enabled mods in a list. */
export function countEnabledMods(list: readonly SoundInventoryEntry[]): number {
    return new Set(list.filter((entry) => entry.enabled).map((entry) => entry.modId)).size;
}

/** One path claimed by more than one enabled entry, with its claimants. */
export type SoundClaimOverlap = RecordedClaimOverlap;

/**
 * Paths that more than one ENABLED entry records writing.
 *
 * The rule itself lives in `recordedClaims.ts` and is shared with the portrait
 * card picker, which asked the identical question of a different entry shape.
 * The authoritative answer, including VPKs that recorded nothing, still comes
 * from the inspected asset-claims index when a row is expanded.
 */
export function overlappingClaims(list: readonly SoundInventoryEntry[]): SoundClaimOverlap[] {
    return overlappingRecordedClaims(list);
}
