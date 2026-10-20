/**
 * While Launch Vanilla has mods parked, mod mutations refuse; the restore is the
 * one batch exempt from that. These use the real mutation lock (the sibling
 * launchVanilla.test.ts stubs it) so a restore that re-entered the queue would
 * hang here instead of passing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const harness = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
    app: { getPath: () => harness.userData },
    shell: { openExternal: vi.fn() },
}));
vi.mock('./launchOptions', () => ({ isSteamRunning: async () => true, readLaunchOptions: vi.fn(), writeLaunchOptions: vi.fn() }));
vi.mock('./modSafety', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./modSafety')>()),
    assertVpkSafety: vi.fn(async () => {}),
    inspectVpkSafety: vi.fn(async () => ({ verdict: 'no-findings' })),
    isModSafetyTrusted: vi.fn(async () => true),
    moveSafetySnapshot: vi.fn(),
}));

import { launchVanilla, readStash, restoreFromStash, stashEnabledMods } from './launch';
import { runExclusiveModMutation } from './mods';
import { beginVanillaWindow, isVanillaWindowActive } from './vanillaWindow';

function gameDirs() {
    const root = mkdtempSync(join(tmpdir(), 'vanilla-window-game-'));
    const addons = join(root, 'game', 'citadel', 'addons');
    mkdirSync(join(addons, '.disabled'), { recursive: true });
    mkdirSync(join(root, 'game', 'citadel', 'grimoire'), { recursive: true });
    writeFileSync(join(addons, 'pak02_dir.vpk'), 'mod');
    return { root, addons };
}

describe('Vanilla launch mutation window', () => {
    beforeEach(() => {
        harness.userData = mkdtempSync(join(tmpdir(), 'vanilla-window-userdata-'));
    });

    it('refuses mutations while mods are parked, then allows them once the restore finishes', async () => {
        const { root, addons } = gameDirs();
        let during: unknown;

        await expect(
            launchVanilla({
                deadlockPath: root,
                beforeLaunch: async () => {
                    during = await runExclusiveModMutation(async () => 'ran').catch((err) => err);
                    throw new Error('steam unavailable');
                },
            })
        ).rejects.toThrow('steam unavailable');

        expect(String(during)).toContain('Vanilla launch in progress');
        expect(await readStash()).toBeNull();
        expect(existsSync(join(addons, 'pak02_dir.vpk'))).toBe(true);
        await expect(runExclusiveModMutation(async () => 'ran')).resolves.toBe('ran');
    });

    it('waits for a batch already running before it stashes anything', async () => {
        const { root, addons } = gameDirs();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const batch = runExclusiveModMutation(async () => {
            await gate;
            return existsSync(join(addons, 'pak02_dir.vpk'));
        });

        const launch = launchVanilla({
            deadlockPath: root,
            beforeLaunch: async () => {
                throw new Error('steam unavailable');
            },
        });
        const settled = launch.catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(isVanillaWindowActive()).toBe(false);
        expect(await readStash()).toBeNull();

        release();
        await expect(batch).resolves.toBe(true);
        await expect(launch).rejects.toThrow('steam unavailable');
        await settled;
        expect(existsSync(join(addons, 'pak02_dir.vpk'))).toBe(true);
    });

    it('lets the restore run inside the window without deadlocking on the lock it holds', async () => {
        const { root, addons } = gameDirs();
        const stash = await stashEnabledMods(root);
        beginVanillaWindow();

        await expect(restoreFromStash(root, stash)).resolves.toEqual({ restored: 1, skipped: 0, failed: [] });

        expect(isVanillaWindowActive()).toBe(false);
        expect(existsSync(join(addons, 'pak02_dir.vpk'))).toBe(true);
    });

    it('does not let a stash file left by a crash block mutations on its own', async () => {
        const { root } = gameDirs();
        await stashEnabledMods(root);

        expect(await readStash()).not.toBeNull();
        await expect(runExclusiveModMutation(async () => 'ran')).resolves.toBe('ran');
    });
});
