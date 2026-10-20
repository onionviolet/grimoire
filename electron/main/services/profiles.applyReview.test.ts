import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, realpathSync, mkdirSync, readFileSync, existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Mod } from '../../../src/types/mod';

const h = vi.hoisted(() => ({
    userData: '', mods: [] as Mod[],
    metadata: {} as Record<string, { sha256?: string }>,
    disable: vi.fn(), enable: vi.fn(), reorder: vi.fn(), writeAutoexec: vi.fn(),
}));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));
vi.mock('./mods', () => ({
    scanMods: async () => h.mods,
    runExclusiveModMutation: async (fn: () => Promise<unknown>) => fn(),
    disableModUnlocked: h.disable, enableModUnlocked: h.enable, reorderModsUnlocked: h.reorder,
}));
vi.mock('./metadata', () => ({ getModMetadata: (key: string) => h.metadata[key], loadMetadata: () => ({}), setModMetadata: vi.fn((key: string, data: { sha256?: string }) => { h.metadata[key] = { ...h.metadata[key], ...data }; }), removeModMetadata: vi.fn(),
    setModMetadataWithHash: async (key: string) => { h.metadata[key] = { sha256: 'c'.repeat(64) }; } }));
vi.mock('./lockerVpk', () => ({ isLockerManaged: () => false, pinLockerVpksToFront: async () => {} }));
vi.mock('./gameSessionMods', () => ({ assertCanMoveLoadedGameMods: () => {}, syncRunningGameModSnapshotFromMods: async () => {} }));
vi.mock('./modSafety', () => ({ assertVpkSafety: async () => {} }));
vi.mock('./autoexec', () => ({ readAutoexec: () => ({ commands: ['original'] }), writeAutoexec: h.writeAutoexec, getAutoexecPath: (game: string) => join(game, 'game/citadel/cfg/autoexec.cfg'), buildAutoexec: () => 'original' }));
import { journalModRename } from './recoveryJournal';

import { applyProfile, previewProfile } from './profiles';

beforeEach(() => {
    vi.clearAllMocks();
    h.metadata = {};
    h.userData = mkdtempSync(join(realpathSync(tmpdir()), 'grimoire-profile-review-'));
    h.mods = [{ id: 'other', metaKey: 'other', name: 'Other', fileName: 'other.vpk', enabled: true, priority: 1, size: 12, path: '/other.vpk' } as Mod];
    writeFileSync(join(h.userData, 'profiles.json'), JSON.stringify([{
        id: 'saved', name: 'Saved', createdAt: '2026-10-03', updatedAt: '2026-10-03',
        mods: [{ fileName: 'missing.vpk', enabled: true, priority: 1 }],
        autoexecCommands: ['changed'],
    }]));
});
afterEach(() => rmSync(h.userData, { recursive: true, force: true }));

describe('apply preflight runs before writes', () => {
    it('keeps an explicitly mapped local replacement in the reviewed order after an enable rename', async () => {
        const game = join(h.userData, 'install'), addons = join(game, 'game/citadel/addons');
        mkdirSync(addons, { recursive: true }); mkdirSync(join(game, 'game/citadel/cfg'), { recursive: true });
        writeFileSync(join(game, 'game/citadel/gameinfo.gi'), 'gameinfo');
        writeFileSync(join(game, 'game/citadel/cfg/autoexec.cfg'), 'original');
        const path = join(addons, 'local_dir.vpk'); writeFileSync(path, 'local bytes');
        h.mods = [{ id: 'local', metaKey: 'local', fileName: 'local_dir.vpk', name: 'Local', path, enabled: false, priority: 0, size: 11 } as Mod];
        h.enable.mockImplementation(async () => {
            const to = join(addons, 'pak01_dir.vpk'); await journalModRename(path, to); await fs.rename(path, to);
            h.mods[0] = { ...h.mods[0], path: to, fileName: 'pak01_dir.vpk', enabled: true, priority: 1 };
        });
        const mappings = [{ entryIndex: 0, modId: 'local' }];
        const preview = await previewProfile(game, 'saved', mappings);
        const applied = await applyProfile(game, 'saved', preview.reviewToken, mappings);
        expect(applied.unresolved).toEqual([]); expect(h.reorder).toHaveBeenCalledWith(game, ['local']);
        expect(JSON.parse(readFileSync(join(h.userData, 'settings.json'), 'utf8')).activeProfileId).toBeNull();
        h.enable.mockReset();
    });
    it('restores the whole previous setup when a later profile toggle fails', async () => {
        const game = join(h.userData, 'install'), addons = join(game, 'game/citadel/addons');
        const { getDisabledPath } = await import('./deadlock');
        const targetFolder = getDisabledPath(game);
        mkdirSync(addons, { recursive: true }); mkdirSync(targetFolder, { recursive: true });
        mkdirSync(join(game, 'game/citadel/cfg'), { recursive: true });
        writeFileSync(join(game, 'game/citadel/gameinfo.gi'), 'original gameinfo');
        writeFileSync(join(game, 'game/citadel/cfg/autoexec.cfg'), 'original autoexec');
        writeFileSync(join(h.userData, 'settings.json'), JSON.stringify({ activeProfileId: 'original' }));
        h.mods = [1, 2].map(n => {
            const fileName = `pak0${n}_dir.vpk`, path = join(addons, fileName);
            writeFileSync(path, `original mod ${n}`);
            return { id: String(n), metaKey: fileName, name: `Mod ${n}`, fileName, path, enabled: true, priority: n, size: 14 } as Mod;
        });
        writeFileSync(join(h.userData, 'profiles.json'), JSON.stringify([{ id: 'empty', name: 'Empty', mods: [], createdAt: '2026-10-03', updatedAt: '2026-10-03' }]));
        h.disable.mockImplementation(async (_game: string, id: string) => {
            if (id === '2') throw new Error('locked second VPK');
            const mod = h.mods[0], target = join(targetFolder, 'first_dir.vpk');
            await journalModRename(mod.path, target); await fs.rename(mod.path, target);
            mod.path = target; mod.enabled = false;
        });
        const preview = await previewProfile(game, 'empty');
        await expect(applyProfile(game, 'empty', preview.reviewToken)).rejects.toThrow(/previous state was restored: Error: disable pak02_dir.vpk: Error: locked second VPK/);
        expect(readFileSync(join(addons, 'pak01_dir.vpk'), 'utf8')).toBe('original mod 1');
        expect(readFileSync(join(addons, 'pak02_dir.vpk'), 'utf8')).toBe('original mod 2');
        expect(existsSync(join(targetFolder, 'first_dir.vpk'))).toBe(false);
        expect(JSON.parse(readFileSync(join(h.userData, 'settings.json'), 'utf8')).activeProfileId).toBe('original');
        expect(h.writeAutoexec).not.toHaveBeenCalled();
        h.disable.mockReset();
    });
    it('leaves mods and autoexec untouched when review has not been accepted', async () => {
        const preview = await previewProfile('/game', 'saved');
        expect(preview.disableCount).toBe(1);
        await expect(applyProfile('/game', 'saved')).rejects.toThrow('fresh review');
        expect(h.disable).not.toHaveBeenCalled();
        expect(h.enable).not.toHaveBeenCalled();
        expect(h.reorder).not.toHaveBeenCalled();
        expect(h.writeAutoexec).not.toHaveBeenCalled();
    });

    it('rejects a review whose live mod set changed while the dialog was open', async () => {
        const preview = await previewProfile('/game', 'saved');
        h.mods[0].enabled = false;
        await expect(applyProfile('/game', 'saved', preview.reviewToken)).rejects.toThrow('fresh review');
        expect(h.disable).not.toHaveBeenCalled();
        expect(h.writeAutoexec).not.toHaveBeenCalled();
    });
});
