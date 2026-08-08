/**
 * CR-01 regression test (06-REVIEW.md): the seam between
 * `browserDownloadCapture.ts`'s `allocateToolDownloadTempPath` (which names a
 * not-yet-written captured temp file) and `ipc/mods.ts`'s
 * `importCustomModSource` (whose file-type check gates every adoption path on
 * that name) had never been exercised end to end. `ipc/browser.test.ts` mocks
 * `importCustomModSource` away entirely, so a mismatch between the two ends of
 * this contract shipped silently: every accepted browser-tool download threw
 * "Selected file is not a .vpk or supported archive" because the allocator's
 * old `.download` suffix never passed the gate's extension check.
 *
 * This file calls both real functions against each other. `ipc/mods.ts` is a
 * large module with 30 relative imports; the only one of them this test needs
 * real is `../services/extract`, because that is where the identity gate
 * lives. `../services/vpk` is also left real (not in the "except" list below,
 * but it must be): `extract.ts` imports it as `./vpk`, which resolves to the
 * exact same module Node/Vitest already has to keep real for
 * `resolveInstallableVpk`'s magic-byte check to mean anything, and Vitest
 * mocks are keyed by resolved module id, not by which file wrote the import
 * statement. Mocking `../services/vpk` from here would silently replace
 * `checkVpkFile` for `extract.ts` too and turn the identity-gate assertions
 * into an assertion about a mock instead of about the real gate. Both files
 * are electron-free (fs/crypto only), matching `extract.test.ts`'s own claim
 * that they load unmocked in this repo's vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Distinctive sentinel: no other code path on this seam can produce this
// exact message, so seeing it proves execution passed both the extension
// check and the magic-byte identity gate and entered the slot-allocation
// step, without this test ever writing into a real mod library.
const ALLOCATE_SLOT_SENTINEL = 'SENTINEL: reached allocateEnabledVpkPath';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
    },
    shell: {
        openPath: vi.fn(),
        openExternal: vi.fn(),
        showItemInFolder: vi.fn(),
        trashItem: vi.fn(),
    },
}));
vi.mock('../services/settings', () => ({
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    getActiveDeadlockPath: vi.fn(),
}));
vi.mock('../services/mods', () => ({
    scanMods: vi.fn(),
    enableMod: vi.fn(),
    disableMod: vi.fn(),
    deleteMod: vi.fn(),
    setModPriority: vi.fn(),
    reorderMods: vi.fn(),
    swapModPriority: vi.fn(),
    setModsEnabledBatch: vi.fn(),
    setModPriorityFolder: vi.fn(),
    allocateEnabledVpkPath: vi.fn().mockRejectedValue(new Error(ALLOCATE_SLOT_SENTINEL)),
    runExclusiveModMutation: (fn: () => unknown) => fn(),
}));
vi.mock('../services/deadlock', () => ({
    metaKeyFor: vi.fn(),
}));
vi.mock('../services/metadata', () => ({
    getModMetadata: vi.fn(),
    setModMetadata: vi.fn(),
    setModMetadataWithHash: vi.fn(),
    removeModMetadata: vi.fn(),
    pruneOrphanMetadata: vi.fn(),
}));
vi.mock('../services/vpkImpostors', () => ({
    reconcileInstalledVpks: vi.fn(),
    repairVpkImpostor: vi.fn(),
}));
vi.mock('../services/foundrySoundConflicts', () => ({
    inspectFoundrySoundWriteSet: vi.fn(),
}));
vi.mock('../services/foundryAssetSources', () => ({
    inspectFoundryAssetSources: vi.fn(),
}));
vi.mock('../services/abilitySounds', () => ({
    classifyAbilitySoundsFromVpk: vi.fn(),
}));
vi.mock('../services/conflicts', () => ({
    migrateIgnoredConflictKeysForMods: vi.fn(),
}));
vi.mock('../services/lockerVpk', () => ({
    isLockerManaged: vi.fn(),
}));
vi.mock('../services/unknownModDetection', () => ({
    detectUnknownModCacheMatches: vi.fn(),
    detectUnknownModFilters: vi.fn(),
    emptyCrcMatch: vi.fn(),
    inferHeroFromVpkTree: vi.fn(),
}));
vi.mock('../services/download', () => ({
    downloadMod: vi.fn(),
}));
vi.mock('../services/adoptedThumbnail', () => ({
    fetchAdoptedThumbnail: vi.fn(),
}));
vi.mock('../services/modMerger', () => ({
    analyzeMerge: vi.fn(),
    mergeMods: vi.fn(),
    unmergeMod: vi.fn(),
    extractMergeSource: vi.fn(),
    addMergeSources: vi.fn(),
    reserveOutputSlot: vi.fn(),
}));
vi.mock('../services/imprintMods', () => ({
    imprintOneMod: vi.fn(),
    imprintAllInstalled: vi.fn(),
    imprintPreflight: vi.fn(),
    classifyEmbedFreshnessAt: vi.fn(),
    computeAdoptionPatchAt: vi.fn(),
    hasAdoptionFields: vi.fn(),
    hasAnyImprint: vi.fn(),
}));
vi.mock('../services/vpkIdentity', () => ({
    parseAddonInfo: vi.fn(),
    readEmbeddedAddonInfoText: vi.fn(),
    readEmbeddedAddonInfo: vi.fn(),
    carryForwardOriginalIdentity: vi.fn(),
}));
vi.mock('../services/modinfoFormat', () => ({
    readEmbeddedModinfo: vi.fn(),
    readLegacyGrimoireMergeMeta: vi.fn(),
    hasLegacyGrimoireMergeMetaEntry: vi.fn(),
}));
vi.mock('../services/foundryCatalog', () => ({
    buildHeroSoundSwapVpk: vi.fn(),
    cleanupHeroSoundSwapBuild: vi.fn(),
}));
vi.mock('../services/foundryTextureReplace', () => ({
    buildTextureReplacementVpk: vi.fn(),
    cleanupTextureReplacementBuild: vi.fn(),
}));
vi.mock('../services/foundryForge', () => ({
    buildFoundryForgeVpk: vi.fn(),
    describeFoundryBuild: vi.fn(),
}));
vi.mock('../services/soulContainerImport', () => ({
    buildSoulContainerVpk: vi.fn(),
    cleanupSoulContainerBuild: vi.fn(),
    previewSoulContainerGlb: vi.fn(),
}));
vi.mock('../services/spiritUrnImport', () => ({
    buildSpiritUrnVpk: vi.fn(),
    cleanupSpiritUrnBuild: vi.fn(),
    previewSpiritUrnGlb: vi.fn(),
}));
vi.mock('../services/soulContainerModels', () => ({
    resolveModVpk: vi.fn(),
    clearSoulModelCache: vi.fn(),
}));
vi.mock('../services/foundryExport', () => ({
    exportVpkViaDialog: vi.fn(),
    exportVpkFileName: vi.fn(),
}));
vi.mock('../index', () => ({
    getMainWindow: vi.fn(),
}));

const { importCustomModSource } = await import('./mods');
const { allocateToolDownloadTempPath } = await import('../services/browserDownloadCapture');

/** The header shape `extract.test.ts`'s `vpkBytes` helper uses: a real v1
 *  header (magic + version + tree size) that satisfies the real identity
 *  gate. The trailing marker is free-form; the gate only reads the header. */
function vpkBytes(marker: string): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32LE(0x55aa1234, 0);
    header.writeUInt32LE(1, 4);
    header.writeUInt32LE(1, 8);
    header.writeUInt8(0, 12); // empty tree terminator
    return Buffer.concat([header, Buffer.from(marker)]);
}

/** Non-VPK bytes: a ZIP local-file-header signature ("PK\x03\x04"), enough
 *  for the identity gate to classify this as `format: 'zip'` and refuse it
 *  regardless of what extension the path carries. */
function zipBytes(): Buffer {
    return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
}

const FILE_TYPE_SENTENCE = 'Selected file is not a .vpk or supported archive (.zip, .7z, .rar)';

describe('mods.toolDownloadImportSeam (CR-01: captured temp path vs the shared install gate)', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'mods-tool-download-seam-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
        vi.clearAllMocks();
    });

    it('a real VPK at a real-allocator-produced path reaches the slot-allocation sentinel, not the file-type sentence', async () => {
        const allocated = allocateToolDownloadTempPath(root, 'pimpmyhideout-build');
        writeFileSync(allocated, vpkBytes('SEAM-OK'));

        const rejection = importCustomModSource(
            'C:/Games/Deadlock',
            { vpkPath: allocated, name: 'Test download', nsfw: false },
            []
        );
        await expect(rejection).rejects.toThrow(ALLOCATE_SLOT_SENTINEL);
        // Both assertions matter: the first proves how far execution got
        // (past the extension check and the magic-byte identity gate, into
        // the slot-allocation step), the second names the exact regression
        // CR-01 was: the pre-fix allocator made every accepted download die
        // here instead.
        await expect(rejection).rejects.not.toThrow(FILE_TYPE_SENTENCE);
    });

    it('negative control: the same bytes at the previously shipped .download suffix are rejected by the file-type check', async () => {
        const preFixPath = join(root, 'preexisting-suffix.download');
        writeFileSync(preFixPath, vpkBytes('SEAM-PRE-FIX'));

        await expect(
            importCustomModSource('C:/Games/Deadlock', { vpkPath: preFixPath, name: 'Test download', nsfw: false }, [])
        ).rejects.toThrow(FILE_TYPE_SENTENCE);
    });

    it('identity-gate control: non-VPK bytes at a real-allocator-produced path are still refused, not by the sentinel', async () => {
        const allocated = allocateToolDownloadTempPath(root, 'not-actually-a-vpk');
        writeFileSync(allocated, zipBytes());

        const rejection = importCustomModSource(
            'C:/Games/Deadlock',
            { vpkPath: allocated, name: 'Test download', nsfw: false },
            []
        );
        await expect(rejection).rejects.toThrow();
        await expect(rejection).rejects.not.toThrow(ALLOCATE_SLOT_SENTINEL);
    });
});
