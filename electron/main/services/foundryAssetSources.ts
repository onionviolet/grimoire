import type { Mod } from './mods';

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

export function normalizeFoundryAssetPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function provenance(candidate: InstalledAssetSourceCandidate): AssetSourceProvenance {
    const meta = candidate.metadata;
    if (meta?.gameBananaId) return 'Downloaded';
    if (meta?.textureReplacement || meta?.soundSwap || meta?.foundryBuild || meta?.chatWheel || meta?.merged || meta?.soulImport || meta?.urnImport) return 'Forged';
    if (meta?.sourceSection) return 'Imported';
    return 'Third-party';
}

/** Exact VPK-directory inspection for Foundry assets. Priority is deliberately
 * resolved here from enabled contenders only: lower pakNN priority wins. */
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
        sources.push({
            modId: candidate.mod.id,
            modName: candidate.mod.name,
            enabled: candidate.mod.enabled,
            priority: candidate.mod.priority,
            provenance: kind,
            entries,
            wins: [],
            managed: kind !== 'Third-party',
            auditionable: entries.filter((entry) => entry.endsWith('.vsnd_c')),
        });
    }
    // Deadlock loads lower pakNN later, so the lowest priority enabled writer wins.
    const winners: Record<string, string | null> = {};
    for (const path of wanted.keys()) {
        const contender = sources.filter((source) => source.enabled && source.entries.some((entry) => normalizeFoundryAssetPath(entry) === path))
            .sort((a, b) => a.priority - b.priority || a.modId.localeCompare(b.modId))[0];
        winners[path] = contender?.modId ?? null;
        if (contender) contender.wins.push(path);
    }
    sources.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.priority - b.priority || a.modName.localeCompare(b.modName));
    return { paths: [...wanted.keys()].sort(), sources, winners, unreadableMods };
}
