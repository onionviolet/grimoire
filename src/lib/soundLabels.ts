import type { SoundAnnotation } from '../types/foundry';
import { clipBasename } from './soundDescribe';

/**
 * Label quality for sound listings (docs/sound-locker-plan.md, step 4).
 *
 * Two separate complaints, two separate fixes:
 *
 * 1. **Numbered takes triplicate a list.** Valve records several takes of the
 *    same sound as `attack_01`, `attack_02`, `attack_03`. Listing all three
 *    tells the reader nothing the take count does not, and buries the next
 *    actual sound three rows further down.
 * 2. **A personal name should beat a derived one.** Where the user has written
 *    their own `SoundAnnotation` name for an event, that is the best label in
 *    the app and it should lead, not hide behind an Annotate toggle.
 *
 * Both are pure so they can be tested without a DOM, and both are used only
 * where events are listed FOR INFORMATION. They are deliberately not applied to
 * a browse row that is also a swap target: collapsing three swappable events
 * into one row would make two of them unreachable.
 */

/** A run of numbered takes folded into one row. */
export interface CollapsedTake {
    /** The shared stem, e.g. `attack` for `attack_01..03`. */
    stem: string;
    /** How many takes were folded in. 1 means the value was not numbered. */
    takes: number;
    /** Every original value in the run, in the order first seen. */
    members: string[];
}

/** Trailing take number: `attack_01`, `attack.02`, `attack03`. Two digits or
 *  more, or a single digit behind a separator, so `wave2` (a real distinct
 *  sound name) is not mistaken for a take of `wave`. */
const TAKE_TAIL = /^(.*?)[._-]?(\d{2,}|[._-]\d)$/;

function splitTake(value: string): { stem: string; numbered: boolean } {
    const match = TAKE_TAIL.exec(value);
    if (!match) return { stem: value, numbered: false };
    const stem = match[1].replace(/[._-]+$/, '');
    // `01` alone has no stem to collapse onto.
    if (!stem) return { stem: value, numbered: false };
    return { stem, numbered: true };
}

/**
 * Fold numbered takes of the same sound into one entry each, preserving first-
 * seen order. Values that are not numbered pass through as runs of one, so a
 * caller can render the result uniformly.
 */
export function collapseTakes(values: readonly string[]): CollapsedTake[] {
    const runs = new Map<string, CollapsedTake>();
    const order: string[] = [];
    for (const value of values) {
        const { stem, numbered } = splitTake(value);
        // An unnumbered value keys on itself so two different sounds never merge
        // just because one happens to be another's stem.
        const key = numbered ? `take:${stem}` : `exact:${value}`;
        const run = runs.get(key);
        if (run) {
            run.takes += 1;
            run.members.push(value);
            continue;
        }
        runs.set(key, { stem, takes: 1, members: [value] });
        order.push(key);
    }
    return order.map((key) => runs.get(key)!);
}

/** Collapse a list of clip PATHS by their basenames, keeping the full paths as
 *  members so the caller can still audition or inspect each take. */
export function collapseClipTakes(paths: readonly string[]): CollapsedTake[] {
    const byBasename = new Map<string, string[]>();
    const basenames: string[] = [];
    for (const path of paths) {
        const name = clipBasename(path.replace(/\\/g, '/'));
        const bucket = byBasename.get(name);
        if (bucket) bucket.push(path);
        else {
            byBasename.set(name, [path]);
            basenames.push(name);
        }
    }
    // Collapse on the basenames, then map each run back to the paths that
    // produced it. Two takes of one sound in different folders stay separate
    // only if their basenames differ, which is the honest reading: the take
    // number lives in the filename.
    return collapseTakes(basenames).map((run) => ({
        stem: run.stem,
        takes: run.members.reduce((n, name) => n + (byBasename.get(name)?.length ?? 0), 0),
        members: run.members.flatMap((name) => byBasename.get(name) ?? []),
    }));
}

/**
 * The label to show for an event: the user's own name for it when they wrote
 * one, otherwise the catalog label, otherwise the raw event id. Trimmed,
 * because an annotation of whitespace is not a name.
 */
export function preferredSoundLabel(
    annotation: SoundAnnotation | undefined,
    fallback: string | null | undefined,
    event: string
): string {
    const personal = annotation?.name?.trim();
    if (personal) return personal;
    const catalog = fallback?.trim();
    return catalog || event;
}

/** Whether `preferredSoundLabel` would return the user's own name, so a caller
 *  can mark the row as personally labelled. */
export function hasPersonalLabel(annotation: SoundAnnotation | undefined): boolean {
    return Boolean(annotation?.name?.trim());
}
