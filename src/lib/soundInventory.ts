import type { AbilitySlot, Mod } from '../types/mod';
import { canonicalHeroName, getEffectiveGlobalType } from './lockerUtils';

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

/** What kind of sound an entry changes. A single mod can cover several. */
export type SoundCategory =
    | 'ability'
    | 'voice'
    | 'weapon'
    | 'movement'
    | 'music'
    | 'announcer'
    | 'ui'
    | 'ambience'
    | 'npc'
    | 'item'
    | 'melee'
    /**
     * Nothing could be read from this mod's evidence.
     *
     * Replaces the old `shared` and `other` buckets, which were two different
     * ways of saying the same thing while sounding like content types. `shared`
     * in particular was an implementation leak: it meant "the path contained the
     * word shared", which is true of every player melee sound in the game.
     *
     * This is a work queue, not a shelf: an entry here is a classification the
     * app owes the user, and it should be possible to act on it.
     */
    | 'unclassified';

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

/** Display order for categories, most reached-for first. */
export const CATEGORY_ORDER: readonly SoundCategory[] = [
    'ability',
    'voice',
    'weapon',
    'movement',
    'announcer',
    'music',
    'ui',
    'ambience',
    'npc',
    'item',
    'melee',
    // Always last: it is the queue of things the app could not read, and it
    // should never sit above a category that says something.
    'unclassified',
];

const CATEGORY_RANK = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));

const canonicalPath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

/**
 * Where the game itself puts each kind of sound.
 *
 * These run before any word-matching, because the tree is real evidence and a
 * word in a filename is a hint. Two cases in the installed corpus prove why the
 * order matters:
 *
 *  - `sounds/music/menu/shop/bau_01.vsnd_c` is a music pack. Word-matching sees
 *    `menu` and `shop` and files it under Interface or Items.
 *  - `sounds/player/melee/shared/charged_melee_full.vsnd_c` is melee. Word
 *    matching saw `shared` and invented a whole category for it, which is the
 *    entire "Shared / Shared melee" defect.
 *
 * `sounds/mods/...` is not user mods: `mods` is the game's own word for item
 * modifiers, so `sounds/mods/tech/refresher/refresher_cast.vsnd_c` is the
 * Refresher item. That one rule is what moves six mods off the Announcer shelf.
 */
const PATH_RULES: ReadonlyArray<readonly [RegExp, SoundCategory]> = [
    [/(^|\/)sounds\/vo\//, 'voice'],
    [/(^|\/)soundevents\/vo[/.]/, 'voice'],
    [/(^|\/)sounds\/player\/melee\//, 'melee'],
    // Item modifiers, both the clips and the soundevent manifests beside them.
    [/(^|\/)sounds\/mods\//, 'item'],
    [/(^|\/)soundevents\/mods[/.]/, 'item'],
    [/(^|\/)sounds\/items?\//, 'item'],
    [/(^|\/)sounds\/npc\//, 'npc'],
    [/(^|\/)soundevents\/npc[/.]/, 'npc'],
    [/(^|\/)sounds\/music\//, 'music'],
    [/(^|\/)soundevents\/music[/.]/, 'music'],
    [/(^|\/)sounds\/ui\//, 'ui'],
    [/(^|\/)soundevents\/ui[/.]/, 'ui'],
    [/(^|\/)sounds\/announcer\//, 'announcer'],
    [/(^|\/)sounds\/abilities\//, 'ability'],
    [/(^|\/)sounds\/weapons?\//, 'weapon'],
    [/(^|\/)sounds\/ambient\//, 'ambience'],
];

/**
 * Reviewed exceptions, keyed on evidence the rules genuinely cannot read.
 *
 * Deliberately empty right now: every case in the installed corpus is handled
 * by a rule, and an override table that starts full is a rule set that gave up
 * early. It exists so the next unreadable case has an honest home instead of
 * becoming a special case bolted into `classifySoundToken`, where it would look
 * like a general rule and quietly mis-file everything that resembles it.
 *
 * Two conditions for adding an entry: the key must be an exact normalized entry
 * path or soundevent name (never a download title, which the author controls),
 * and the reason must be written down. If two entries want the same reason, that
 * is a rule, not an override.
 */
const CLASSIFICATION_OVERRIDES: ReadonlyMap<string, { category: SoundCategory; reason: string }> =
    new Map<string, { category: SoundCategory; reason: string }>();

/**
 * Category of a single recorded clip path or soundevent name.
 *
 * Three tiers, in this order: a reviewed override, where the file lives, then
 * what it is called. A token that reads as nothing concrete returns
 * `unclassified` rather than a vague bucket, because "we could not tell" is a
 * fact worth showing and a wrong category files a mod under a heading it has
 * nothing to do with.
 */
export function classifySoundToken(token: string): SoundCategory {
    const value = token.replace(/\\/g, '/').toLowerCase();
    const override = CLASSIFICATION_OVERRIDES.get(value);
    if (override) return override.category;
    for (const [pattern, category] of PATH_RULES) {
        if (pattern.test(value)) return category;
    }
    if (/(^|[/.])vo([/.]|$)|voice|_vo_/.test(value)) return 'voice';
    // Melee before weapon: a charged melee is not a gun, and before the old
    // shared/generic rule, which used to swallow the whole player melee tree.
    if (/melee|punch|parry|swing|riposte/.test(value)) return 'melee';
    if (/weapon|\bgun\b|shoot|reload|bullet|muzzle/.test(value)) return 'weapon';
    if (/footstep|footsteps|movement|dash|jump|land(ing)?\b|slide/.test(value)) return 'movement';
    if (/abilit(y|ies)|\bcast\b|\bult\b|ultimate/.test(value)) return 'ability';
    if (/announcer/.test(value)) return 'announcer';
    if (/music|stinger|killstreak/.test(value)) return 'music';
    if (/(^|[/.])ui([/.]|$)|panorama|menu|hud/.test(value)) return 'ui';
    if (/ambience|ambient/.test(value)) return 'ambience';
    // Deadlock's neutral camps and lane creeps, by the names the files use.
    if (/npc|creep|neutral|trooper|sinner|breed|vault|guardian|walker|patron|midboss/.test(value)) {
        return 'npc';
    }
    if (/item|pickup|shop/.test(value)) return 'item';
    return 'unclassified';
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
    return [...unique].sort((a, b) => (CATEGORY_RANK.get(a) ?? 99) - (CATEGORY_RANK.get(b) ?? 99));
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
    const category = mod.categoryName?.trim().toLowerCase() ?? '';
    if (category.includes('music')) return 'music';
    if (category.includes('announcer')) return 'announcer';
    if (category === 'ui' || category === 'ui sounds') return 'ui';
    if (category.includes('ambience') || category.includes('ambient')) return 'ambience';
    if (category.includes('npc') || category.includes('creep')) return 'npc';
    if (category.includes('item')) return 'item';
    if (category.includes('melee')) return 'melee';
    // A kill sound in this game is a creep/trooper kill: NPC content, not a
    // nameless bucket. Weak evidence though, so any real path beats it.
    if (category.includes('killsound')) return 'npc';
    // `shared` and `generic` used to become a category of their own here. They
    // describe how the author labelled a download, not what it changes.
    return 'unclassified';
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
        (a, b) => (CATEGORY_RANK.get(a) ?? 99) - (CATEGORY_RANK.get(b) ?? 99)
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
export interface SoundClaimOverlap {
    path: string;
    /** Entry keys claiming the path, in the list's own order. */
    entryKeys: string[];
}

/**
 * Paths that more than one ENABLED entry records writing.
 *
 * This is the cheap, local half of the "only one mod should own an event" rule:
 * it uses only what the entries already recorded, so it can never report an
 * overlap between two mods whose write sets are unknown. The authoritative
 * answer, including unrecorded VPKs, still comes from
 * `foundryInspectAssetSources` when a row is expanded. Reporting less here than
 * the inspector would is the intended failure direction: a missed warning sends
 * the user to the inspector, an invented one sends them chasing nothing.
 */
export function overlappingClaims(list: readonly SoundInventoryEntry[]): SoundClaimOverlap[] {
    const byPath = new Map<string, string[]>();
    for (const entry of list) {
        if (!entry.enabled) continue;
        for (const path of new Set(entry.paths)) {
            const claimants = byPath.get(path);
            if (claimants) claimants.push(entry.key);
            else byPath.set(path, [entry.key]);
        }
    }
    return [...byPath.entries()]
        .filter(([, entryKeys]) => entryKeys.length > 1)
        .map(([path, entryKeys]) => ({ path, entryKeys }))
        .sort((a, b) => a.path.localeCompare(b.path));
}
