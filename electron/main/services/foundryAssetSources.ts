import type { Mod } from './mods';
import { buildAssetClaimsIndex, normalizeAssetPath } from '../../../src/lib/assetClaims';

export type AssetSourceProvenance = 'Downloaded' | 'Imported' | 'Forged' | 'Third-party';

export interface InstalledAssetSourceCandidate {
    mod: Pick<Mod, 'id' | 'name' | 'enabled' | 'priority'>;
    entries: string[] | null;
    /** When `entries` is null, the file's real type read from its magic bytes
     *  ("7-Zip archive", "ZIP archive"). Null/absent when it could not be
     *  identified: the panel says so rather than inventing a placeholder. */
    detectedType?: string | null;
    metadata?: {
        gameBananaId?: number;
        textureReplacement?: unknown;
        soundSwap?: unknown;
        foundryBuild?: unknown;
        lockerCosmetics?: unknown;
        lockerSounds?: unknown;
        lockerColors?: unknown;
        lockerTrippySkins?: unknown;
        sourceSection?: string;
        chatWheel?: boolean;
        merged?: unknown;
        soulImport?: unknown;
        urnImport?: unknown;
    };
}

export interface FoundryAssetSource {
    modId: string;
    modName: string;
    enabled: boolean;
    priority: number;
    provenance: AssetSourceProvenance;
    entries: string[];
    /** True when this enabled owner is the runtime winner for at least one path. */
    wins: string[];
    /** Grimoire minted or downloaded this VPK, so a replacement can be described
     *  honestly as superseding a known change. A third-party VPK is opaque: it
     *  is never edited in place, only layered over. */
    managed: boolean;
    /** Grimoire rebuilds this artifact itself from the Locker's own selections
     *  (the managed ability-colours VPK and its siblings), so it is not a mod
     *  the user installed and must never be reported as contesting a Locker
     *  write against the user. Kept separate from `provenance`: a user-forged
     *  mod is also `Forged` and SHOULD contest, so the two concepts cannot
     *  share a classifier. */
    lockerManaged: boolean;
    /** The matched entries a player can actually hear, so the panel offers an
     *  audition only where extraction can succeed. */
    auditionable: string[];
}

export interface FoundryAssetSourcesInspection {
    paths: string[];
    sources: FoundryAssetSource[];
    /** Winner by requested normalized entry path. A disabled source never wins. */
    winners: Record<string, string | null>;
    unreadableMods: Array<{
        modId: string;
        modName: string;
        enabled: boolean;
        /** The file's real type, when its magic bytes identify one. Absent or
         *  null when unidentifiable. */
        detectedType?: string | null;
    }>;
}

/** Kept as the name this module's callers already import; the normalization
 *  itself belongs to the claims index, so there is one spelling of "same
 *  asset" rather than one per surface. */
export function normalizeFoundryAssetPath(path: string): string {
    return normalizeAssetPath(path);
}

function provenance(candidate: InstalledAssetSourceCandidate): AssetSourceProvenance {
    const meta = candidate.metadata;
    if (meta?.gameBananaId) return 'Downloaded';
    if (meta?.textureReplacement || meta?.soundSwap || meta?.foundryBuild || meta?.chatWheel || meta?.merged || meta?.soulImport || meta?.urnImport) return 'Forged';
    if (meta?.sourceSection) return 'Imported';
    return 'Third-party';
}

/**
 * Exact VPK-directory inspection for Foundry assets.
 *
 * This module's job is reading VPK directories and describing sources; who
 * wins a path is the claims index's job (S1/S4). It used to resolve the load
 * order itself, which meant the rule "lowest enabled priority wins" was
 * written down in two processes and could drift in one.
 */
export function inspectFoundryAssetSources(
    paths: string[],
    installed: InstalledAssetSourceCandidate[],
): FoundryAssetSourcesInspection {
    const wanted = new Map<string, string>();
    for (const path of paths) {
        const normalized = normalizeFoundryAssetPath(path);
        if (normalized) wanted.set(normalized, normalized);
    }
    const unreadableMods: FoundryAssetSourcesInspection['unreadableMods'] = [];
    const sources: FoundryAssetSource[] = [];
    for (const candidate of installed) {
        if (!candidate.entries) {
            unreadableMods.push({
                modId: candidate.mod.id,
                modName: candidate.mod.name,
                enabled: candidate.mod.enabled,
                // Omitted rather than nulled when unidentifiable, so the entry
                // shape is unchanged for every existing reader.
                detectedType: candidate.detectedType ?? undefined,
            });
            continue;
        }
        // Return the same normalized key used for matching and winner lookup.
        // A VPK directory may preserve different slash/case spellings, but
        // those spellings do not represent distinct Source 2 assets.
        const entries = [...new Set(
            candidate.entries
                .map(normalizeFoundryAssetPath)
                .filter((entry) => wanted.has(entry)),
        )].sort((a, b) => a.localeCompare(b));
        if (!entries.length) continue;
        const kind = provenance(candidate);
        const lockerManaged = !!(candidate.metadata?.lockerCosmetics ||
            candidate.metadata?.lockerSounds ||
            candidate.metadata?.lockerColors ||
            candidate.metadata?.lockerTrippySkins);
        sources.push({
            modId: candidate.mod.id,
            modName: candidate.mod.name,
            enabled: candidate.mod.enabled,
            priority: candidate.mod.priority,
            provenance: kind,
            entries,
            wins: [],
            managed: kind !== 'Third-party' || lockerManaged,
            lockerManaged,
            auditionable: entries.filter((entry) => entry.endsWith('.vsnd_c')),
        });
    }
    const claims = buildAssetClaimsIndex(
        [...wanted.keys()],
        sources.map((source) => ({
            id: source.modId,
            enabled: source.enabled,
            priority: source.priority,
            entries: source.entries,
        }))
    );
    // Every requested path gets an answer, including the ones nothing claims:
    // "no source writes this" is a result the panel renders, not a gap.
    const winners: Record<string, string | null> = {};
    const byModId = new Map(sources.map((source) => [source.modId, source]));
    for (const path of wanted.keys()) {
        const winner = claims.winnerOf(path);
        winners[path] = winner;
        if (winner) byModId.get(winner)?.wins.push(path);
    }
    for (const source of sources) source.wins.sort((a, b) => a.localeCompare(b));
    sources.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.priority - b.priority || a.modName.localeCompare(b.modName));
    return { paths: [...wanted.keys()].sort(), sources, winners, unreadableMods };
}
