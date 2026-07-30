/**
 * Foundry tab IPC: thin handlers over the foundryCatalog service. Each resolves
 * the active Deadlock path (dev-aware) and throws a friendly error when it is
 * unset, so the renderer's catch surfaces the "set your game path" empty state
 * rather than a raw spawn failure.
 */
import { app, dialog, ipcMain } from 'electron';
import { basename, dirname, join } from 'path';
import { copyFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getActiveDeadlockPath, loadSettings, saveSettings } from '../services/settings';
import {
    getGlobalSounds,
    getHeroRoster,
    getHeroSounds,
    getTextures,
    getVoicelines,
    ensureCategoryThumbnails,
    ensureFullImage,
    ensureVoiceclip,
    ensureVoiceclipFile,
    thumbsRoot,
    ensureModClip,
    pruneModClips,
    warmCache,
    catalogDiagnostics,
    rebuildCatalogCaches,
} from '../services/foundryCatalog';
import { getCitadelPath } from '../services/deadlock';
import { readVpkEntryBytes } from '../services/vpk';
import { scanMods } from '../services/mods';
import { buildHeroEffectVpkForExport } from '../services/heroColors';
import { exportVpkViaDialog } from '../services/foundryExport';
import { buildFoundryForgeVpk, forgeAndExportFoundryVpk } from '../services/foundryForge';
import {
    listFoundryPortraitImages,
    portraitImageNames,
    writeFoundryPortraitImage,
} from '../services/foundryPortraitImages';
import { ensureSourceThumbnail } from '../services/foundrySourceThumbs';
import { scanNonStandardFiles } from '../services/foundryNonStandard';
import { registerPreviewVpk, releasePreviewVpk } from '../services/previewVpkRegistry';
import { runVpkmergeStdout, vpkmergeBinaryPath } from '../services/modMerger';
import {
    exportSoundAnnotations,
    importSoundAnnotations,
    listSoundAnnotations,
    saveSoundAnnotation,
} from '../services/soundAnnotations';
import type {
    CatalogDiagnostics,
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
    FoundryForgeRequest,
    FoundryAssetExportResult,
    FoundrySoundExportRequest,
    FoundryTextureExportRequest,
} from '../../../src/types/foundry';

function requireDeadlockPath(): string {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured. Set it in Settings first.');
    }
    return deadlockPath;
}

function exportDirectory(): string {
    const remembered = loadSettings().foundryExportPath;
    return remembered?.trim() || join(app.getPath('downloads'), 'Grimoire Exports');
}

function safeExportName(name: string, extension: string): string {
    const stem = [...basename(name)]
        .filter((char) => char.charCodeAt(0) >= 32)
        .join('')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\.+$/g, '')
        .trim();
    const normalized = stem || 'asset';
    return normalized.toLowerCase().endsWith(extension) ? normalized : `${normalized}${extension}`;
}

async function saveFoundryAsset(
    source: Buffer | string,
    name: string,
    extension: string,
    label: string
): Promise<FoundryAssetExportResult> {
    const result = await dialog.showSaveDialog({
        title: `Export ${label}`,
        defaultPath: join(exportDirectory(), safeExportName(name, extension)),
        filters: [{ name: label, extensions: [extension.slice(1)] }],
    });
    if (result.canceled || !result.filePath) return { exported: false };
    const destination = result.filePath.toLowerCase().endsWith(extension)
        ? result.filePath
        : `${result.filePath}${extension}`;
    const temporary = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
    try {
        if (typeof source === 'string') await copyFile(source, temporary);
        else await writeFile(temporary, source);
        await rename(temporary, destination);
    } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
    }
    const settings = loadSettings();
    saveSettings({ ...settings, foundryExportPath: dirname(destination) });
    return { exported: true, path: destination };
}

ipcMain.handle('foundry:heroes', async (): Promise<HeroInfo[]> => {
    return getHeroRoster(requireDeadlockPath());
});

// This only reads the base pak and writes a derived userData cache.  It is not
// connected to staging, forging, or the game's addon directory.
ipcMain.handle('foundry:scanNonStandard', async (): Promise<import('../../../src/types/foundry').NonStandardReport> =>
    scanNonStandardFiles(requireDeadlockPath())
);

ipcMain.handle(
    'foundry:textures',
    async (_e, filters: TextureFilters = {}): Promise<TextureEntry[]> => {
        return getTextures(requireDeadlockPath(), filters);
    }
);

// Export a catalog sound using the same cache as Audition. Raw export is kept
// explicit: the default decoded MP3 is useful to people, while `.vsnd_c` is for
// inspection tools that need the original container bytes.
ipcMain.handle(
    'foundry:exportSound',
    async (_e, request: FoundrySoundExportRequest): Promise<FoundryAssetExportResult> => {
        if (!request || typeof request.vsndPath !== 'string' || typeof request.fileName !== 'string') {
            throw new Error('A sound export needs a catalog clip and filename');
        }
        const entry = request.vsndPath.replace(/\\/g, '/').replace(/\.vsnd$/i, '.vsnd_c');
        if (!entry.startsWith('sounds/') || !entry.endsWith('.vsnd_c')) {
            throw new Error(`Invalid sound entry: ${request.vsndPath}`);
        }
        const deadlockPath = requireDeadlockPath();
        if (request.format === 'raw') {
            const bytes = readVpkEntryBytes(join(getCitadelPath(deadlockPath), 'pak01_dir.vpk'), entry);
            if (!bytes) throw new Error(`Could not read ${entry} from the base-game pak.`);
            return saveFoundryAsset(bytes, request.fileName, '.vsnd_c', 'Raw Valve sound');
        }
        if (request.format !== 'mp3') throw new Error('Unknown sound export format');
        const decoded = await ensureVoiceclipFile(deadlockPath, entry);
        if (!decoded) throw new Error(`Could not decode ${entry}. The source clip may use an unsupported codec.`);
        return saveFoundryAsset(decoded, request.fileName, '.mp3', 'MP3 audio');
    }
);

// The lightbox decoder already caches a full-size PNG. Export copies that exact
// decoded image atomically, so no asset is staged, installed, or written into
// the game directory.
ipcMain.handle(
    'foundry:exportTexture',
    async (_e, request: FoundryTextureExportRequest): Promise<FoundryAssetExportResult> => {
        if (!request || typeof request.entryPath !== 'string' || typeof request.fileName !== 'string') {
            throw new Error('A texture export needs a catalog entry and filename');
        }
        const url = await ensureFullImage(requireDeadlockPath(), request.category, request.entryPath);
        if (!url) throw new Error(`Could not decode ${request.entryPath} as PNG.`);
        const parts = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
        if (parts.length !== 3) throw new Error(`Could not locate decoded PNG for ${request.entryPath}.`);
        const source = join(thumbsRoot(), ...parts);
        return saveFoundryAsset(source, request.fileName, '.png', 'PNG image');
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

ipcMain.handle('foundry:listSoundAnnotations', async () => listSoundAnnotations());
ipcMain.handle('foundry:saveSoundAnnotation', async (_e, key: string, name: string, note: string, tags: string[] = []) =>
    saveSoundAnnotation(key, { name, note, tags })
);

// Combined Foundry output is deliberately export-only for its first release:
// build parts never enter Installed, and a cancelled save dialog leaves both
// the installed library and staged sources exactly as they were.
ipcMain.handle(
    'foundry:forge',
    async (_e, request: FoundryForgeRequest): Promise<VpkExportResult> => {
        const deadlockPath = requireDeadlockPath();
        return forgeAndExportFoundryVpk(
            request,
            () => buildFoundryForgeVpk(deadlockPath, request),
            exportVpkViaDialog
        );
    }
);
/**
 * Build the tray into a VPK that exists only to be looked at.
 *
 * Temporary in the strong sense: `buildFoundryForgeVpk` writes into a fresh temp
 * directory and nothing here copies it anywhere, so the addons folder is never
 * touched, `loadMods` is never called, and Installed does not change. The build
 * is registered rather than returned as a path, so the renderer holds an opaque
 * handle and the pose pipeline (not the renderer) decides what file that means.
 *
 * The caller releases the previous preview before asking for a new one, and on
 * unmount. `releaseAllPreviewVpks` on quit is the backstop for a renderer that
 * dies without doing either.
 */
ipcMain.handle(
    'foundry:buildTrayPreview',
    async (_e, request: FoundryForgeRequest): Promise<string> => {
        const deadlockPath = requireDeadlockPath();
        const built = await buildFoundryForgeVpk(deadlockPath, request);
        return registerPreviewVpk(built.vpkPath, built.cleanup);
    }
);

ipcMain.handle('foundry:releaseTrayPreview', async (_e, previewId: string): Promise<void> => {
    if (typeof previewId !== 'string' || !previewId.trim()) return;
    await releasePreviewVpk(previewId);
});

ipcMain.handle('foundry:exportSoundAnnotations', async () => exportSoundAnnotations());
ipcMain.handle('foundry:importSoundAnnotations', async (_e, content: string) =>
    importSoundAnnotations(content)
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

// Audition the clip an installed addon actually writes at an exact entry path.
// Read-only in every sense: it extracts to a cache, and never touches the
// inspected VPK, its enabled state, or its priority. The mod is resolved by id
// against the live scan rather than trusting a renderer-supplied path, so this
// can only ever read a VPK the manager already owns.
ipcMain.handle(
    'foundry:auditionSourceClip',
    async (_e, modId: string, entryPath: string): Promise<string | null> => {
        if (typeof modId !== 'string' || !modId.trim()) {
            throw new Error('An audition needs the mod that owns the entry');
        }
        if (typeof entryPath !== 'string' || !entryPath.trim()) {
            throw new Error('An audition needs an exact VPK entry path');
        }
        const mods = await scanMods(requireDeadlockPath());
        const owner = mods.find((mod) => mod.id === modId);
        if (!owner) throw new Error('That mod is no longer installed.');
        void pruneModClips();
        return ensureModClip(owner.path, entryPath);
    }
);

// Which recorded audio files are still on disk. A re-forge needs every source
// file it was originally built from, so the renderer asks first and blocks with
// the missing names rather than failing partway through a build.
ipcMain.handle('foundry:checkAudioPaths', async (_e, paths: string[]): Promise<string[]> => {
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string')) {
        throw new Error('An audio-path check requires a list of file paths');
    }
    const checked = await Promise.all(
        [...new Set(paths)].map(async (path) => (await stat(path).catch(() => null)) ? path : null)
    );
    return checked.filter((path): path is string => path !== null);
});

// The extracted clip's path on disk, for retuning a stock sound through the
// swap path (which mints from a file, not from a data URL).
ipcMain.handle(
    'foundry:voiceclipFile',
    async (_e, vsndPath: string): Promise<string | null> => {
        return ensureVoiceclipFile(requireDeadlockPath(), vsndPath);
    }
);

// Park a portrait-editor bake on disk so it can be staged.
//
// The visual staging contract records an absolute PNG path, and the editor
// authors its image on a renderer canvas, so the bytes need a file before
// `prepareVisualStagedEdit` can see them. This writes into a bounded userData
// cache only: no mod is installed, enabled, or reordered here, and nothing is
// written into the game directory.
// `originalName` is display metadata only: the storage key stays the content
// hash, so the same crop is still one file whatever it was called.
ipcMain.handle(
    'foundry:stagePortraitImage',
    async (_e, dataUrl: string, originalName?: string): Promise<string> => {
        return writeFoundryPortraitImage(dataUrl, originalName);
    }
);

// The recorded display names for staged images, keyed by stored filename. Kept
// separate from the listing because the surface that most needs a name is the
// one whose file is gone (a missing staged source in the build tray).
ipcMain.handle('foundry:portraitImageNames', async (): Promise<Record<string, string>> => {
    return portraitImageNames();
});

// A preview of the user's own source image behind a visual change, for the
// alternatives gallery. Read-only and bounded: it stats and decodes one file the
// renderer already knows about from mod provenance, caches a 128px PNG under the
// existing Foundry thumbnail root, and hands back a `grimoire-foundry:` URL. It
// never returns a filesystem path, so the renderer gains no new read reach.
// The reuse half of the editor's image intake: images the user already framed,
// offered back so a portrait edit no longer requires a file drop every time.
// Read-only over the existing staging cache; adds no new store.
ipcMain.handle('foundry:listPortraitImages', async (): Promise<import('../services/foundryPortraitImages').StagedPortraitImage[]> => {
    return listFoundryPortraitImages();
});

ipcMain.handle('foundry:sourceThumbnail', async (_e, sourcePath: string): Promise<string | null> => {
    if (typeof sourcePath !== 'string') return null;
    return ensureSourceThumbnail(sourcePath);
});

ipcMain.handle('foundry:warmCache', async (): Promise<void> => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) return; // nothing to warm; silent (called opportunistically)
    await warmCache(deadlockPath);
});

// What the catalog is currently built from, and a way to rebuild it. The
// renderer shows this when a browse surface comes back empty: "the portraits
// disappeared" is unanswerable without knowing which pak was indexed, when, and
// whether the thumbnail cache belongs to that build.
ipcMain.handle('foundry:catalogDiagnostics', async (): Promise<CatalogDiagnostics> => {
    return catalogDiagnostics(requireDeadlockPath());
});

// Drop the derived caches and re-warm. Deletes only what this app rebuilds from
// the game's own pak, never user content.
ipcMain.handle('foundry:rebuildCatalog', async (): Promise<CatalogDiagnostics> => {
    const deadlockPath = requireDeadlockPath();
    await rebuildCatalogCaches(deadlockPath);
    return catalogDiagnostics(deadlockPath);
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
