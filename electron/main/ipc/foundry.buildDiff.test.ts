import { describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const diff = vi.fn();

vi.mock('electron', () => ({
    app: { getPath: vi.fn() },
    dialog: { showSaveDialog: vi.fn() },
    ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) },
}));
vi.mock('../services/settings', () => ({
    getActiveDeadlockPath: () => 'C:/Games/Deadlock', loadSettings: () => ({}), saveSettings: vi.fn(),
}));
vi.mock('../services/foundryCatalog', () => ({
    getGlobalSounds: vi.fn(), getHeroRoster: vi.fn(), getHeroSounds: vi.fn(), getTextures: vi.fn(), getVoicelines: vi.fn(),
    ensureCategoryThumbnails: vi.fn(), ensureFullImage: vi.fn(), ensureVoiceclip: vi.fn(), ensureVoiceclipFile: vi.fn(),
    thumbsRoot: vi.fn(), ensureModClip: vi.fn(), pruneModClips: vi.fn(), warmCache: vi.fn(), catalogDiagnostics: vi.fn(),
    rebuildCatalogCaches: vi.fn(), foundryBuildDiff: diff,
}));
vi.mock('../services/deadlock', () => ({ getCitadelPath: vi.fn() }));
vi.mock('../services/vpk', () => ({ readVpkEntryBytes: vi.fn() }));
vi.mock('../services/mods', () => ({ scanMods: vi.fn() }));
vi.mock('../services/heroColors', () => ({ buildHeroEffectVpkForExport: vi.fn() }));
vi.mock('../services/foundryExport', () => ({ exportVpkViaDialog: vi.fn() }));
vi.mock('../services/foundryForge', () => ({ buildFoundryForgeVpk: vi.fn(), forgeAndExportFoundryVpk: vi.fn() }));
vi.mock('../services/foundryPortraitImages', () => ({ listFoundryPortraitImages: vi.fn(), portraitImageNames: vi.fn(), writeFoundryPortraitImage: vi.fn() }));
vi.mock('../services/foundrySourceThumbs', () => ({ ensureSourceThumbnail: vi.fn() }));
vi.mock('../services/foundryNonStandard', () => ({ scanNonStandardFiles: vi.fn() }));
vi.mock('../services/previewVpkRegistry', () => ({ registerPreviewVpk: vi.fn(), releasePreviewVpk: vi.fn() }));
vi.mock('../services/modMerger', () => ({ runVpkmergeStdout: vi.fn(), vpkmergeBinaryPath: vi.fn() }));
vi.mock('../services/soundAnnotations', () => ({ exportSoundAnnotations: vi.fn(), importSoundAnnotations: vi.fn(), listSoundAnnotations: vi.fn(), saveSoundAnnotation: vi.fn() }));

await import('./foundry');

describe('foundry:buildDiff IPC', () => {
    it('resolves the configured game path in main and returns only the safe diff report', async () => {
        const expected = { fingerprint: 'build-2', baseline: false, changes: [{ path: 'materials/a.vtex_c', kind: 'added' }] };
        diff.mockResolvedValue(expected);

        const result = await handlers.get('foundry:buildDiff')!({});

        expect(diff).toHaveBeenCalledWith('C:/Games/Deadlock');
        expect(result).toEqual(expected);
    });
});
