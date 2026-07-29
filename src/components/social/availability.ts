// Two different questions about a published profile's mods, deliberately kept
// apart:
//
//   1. AVAILABILITY (upstream): can GameBanana still serve these mods? This is
//      the server's answer, computed by the weekly revalidation cron and
//      carried on the wire as `mods_available` / `mods_revalidated_at`. It says
//      "GameBanana no longer has this."
//
//   2. MISSING (local): which of these mods are not installed on THIS machine?
//      Computed here from the installed-mod list. It says "you do not have this
//      yet", which is a completely different (and much less alarming) thing.
//
// Collapsing the two would be a lie in both directions: a mod you already have
// installed can be gone from GameBanana, and a mod you are missing is usually
// perfectly healthy upstream.

import type { PortableProfile } from '../../types/portableProfile';

// ---------- 1. Upstream availability ----------

export type ModsAvailability =
    /** The service does not report availability at all (the field is absent
     *  from the response, not null). Render nothing: a permanent "not checked"
     *  badge on every card is noise about a check that is never coming. */
    | { kind: 'unsupported' }
    /** Never revalidated. NOT the same as healthy: we simply have not looked.
     *  The server sends null for this and the UI must not round it up. */
    | { kind: 'unknown' }
    | { kind: 'all'; total: number }
    | { kind: 'partial'; available: number; total: number };

export interface AvailabilityInput {
    mod_count: number;
    mods_available?: number | null;
    mods_revalidated_at?: number | null;
}

// The optional-vs-nullable split on the wire is meaningful and is the whole
// reason this distinguishes three empty-ish states rather than one. Absent
// means the service predates the revalidation cron (Grimoire may well be
// pointed at a deployment that will never run it), so there is nothing to say.
// Null means that service does track availability but has not looked at this
// profile yet, which the user should see.
export function resolveModsAvailability(profile: AvailabilityInput): ModsAvailability {
    const { mods_available: available, mod_count: total } = profile;
    if (available === undefined) return { kind: 'unsupported' };
    if (available === null) return { kind: 'unknown' };
    // A negative or over-large count would mean the server and the blob
    // disagree. Clamp instead of rendering "13 of 12 mods available".
    const clamped = Math.max(0, Math.min(available, total));
    if (clamped >= total) return { kind: 'all', total };
    return { kind: 'partial', available: clamped, total };
}

// ---------- 2. Local install state ----------

export interface MissingModsSummary {
    /** Distinct GameBanana submissions referenced by the profile. */
    total: number;
    /** Of those, how many are not installed locally. */
    missing: number;
    /** The specific ids, in profile order, for surfaces that want to name them. */
    missingIds: number[];
}

/** Anything with a GameBanana id counts as installed, including the sources
 *  folded into a merged VPK: the user has that content on disk even though
 *  the source mod row is gone from the Installed list. */
export interface InstalledModLike {
    gameBananaId?: number;
    merged?: { sources: { gameBananaId?: number }[] };
}

export function collectInstalledGameBananaIds(mods: InstalledModLike[]): Set<number> {
    const ids = new Set<number>();
    for (const mod of mods) {
        if (typeof mod.gameBananaId === 'number') ids.add(mod.gameBananaId);
        for (const source of mod.merged?.sources ?? []) {
            if (typeof source.gameBananaId === 'number') ids.add(source.gameBananaId);
        }
    }
    return ids;
}

/** Distinct GameBanana submission ids referenced by a portable profile, in
 *  first-appearance order. Non-GameBanana entries are skipped: we have no id
 *  to match them on, so we cannot claim they are missing. */
export function collectProfileGameBananaIds(profile: PortableProfile): number[] {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const mod of profile.mods) {
        if (mod.source !== 'gamebanana') continue;
        const ref = mod.ref as { submissionId?: number };
        const id = ref.submissionId;
        if (typeof id !== 'number' || !Number.isFinite(id)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

export function resolveMissingMods(
    profileModIds: number[],
    installedIds: ReadonlySet<number>
): MissingModsSummary {
    const missingIds: number[] = [];
    for (const id of profileModIds) {
        if (!installedIds.has(id)) missingIds.push(id);
    }
    return { total: profileModIds.length, missing: missingIds.length, missingIds };
}
