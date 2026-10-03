import { createHash } from 'node:crypto';
import type { Mod } from '../../../src/types/mod';
import type { Profile, ProfileApplyEntry, ProfileApplyPreview } from '../../../src/types/electron';
import { buildProfileModResolver, normalizeVpkIndex, type MetaLookup } from './profileResolver';

/** Resolve once for both the review and the mutation; ambiguous entries stay out. */
export function buildProfileApplyPlan(profile: Profile, mods: Mod[], getMeta: MetaLookup) {
    const resolve = buildProfileModResolver(mods, getMeta);
    const matches = new Map<string, Profile['mods'][number]>();
    const entries: ProfileApplyEntry[] = profile.mods.map((entry) => {
        const resolution = resolve(entry);
        const candidates = mods.filter((mod) => {
            const meta = getMeta(mod.metaKey);
            if (entry.gameBananaId !== undefined && entry.gameBananaFileId !== undefined) {
                return meta?.gameBananaId === entry.gameBananaId &&
                    meta.gameBananaFileId === entry.gameBananaFileId &&
                    (entry.vpkIndex === undefined || normalizeVpkIndex(meta.vpkIndex) === entry.vpkIndex);
            }
            return !entry.sha256 && mod.fileName === entry.fileName;
        });
        let status: ProfileApplyEntry['status'] = 'matched';
        if (candidates.length > 1 && !candidates.some((mod) => mod.fileName === entry.fileName &&
            candidates.filter((candidate) => candidate.fileName === mod.fileName).length === 1)) {
            status = 'ambiguous';
        } else if (!resolution.mod) {
            status = resolution.via === 'refused-crossmatch' ? 'replaced' : 'missing';
        } else {
            const meta = getMeta(resolution.mod.metaKey);
            if ((entry.sha256 && meta?.sha256 && entry.sha256.toLowerCase() !== meta.sha256.toLowerCase()) ||
                (entry.gameBananaFileId !== undefined && meta?.gameBananaFileId !== entry.gameBananaFileId)) {
                status = 'changed';
            }
        }
        if (resolution.mod && (status === 'matched' || status === 'changed')) {
            matches.set(resolution.mod.id, entry);
        }
        return { fileName: entry.fileName, enabled: entry.enabled, status,
            modName: resolution.mod?.name, modId: matches.has(resolution.mod?.id ?? '') ? resolution.mod?.id : undefined };
    });
    const issues = entries.filter((entry) => entry.enabled && entry.status !== 'matched');
    const enableCount = mods.filter((mod) => !mod.enabled && matches.get(mod.id)?.enabled).length;
    const disableCount = mods.filter((mod) => mod.enabled && !matches.get(mod.id)?.enabled).length;
    // Covers profile edits, metadata, toggle state and order changes since review.
    const reviewToken = createHash('sha256').update(JSON.stringify({
        profile,
        mods: mods.map((mod) => [mod.id, mod.metaKey, mod.enabled, mod.priority, getMeta(mod.metaKey)]),
    })).digest('hex');
    const preview: ProfileApplyPreview = { profileId: profile.id, profileName: profile.name,
        entries, issues, enableCount, disableCount, reviewToken };
    return { preview, matches };
}

export function assertProfileReview(preview: ProfileApplyPreview, reviewToken?: string): void {
    if ((preview.issues.length > 0 || reviewToken !== undefined) && reviewToken !== preview.reviewToken) {
        throw new Error('This profile needs a fresh review before applying. Missing, changed or ambiguous mods may affect your setup.');
    }
}
