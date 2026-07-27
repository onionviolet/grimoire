/**
 * Foundry tab IPC: thin handlers over the foundryCatalog service. Each resolves
 * the active Deadlock path (dev-aware) and throws a friendly error when it is
 * unset, so the renderer's catch surfaces the "set your game path" empty state
 * rather than a raw spawn failure.
 */
import { ipcMain } from 'electron';
import { getActiveDeadlockPath, loadSettings } from '../services/settings';
import {
    getGlobalSounds,
    getHeroRoster,
    getHeroSounds,
    getTextures,
    getVoicelines,
    ensureCategoryThumbnails,
    ensureFullImage,
    ensureVoiceclip,
    warmCache,
} from '../services/foundryCatalog';
import { buildHeroEffectVpkForExport } from '../services/heroColors';
import { exportVpkViaDialog } from '../services/foundryExport';
import { runVpkmergeStdout, vpkmergeBinaryPath } from '../services/modMerger';
import type {
    EngineInfo,
    GlobalSound,
    GlobalSoundFilters,
    HeroEffectExportRequest,
    HeroInfo,
    HeroSound,
    HeroSoundFilters,
    TextureCategory,
    TextureEntry,
    TextureFilters,
    TextureGridItem,
    VoiceLine,
    VoicelineFilters,
    VpkExportResult,
} from '../../../src/types/foundry';

function requireDeadlockPath(): string {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured. Set it in Settings first.');
    }
    return deadlockPath;
}

ipcMain.handle('foundry:heroes', async (): Promise<HeroInfo[]> => {
    return getHeroRoster(requireDeadlockPath());
});

ipcMain.handle(
    'foundry:textures',
    async (_e, filters: TextureFilters = {}): Promise<TextureEntry[]> => {
        return getTextures(requireDeadlockPath(), filters);
    }
);

ipcMain.handle(
    'foundry:ensureThumbnails',
    async (_e, category: TextureCategory): Promise<TextureGridItem[]> => {
        return ensureCategoryThumbnails(requireDeadlockPath(), category);
    }
);

ipcMain.handle(
    'foundry:voicelines',
    async (_e, filters: VoicelineFilters = {}): Promise<VoiceLine[]> => {
        return getVoicelines(requireDeadlockPath(), filters);
    }
);

ipcMain.handle(
    'foundry:heroSounds',
    async (_e, filters: HeroSoundFilters = {}): Promise<HeroSound[]> => {
        return getHeroSounds(requireDeadlockPath(), filters);
    }
);

ipcMain.handle(
    'foundry:globalSounds',
    async (_e, filters: GlobalSoundFilters = {}): Promise<GlobalSound[]> => {
        return getGlobalSounds(requireDeadlockPath(), filters);
    }
);

ipcMain.handle(
    'foundry:fullImage',
    async (_e, category: TextureCategory, entryPath: string): Promise<string | null> => {
        return ensureFullImage(requireDeadlockPath(), category, entryPath);
    }
);

ipcMain.handle(
    'foundry:voiceclip',
    async (_e, vsndPath: string): Promise<string | null> => {
        return ensureVoiceclip(requireDeadlockPath(), vsndPath);
    }
);

ipcMain.handle('foundry:warmCache', async (): Promise<void> => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) return; // nothing to warm; silent (called opportunistically)
    await warmCache(deadlockPath);
});

// Bake a hero ability-VFX effect (recolor / prism / gradient / trippy) into a
// standalone addon VPK and let the user save it to disk, instead of applying it
// into the managed mod list. Reuses the apply path's cached per-hero bake, then
// opens a native save dialog. Returns { exported: false } if the user cancels.
ipcMain.handle(
    'foundry:exportHeroEffect',
    async (_e, req: HeroEffectExportRequest): Promise<VpkExportResult> => {
        const { vpkPath, suggestedName } = await buildHeroEffectVpkForExport(
            requireDeadlockPath(),
            req
        );
        return exportVpkViaDialog(vpkPath, suggestedName);
    }
);

// Report which vpkmerge engine is actually in use and what version it is.
//
// The engine is a swappable sidecar (settings.vpkmergeBinaryPath overrides the
// bundled one, in packaged builds too), so "which engine am I running" stops
// being obvious the moment anyone uses that override. This answers it from the
// same resolver the real calls go through, rather than re-deriving the path and
// risking a different answer than the one that actually built a mod.
ipcMain.handle('foundry:engineInfo', async (): Promise<EngineInfo> => {
    let path: string;
    try {
        path = vpkmergeBinaryPath();
    } catch (err) {
        return {
            path: null,
            version: null,
            bundled: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    const override = loadSettings().vpkmergeBinaryPath?.trim();
    try {
        // `--version` prints "vpkmerge <semver>"; keep the whole line, since a
        // locally built engine may carry more than upstream's release string.
        const out = await runVpkmergeStdout(['--version'], 10000);
        return {
            path,
            version: out.trim() || null,
            bundled: !override,
            error: null,
        };
    } catch (err) {
        // Resolvable but not runnable (wrong arch, missing perms, not a real
        // vpkmerge). Report the path so the user can see WHAT failed.
        return {
            path,
            version: null,
            bundled: !override,
            error: err instanceof Error ? err.message : String(err),
        };
    }
});
