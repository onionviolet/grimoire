import { createHash } from 'node:crypto';
import type { Mod } from '../../../src/types/mod';
import type { Profile, ProfileApplyEntry, ProfileApplyPreview, ProfileApplyMapping } from '../../../src/types/electron';
import { buildProfileModResolver, normalizeVpkIndex, type MetaLookup } from './profileResolver';

/** Resolve once for both the review and the mutation; ambiguous entries stay out. */
export function buildProfileApplyPlan(profile: Profile, mods: Mod[], getMeta: MetaLookup, mappings: ProfileApplyMapping[] = [], mappingFingerprints: Record<string, string> = {}) {
    if (!Array.isArray(mappings) || mappings.length > profile.mods.length) throw new Error('Invalid profile mappings');
    const mapped = new Map<number, Mod>();
    for (const mapping of mappings) {
        if (!mapping || !Number.isSafeInteger(mapping.entryIndex) || mapping.entryIndex < 0 || mapping.entryIndex >= profile.mods.length || mapped.has(mapping.entryIndex)) throw new Error('Invalid profile mapping entry');
        const mod = mods.find(mod => mod.id === mapping.modId);
        if (!mod) throw new Error('Mapped local mod is no longer available');
        mapped.set(mapping.entryIndex, mod);
    }
    const resolve = buildProfileModResolver(mods, getMeta);
    const matches = new Map<string, Profile['mods'][number]>();
    const entries: ProfileApplyEntry[] = profile.mods.map((entry, entryIndex) => {
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
        const selected = mapped.get(entryIndex) ?? resolution.mod;
        if (mapped.has(entryIndex)) status = 'mapped';
        if (selected && (status === 'matched' || status === 'changed' || status === 'mapped')) {
            if (matches.has(selected.id) && [...mapped.values()].some(mod => mod.id === selected.id)) throw new Error('Two profile entries cannot map to the same local mod');
            matches.set(selected.id, entry);
        }
        return { entryIndex, fileName: entry.fileName, enabled: entry.enabled, status,
            modName: selected?.name, modId: matches.has(selected?.id ?? '') ? selected?.id : undefined };
    });
    const issues = entries.filter((entry) => entry.enabled && entry.status !== 'matched');
    const enableCount = mods.filter((mod) => !mod.enabled && matches.get(mod.id)?.enabled).length;
    const disableCount = mods.filter((mod) => mod.enabled && !matches.get(mod.id)?.enabled).length;
    // Covers profile edits, metadata, toggle state and order changes since review.
    const reviewToken = createHash('sha256').update(JSON.stringify({
        profile,
        mods: mods.map((mod) => [mod.id, mod.metaKey, mod.enabled, mod.priority, mod.size, getMeta(mod.metaKey)]),
        mappings: [...mappings].sort((a, b) => a.entryIndex - b.entryIndex),
        mappingFingerprints,
    })).digest('hex');
    const preview: ProfileApplyPreview = { profileId: profile.id, profileName: profile.name,
        entries, issues, enableCount, disableCount, reviewToken, mappings,
        localMods: mods.map(mod => ({ id: mod.id, name: mod.name, fileName: mod.fileName })) };
    return { preview, matches };
}

export function assertProfileReview(preview: ProfileApplyPreview, reviewToken?: string): void {
    if ((preview.issues.length > 0 || reviewToken !== undefined) && reviewToken !== preview.reviewToken) {
        throw new Error('This profile needs a fresh review before applying. Missing, changed or ambiguous mods may affect your setup.');
    }
}
