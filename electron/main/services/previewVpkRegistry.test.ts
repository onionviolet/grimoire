/**
 * The Foundry tray preview is temporary in the strong sense: it exists to be
 * looked at and then to stop existing. The failure it must never have is
 * leaving a VPK in the addons folder, because that would silently install an
 * unforged draft. These cover the lifetime the registry owns.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    registerPreviewVpk,
    releaseAllPreviewVpks,
    releasePreviewVpk,
    registeredPreviewCount,
    resolvePreviewVpk,
} from './previewVpkRegistry';

/** A stand-in for what `buildFoundryForgeVpk` hands back: a file in its own
 *  temp directory, plus the cleanup that removes that directory. */
async function fakeBuild(): Promise<{ dir: string; vpkPath: string; cleanup: () => Promise<void> }> {
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-preview-test-'));
    const vpkPath = join(dir, 'foundry_dir.vpk');
    await fs.writeFile(vpkPath, 'not a real vpk');
    return { dir, vpkPath, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

beforeEach(async () => {
    await releaseAllPreviewVpks();
});

describe('preview VPK registry', () => {
    it('trades an opaque id back for the built path', async () => {
        const build = await fakeBuild();
        const id = registerPreviewVpk(build.vpkPath, build.cleanup);

        expect(id).not.toBe(build.vpkPath);
        expect(resolvePreviewVpk(id)).toBe(build.vpkPath);

        await releasePreviewVpk(id);
    });

    it('forgets the id and removes the build temp on release', async () => {
        const build = await fakeBuild();
        const id = registerPreviewVpk(build.vpkPath, build.cleanup);

        await releasePreviewVpk(id);

        expect(resolvePreviewVpk(id)).toBeNull();
        await expect(fs.access(build.dir)).rejects.toThrow();
    });

    it('resolves an unknown id to null rather than throwing', () => {
        // A stale handle from a superseded build must degrade to "no source"
        // (preview the installed stack alone), not fail the whole export.
        expect(resolvePreviewVpk('preview-does-not-exist')).toBeNull();
    });

    it('is idempotent on release, because the renderer cannot know what main already cleaned', async () => {
        const build = await fakeBuild();
        const id = registerPreviewVpk(build.vpkPath, build.cleanup);

        await releasePreviewVpk(id);
        await expect(releasePreviewVpk(id)).resolves.toBeUndefined();
        await expect(releasePreviewVpk('preview-never-issued')).resolves.toBeUndefined();
    });

    it('releases everything on quit so no preview outlives the session', async () => {
        const first = await fakeBuild();
        const second = await fakeBuild();
        registerPreviewVpk(first.vpkPath, first.cleanup);
        registerPreviewVpk(second.vpkPath, second.cleanup);
        expect(registeredPreviewCount()).toBe(2);

        await releaseAllPreviewVpks();

        expect(registeredPreviewCount()).toBe(0);
        await expect(fs.access(first.dir)).rejects.toThrow();
        await expect(fs.access(second.dir)).rejects.toThrow();
    });

    it('never touches the addons folder across the whole preview lifetime', async () => {
        // The preview must be invisible to the mod manager. Register, resolve,
        // supersede and release with a populated addons folder alongside, and
        // assert its contents are byte-identical throughout.
        const addons = await fs.mkdtemp(join(tmpdir(), 'grimoire-addons-test-'));
        await fs.writeFile(join(addons, 'pak01_dir.vpk'), 'installed mod');
        const before = await fs.readdir(addons);
        const beforeBytes = await fs.readFile(join(addons, 'pak01_dir.vpk'), 'utf8');

        const first = await fakeBuild();
        const firstId = registerPreviewVpk(first.vpkPath, first.cleanup);
        expect(resolvePreviewVpk(firstId)).toBe(first.vpkPath);

        // Superseded by a rebuild, exactly as a staged edit change does.
        const second = await fakeBuild();
        const secondId = registerPreviewVpk(second.vpkPath, second.cleanup);
        await releasePreviewVpk(firstId);
        await releasePreviewVpk(secondId);

        expect(await fs.readdir(addons)).toEqual(before);
        expect(await fs.readFile(join(addons, 'pak01_dir.vpk'), 'utf8')).toBe(beforeBytes);

        await fs.rm(addons, { recursive: true, force: true });
    });
});
