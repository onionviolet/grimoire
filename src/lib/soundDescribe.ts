// Human-readable descriptions and search keys for catalog sound rows.
//
// WHY THIS EXISTS. The Foundry lists soundevents, but a soundevent name is an
// engine identifier, not a description: `Player.Melee.Hold.Shared` is the heavy
// melee charge-up and nothing in that string says so. Meanwhile the thing a
// modder actually has in hand is usually a CLIP filename, because that is what
// shows up when you dig through the pak, in other people's mods, and in
// Deadlock Forge's ID column (`player__melee__shared__charged_melee_full`).
//
// So both halves were broken for the same reason: the row rendered and matched
// only on `label` / `event` / `source`, none of which contain the clip name.
// Searching `charged_melee_full` returned "No sounds match your search" for a
// clip that is right there in the index. This module supplies:
//
//   1. `soundHaystack` - every string a row can honestly be found by, including
//      clip paths and their basenames.
//   2. `describeSound`  - what the event actually IS, in plain English.
//
// The description layer is deliberately rule-based with a small curated
// override table, NOT a hand-written line per event. There are ~1115 global
// events plus ~80 hero melee rows plus a 76K-event VO corpus; a hand-written
// table would cover a fraction and rot on the next game patch, while rules
// derived from Valve's own naming convention degrade gracefully into "we don't
// know" instead of into a wrong sentence. Where a rule would be misleading, the
// curated table wins.

/** `sounds/player/melee/shared/charged_melee_full.vsnd` -> `charged_melee_full` */
export function clipBasename(path: string): string {
    const tail = path.slice(path.lastIndexOf('/') + 1);
    return tail.replace(/\.vsnd(_c)?$/i, '');
}

/** The clip name a row is most likely to be searched by: the first clip in the
 *  pool, which is also the one the audition button plays first. Randomizer
 *  pools are `_01.._25` variants of one name, so the first is representative. */
export function primaryClipName(vsnd: string[] | undefined): string | null {
    if (!vsnd || vsnd.length === 0) return null;
    return clipBasename(vsnd[0]);
}

/** Every string this row may be matched against, lowercased and joined.
 *
 *  Includes full clip paths as well as basenames so a path fragment
 *  (`player/melee/shared`) also finds it: that is how the pak is browsed, and
 *  Deadlock Forge's IDs are just the path with `/` turned into `__`, so
 *  normalizing separators to spaces makes a pasted Forge ID match too. */
export function soundHaystack(row: {
    event: string;
    label?: string;
    source?: string;
    ability?: string | null;
    caption?: string | null;
    vsnd?: string[];
}): string {
    const parts = [row.event, row.label, row.source, row.ability, row.caption, describeSound(row)];
    for (const clip of row.vsnd ?? []) {
        parts.push(clip, clipBasename(clip));
    }
    return parts
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/[/_.]+/g, ' ');
}

/** Match `q` against a row. `q` gets the same separator normalization as the
 *  haystack, so `charged_melee_full`, `charged melee full`, and
 *  `player__melee__shared__charged_melee_full` all hit the same row. */
export function matchesSound(
    row: Parameters<typeof soundHaystack>[0],
    q: string,
    haystack?: string
): boolean {
    const needle = q.trim().toLowerCase().replace(/[/_.]+/g, ' ');
    if (!needle) return true;
    return (haystack ?? soundHaystack(row)).includes(needle);
}

// --- Description layer -----------------------------------------------------

/** Events whose rule-derived description would be wrong or uselessly vague.
 *  Keep this list short and only for things a modder would otherwise misread.
 *  The melee family is over-represented on purpose: it is the most-asked-for
 *  swap and the one whose naming is most misleading (see MELEE NOTE below). */
const CURATED: Record<string, string> = {
    // MELEE NOTE. Deadlock splits a heavy punch across two events with no
    // shared prefix, and neither name says "heavy melee":
    //   - the charge-up you hold      -> Player.Melee.Hold.Shared
    //   - the swing when you release  -> <Hero>.Melee.Swing.Charged (per hero,
    //     but every hero's pool points at the SAME sounds/player/melee/shared/
    //     clips, so it is only nominally per-hero).
    'Player.Melee.Hold.Shared':
        'Heavy melee charge-up: the wind-up that loops while you hold the melee key. Shared by every hero.',
    'Player.Melee.Parry.Shared': 'Parry attempt: the swing you make when you parry.',
    'Player.Melee.Parry.Success.Shared': 'Successful parry: the clash when a parry connects.',
    'Player.Melee.Dash': 'Melee dash: the lunge that closes distance on a melee attack.',
    'Player.Melee.Hit.Physics': 'Melee hitting a physics prop (a crate, a barrel), not a player.',
    'Ability.Melee.Impact.Player': 'Light melee landing on an enemy player.',
    'Ability.Melee.Impact.Heavy.Player': 'Heavy melee landing on an enemy player.',
    'Ability.Melee.Impact.NPC': 'Melee landing on an NPC (trooper, guardian, neutral).',
    'Player.Damage.Melee.Trooper.Impact': 'Your melee landing on a trooper.',
    'Player.Melee.Parry.Trooper.Success': 'Parrying a trooper successfully.',
    'Damage.Receive.Melee': 'Taking melee damage yourself.',
    'Soul.Urn.Melee.Drop': 'The Soul Urn being knocked loose by a melee hit.',
};

/** Token glossary for the rule path: engine tokens to the words a player uses.
 *  Only tokens whose meaning is not obvious from the token itself. */
const TOKEN_GLOSS: Record<string, string> = {
    vo: 'voice line',
    t1: 'tier 1',
    t2: 'tier 2',
    t3: 'tier 3',
    npc: 'NPC',
    ui: 'interface',
    lp: 'looping',
    sweetener: 'extra layer mixed on top',
    charged: 'heavy (charged)',
    hold: 'charge-up (held)',
    cast: 'being cast',
    impact: 'landing on a target',
    receive: 'taken by you',
    shared: 'shared across heroes',
};

/** What the leading token of an event says about who or what makes the sound. */
const SUBJECT: Record<string, string> = {
    player: 'You (the local player)',
    damage: 'Damage',
    ability: 'An ability',
    guardian: 'A Guardian',
    trooper: 'A trooper',
    watcher: 'A Watcher',
    walker: 'A Walker',
    patron: 'The Patron',
    midboss: 'The Mid-Boss',
    soul: 'Souls',
    mods: 'A shop item',
    music: 'Music',
    citadel: 'The game',
    npc: 'An NPC',
};

/** Fallback sentence per category, used when the event name carries no usable
 *  structure. Vague on purpose: better than inventing specifics. */
const CATEGORY_GLOSS: Record<string, string> = {
    ui: 'Interface sound: menus, shop, HUD.',
    music: 'Music cue.',
    item: 'Shop item sound: fires when the item procs or is used.',
    gameplay: 'In-match gameplay sound.',
    npc: 'NPC sound: troopers, guardians, and other map creatures.',
    ambience: 'Ambient world sound: the map bed rather than an event.',
    voice: 'Spoken line.',
    weapon: 'Gun sound.',
    ability: 'Ability sound.',
    movement: 'Movement sound: footsteps, dashes, landings.',
    melee: 'Melee sound.',
    other: null as unknown as string,
};

/**
 * One plain-English sentence describing what a sound event actually is, or null
 * when nothing honest can be said. Null is a valid, common answer: the row then
 * shows its clip name alone, which is still more than the event name gave.
 */
export function describeSound(row: {
    event: string;
    category?: string;
    source?: string;
    ability?: string | null;
    hero?: string | null;
    vsnd?: string[];
}): string | null {
    const curated = CURATED[row.event];
    if (curated) return curated;

    const parts = row.event.split('.');
    if (parts.length < 2) return CATEGORY_GLOSS[row.category ?? ''] ?? null;

    const head = parts[0].toLowerCase();
    const rest = parts.slice(1);

    // An ability row already knows its ability and slot; naming those beats any
    // generic sentence we could build from the tokens.
    if (row.ability) {
        return `${row.ability}: ${rest.map(glossToken).join(' ').toLowerCase()}.`;
    }

    const subject = SUBJECT[head];
    if (!subject) return CATEGORY_GLOSS[row.category ?? ''] ?? null;

    const tail = rest.map(glossToken).join(' ').toLowerCase();
    return `${subject}: ${tail}.`;
}

function glossToken(token: string): string {
    const key = token.toLowerCase();
    if (TOKEN_GLOSS[key]) return TOKEN_GLOSS[key];
    // `NewPlayer` / `PowerCycle` -> `new player` / `power cycle`, and
    // `Tier1` -> `tier 1` (Valve mixes camelCase with trailing tier digits).
    return token.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2');
}
