/**
 * One sound vocabulary, and one classifier that says why.
 *
 * Structural cause S2. Three vocabularies described one domain: the GameBanana
 * category a download was filed under, the Locker's `SoundCategory`, and the
 * base-game catalog's path-prefix groups. `Melee` existed in none of them,
 * which is how every player melee sound in the game ended up in a category
 * called `Shared` (the classifier had seen the word `shared` in the path).
 *
 * Two rules this module exists to enforce:
 *
 *  1. **One set of terms.** A user who learns "Items" on the Locker's global
 *     shelf must find the same word in Foundry's base-game catalog. The labels
 *     come from one table here, so they cannot be spelled differently in two
 *     components.
 *  2. **Every answer carries its reason.** `classifySound` returns the rule
 *     that fired, not just the verdict. A category with no traceable reason is
 *     how a marketing title got to decide what a mod changes; a surface that
 *     can print "because it writes under sounds/mods/" can be argued with.
 *
 * The base-game catalog maps into these same terms and may refine them from
 * the clip paths it already carries: see `refineCatalogTerm`.
 */

/** What kind of sound this is. A single mod can cover several. */
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

/**
 * Coarse terms that only the base-game catalog uses.
 *
 * They are part of the same vocabulary, not a second one, but the installed-mod
 * classifier never returns them: they describe how Valve grouped 1100 shipped
 * events, not what a mod changes. `catalogOther` is deliberately distinct from
 * `unclassified` because they mean different things. `unclassified` is a work
 * queue ("we could not read this"); `catalogOther` is the base game's own
 * residue, which is nobody's to fix.
 */
export type CatalogCoarseTerm = 'gameplay' | 'catalogOther';

/** Any term the vocabulary can present. */
export type SoundTerm = SoundCategory | CatalogCoarseTerm;

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

/** Rank for sorting. Unknown terms sort last rather than throwing. */
export function categoryRank(category: SoundCategory): number {
    return CATEGORY_RANK.get(category) ?? 99;
}

/**
 * English labels for every term, in one table.
 *
 * These are fallbacks: the i18n catalog is the source of truth for displayed
 * text. They live together anyway so a new surface cannot invent "Item sounds"
 * where two others already say "Items". Key namespaces still differ per surface
 * (`soundLocker.category.*`, `foundry.globalSound.category.*`) because those
 * strings are already translated; the English wording is what is shared.
 */
export const SOUND_TERM_LABEL: Readonly<Record<SoundTerm, string>> = {
    ability: 'Abilities',
    voice: 'Voice',
    weapon: 'Weapon',
    movement: 'Movement',
    announcer: 'Announcer',
    music: 'Music',
    ui: 'Interface',
    ambience: 'Ambience',
    npc: 'NPC',
    item: 'Items',
    melee: 'Melee',
    unclassified: 'Needs classification',
    gameplay: 'Gameplay',
    catalogOther: 'Other',
};

/** The shared English label for a term. */
export function soundTermLabel(term: SoundTerm): string {
    return SOUND_TERM_LABEL[term] ?? term;
}

/**
 * Why a classification came out the way it did.
 *
 * `rule` is the mechanism (which is what a maintainer needs) and `evidence` is
 * the exact string it fired on (which is what a user needs). Together they are
 * enough to either agree with the answer or file a good bug about it.
 */
export interface SoundClassification {
    category: SoundCategory;
    rule:
        /** A reviewed exception keyed on an exact path or soundevent name. */
        | 'override'
        /** Where the game itself puts this kind of sound. */
        | 'path'
        /** A word in the path or event name, once the tree said nothing. */
        | 'name'
        /** The GameBanana category the author filed the download under. */
        | 'downloadCategory'
        /** Nothing readable at all. */
        | 'none';
    /** The exact token, pattern source, or label the rule matched on. */
    evidence: string;
}

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

/** Word-matching, consulted only after the tree has said nothing. Ordered:
 *  melee before weapon (a charged melee is not a gun). */
const NAME_RULES: ReadonlyArray<readonly [RegExp, SoundCategory]> = [
    [/(^|[/.])vo([/.]|$)|voice|_vo_/, 'voice'],
    [/melee|punch|parry|swing|riposte/, 'melee'],
    [/weapon|\bgun\b|shoot|reload|bullet|muzzle/, 'weapon'],
    [/footstep|footsteps|movement|dash|jump|land(ing)?\b|slide/, 'movement'],
    [/abilit(y|ies)|\bcast\b|\bult\b|ultimate/, 'ability'],
    [/announcer/, 'announcer'],
    [/music|stinger|killstreak/, 'music'],
    [/(^|[/.])ui([/.]|$)|panorama|menu|hud/, 'ui'],
    [/ambience|ambient/, 'ambience'],
    // Deadlock's neutral camps and lane creeps, by the names the files use.
    [/npc|creep|neutral|trooper|sinner|breed|vault|guardian|walker|patron|midboss/, 'npc'],
    [/item|pickup|shop/, 'item'],
];

/**
 * Reviewed exceptions, keyed on evidence the rules genuinely cannot read.
 *
 * Deliberately empty right now: every case in the installed corpus is handled
 * by a rule, and an override table that starts full is a rule set that gave up
 * early. It exists so the next unreadable case has an honest home instead of
 * becoming a special case bolted into the classifier, where it would look like
 * a general rule and quietly mis-file everything that resembles it.
 *
 * Two conditions for adding an entry: the key must be an exact normalized entry
 * path or soundevent name (never a download title, which the author controls),
 * and the reason must be written down. If two entries want the same reason, that
 * is a rule, not an override.
 */
const CLASSIFICATION_OVERRIDES: ReadonlyMap<string, { category: SoundCategory; reason: string }> =
    new Map<string, { category: SoundCategory; reason: string }>();

/**
 * Classify one recorded clip path or soundevent name, with the reason.
 *
 * Three tiers, in this order: a reviewed override, where the file lives, then
 * what it is called. A token that reads as nothing concrete returns
 * `unclassified` rather than a vague bucket, because "we could not tell" is a
 * fact worth showing and a wrong category files a mod under a heading it has
 * nothing to do with.
 */
export function classifySound(token: string): SoundClassification {
    const value = token.replace(/\\/g, '/').toLowerCase();
    const override = CLASSIFICATION_OVERRIDES.get(value);
    if (override) return { category: override.category, rule: 'override', evidence: value };
    for (const [pattern, category] of PATH_RULES) {
        if (pattern.test(value)) return { category, rule: 'path', evidence: pattern.source };
    }
    for (const [pattern, category] of NAME_RULES) {
        if (pattern.test(value)) return { category, rule: 'name', evidence: pattern.source };
    }
    return { category: 'unclassified', rule: 'none', evidence: value };
}

/**
 * Classify from the GameBanana category a download was filed under.
 *
 * The weakest evidence there is, and it must stay the last resort: it describes
 * how an author labelled an upload, not what the upload changes. Six item-sound
 * mods sat on the Announcer shelf because this was consulted first.
 *
 * `shared` and `generic` used to become a category of their own here. They
 * describe a naming habit, not a kind of sound.
 */
export function classifyDownloadCategory(categoryName: string | null | undefined): SoundClassification {
    const value = categoryName?.trim().toLowerCase() ?? '';
    const term = (category: SoundCategory): SoundClassification => ({
        category,
        rule: 'downloadCategory',
        evidence: value,
    });
    if (!value) return { category: 'unclassified', rule: 'none', evidence: '' };
    if (value.includes('music')) return term('music');
    if (value.includes('announcer')) return term('announcer');
    if (value === 'ui' || value === 'ui sounds') return term('ui');
    if (value.includes('ambience') || value.includes('ambient')) return term('ambience');
    if (value.includes('npc') || value.includes('creep')) return term('npc');
    if (value.includes('item')) return term('item');
    if (value.includes('melee')) return term('melee');
    // A kill sound in this game is a creep/trooper kill: NPC content, not a
    // nameless bucket. Weak evidence though, so any real path beats it.
    if (value.includes('killsound')) return term('npc');
    return { category: 'unclassified', rule: 'none', evidence: value };
}

/**
 * Refine a base-game catalog row into the shared vocabulary.
 *
 * The catalog's own grouping comes from the engine, off the event's source
 * file, and it is coarse where the file is coarse: `gameplay` holds abilities,
 * weapons, movement, and the whole player melee pool together. That is why
 * "Melee" existed in no vocabulary despite being a thing every player hears.
 *
 * Rather than wait for the catalog engine to learn a new group, refine from the
 * clip paths the row already carries, using the same `PATH_RULES` that classify
 * an installed mod. Same rules, same kind of evidence, one vocabulary.
 *
 * Deliberately narrow: only the coarse `gameplay` bucket is refined, and only
 * into terms the paths state outright. The finer catalog groups (`ui`, `music`,
 * `npc`, `item`, `ambience`, `voice`) already name a term and are left alone,
 * because re-deriving a correct answer only creates a chance to disagree with it.
 */
export function refineCatalogTerm(
    coarse: SoundTerm,
    clipPaths: readonly string[],
): { term: SoundTerm; reason: SoundClassification | null } {
    if (coarse !== 'gameplay' || clipPaths.length === 0) return { term: coarse, reason: null };
    const first = classifySound(clipPaths[0]);
    // Only a path rule may move a row out of Gameplay. A word in a filename is
    // not enough to split up a group the engine drew from real soundevent files.
    if (first.rule !== 'path') return { term: coarse, reason: null };
    // Every clip in a randomizer pool has to agree, or the row is a pool that
    // spans kinds and belongs where the engine put it.
    for (const path of clipPaths.slice(1)) {
        const next = classifySound(path);
        if (next.rule !== 'path' || next.category !== first.category) {
            return { term: coarse, reason: null };
        }
    }
    return { term: first.category, reason: first };
}
