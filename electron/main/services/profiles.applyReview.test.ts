import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Mod } from '../../../src/types/mod';

const h = vi.hoisted(() => ({
    userData: '', mods: [] as Mod[],
    disable: vi.fn(), enable: vi.fn(), reorder: vi.fn(), writeAutoexec: vi.fn(),
}));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));
vi.mock('./mods', () => ({
    scanMods: async () => h.mods,
    runExclusiveModMutation: async (fn: () => Promise<unknown>) => fn(),
    disableModUnlocked: h.disable, enableModUnlocked: h.enable, reorderModsUnlocked: h.reorder,
}));
vi.mock('./metadata', () => ({ getModMetadata: () => undefined, loadMetadata: () => ({}) }));
vi.mock('./lockerVpk', () => ({ isLockerManaged: () => false, pinLockerVpksToFront: async () => {} }));
vi.mock('./gameSessionMods', () => ({ assertCanMoveLoadedGameMods: () => {}, syncRunningGameModSnapshotFromMods: async () => {} }));
vi.mock('./modSafety', () => ({ assertVpkSafety: async () => {} }));
vi.mock('./autoexec', () => ({ readAutoexec: () => ({ commands: ['original'] }), writeAutoexec: h.writeAutoexec }));

import { applyProfile, previewProfile } from './profiles';

beforeEach(() => {
    vi.clearAllMocks();
    h.userData = mkdtempSync(join(tmpdir(), 'grimoire-profile-review-'));
    h.mods = [{ id: 'other', metaKey: 'other', name: 'Other', fileName: 'other.vpk', enabled: true, priority: 1, size: 12, path: '/other.vpk' } as Mod];
    writeFileSync(join(h.userData, 'profiles.json'), JSON.stringify([{
        id: 'saved', name: 'Saved', createdAt: '2026-10-03', updatedAt: '2026-10-03',
        mods: [{ fileName: 'missing.vpk', enabled: true, priority: 1 }],
        autoexecCommands: ['changed'],
    }]));
});
afterEach(() => rmSync(h.userData, { recursive: true, force: true }));

describe('apply preflight runs before writes', () => {
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
