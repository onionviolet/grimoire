import type { Mod } from './mods';

export type AssetSourceProvenance = 'Downloaded' | 'Imported' | 'Forged' | 'Third-party';

export interface InstalledAssetSourceCandidate {
    mod: Pick<Mod, 'id' | 'name' | 'enabled' | 'priority'>;
    entries: string[] | null;
    metadata?: {
        gameBananaId?: number;
        textureReplacement?: unknown;
        soundSwap?: unknown;
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
}

export interface FoundryAssetSourcesInspection {
    paths: string[];
    sources: FoundryAssetSource[];
    /** Winner by requested normalized entry path. A disabled source never wins. */
    winners: Record<string, string | null>;
    unreadableMods: Array<{ modId: string; modName: string; enabled: boolean }>;
}

export function normalizeFoundryAssetPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function provenance(candidate: InstalledAssetSourceCandidate): AssetSourceProvenance {
    const meta = candidate.metadata;
    if (meta?.gameBananaId) return 'Downloaded';
    if (meta?.textureReplacement || meta?.soundSwap || meta?.chatWheel || meta?.merged || meta?.soulImport || meta?.urnImport) return 'Forged';
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
            unreadableMods.push({ modId: candidate.mod.id, modName: candidate.mod.name, enabled: candidate.mod.enabled });
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
        sources.push({
            modId: candidate.mod.id,
            modName: candidate.mod.name,
            enabled: candidate.mod.enabled,
            priority: candidate.mod.priority,
            provenance: provenance(candidate),
            entries,
            wins: [],
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
