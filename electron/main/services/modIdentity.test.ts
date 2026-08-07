/**
 * Mod identity must be a property of the MOD, not of the slot it happens to
 * occupy. Two failures motivated this, and both are covered below:
 *
 *  1. Enable/disable moves a VPK between `addons/pakNN_dir.vpk` and
 *     `.disabled/<name>_dir.vpk`. Identity used to be md5 of that path, so the
 *     same mod had a different id in each state.
 *  2. A pakNN slot vacated by one mod is later handed to another. The new
 *     occupant inherited the old occupant's id, so a reference captured earlier
 *     (a queued op, a cached list, a saved selection) resolved to a different
 *     mod. On 2026-08-06 that pointed a delete at the wrong file.
 *
 * The test drives the real scanMods / enableMod / disableMod against a temp
 * Deadlock tree and a temp userData, so it exercises the actual rename +
 * metadata-migration path rather than a model of it. Only the two boundaries
 * that would reach outside the test are mocked: electron's userData path and
 * the running-game probe (which shells out to tasklist/pgrep).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const h = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));
vi.mock('./launch', () => ({ isDeadlockRunning: async () => false }));
vi.mock('./system', () => ({ fixGameinfo: () => ({ configured: true }) }));

import { scanMods, enableMod, disableMod, deleteMod, type Mod } from './mods';
import { getModMetadata } from './metadata';

let deadlockPath: string;

/** citadel/addons, where an ENABLED mod lives. */
function addonsDir(): string {
    return join(deadlockPath, 'game', 'citadel', 'addons');
}

/** Drop a VPK straight into an enabled pakNN slot, the way a local import or a
 *  hand-placed file arrives. Content differs per mod so the two fixtures are
 *  distinguishable by hash as well as by name. */
function installEnabled(slot: string, content: string): string {
    const path = join(addonsDir(), slot);
    writeFileSync(path, Buffer.from(content));
    return path;
}

function byFileName(mods: Mod[], fileName: string): Mod {
    const hit = mods.find((m) => m.fileName === fileName);
    if (!hit) throw new Error(`no scanned mod named ${fileName} in [${mods.map((m) => m.fileName).join(', ')}]`);
    return hit;
}

beforeEach(() => {
    h.userData = mkdtempSync(join(tmpdir(), 'mod-identity-userdata-'));
    deadlockPath = mkdtempSync(join(tmpdir(), 'mod-identity-deadlock-'));
    mkdirSync(join(deadlockPath, 'game', 'citadel', 'addons', '.disabled'), { recursive: true });
});

describe('mod identity across the enable/disable lifecycle', () => {
    it('keeps one id through disable and re-enable, even though the file moves twice', async () => {
        installEnabled('pak30_dir.vpk', 'the original mod');

        const initial = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk');
        const id = initial.id;
        expect(id).toMatch(/^[0-9a-f]{16}$/);

        // Disable: the VPK leaves addons/ for a free-form name in .disabled/.
        const afterDisable = await disableMod(deadlockPath, id);
        expect(afterDisable.enabled).toBe(false);
        expect(afterDisable.fileName).not.toBe('pak30_dir.vpk');
        expect(afterDisable.id).toBe(id);
        // ...and a fresh scan agrees, so this isn't just the return value.
        expect(byFileName(await scanMods(deadlockPath), afterDisable.fileName).id).toBe(id);

        // Re-enable: back into a pakNN slot under yet another name.
        const afterEnable = await enableMod(deadlockPath, id);
        expect(afterEnable.enabled).toBe(true);
        expect(afterEnable.id).toBe(id);
        expect(byFileName(await scanMods(deadlockPath), afterEnable.fileName).id).toBe(id);
    });

    it('never hands a freed pakNN slot to a different mod under the old mod\'s id', async () => {
        installEnabled('pak30_dir.vpk', 'the original mod');
        const original = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk');
        const originalId = original.id;

        // Vacate pak30 by disabling, then move a DIFFERENT mod into that exact
        // slot. This is the shape of the 2026-08-06 incident.
        await disableMod(deadlockPath, originalId);
        expect(readdirSync(addonsDir()).filter((n) => n.endsWith('.vpk'))).toHaveLength(0);
        installEnabled('pak30_dir.vpk', 'an entirely unrelated mod');

        const after = await scanMods(deadlockPath);
        const newOccupant = byFileName(after, 'pak30_dir.vpk');
        const movedOriginal = after.find((m) => m.id === originalId);

        // The new occupant of the slot is its own mod...
        expect(newOccupant.id).not.toBe(originalId);
        // ...and the original id still resolves to the original mod, which is
        // now sitting disabled under a different filename.
        expect(movedOriginal).toBeDefined();
        expect(movedOriginal!.enabled).toBe(false);
        expect(movedOriginal!.fileName).not.toBe('pak30_dir.vpk');
        expect(new Set(after.map((m) => m.id)).size).toBe(after.length);
    });

    it('does not re-issue a deleted mod\'s id to the next occupant of its slot', async () => {
        installEnabled('pak30_dir.vpk', 'the original mod');
        const original = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk');

        await deleteMod(deadlockPath, original.id);
        installEnabled('pak30_dir.vpk', 'an entirely unrelated mod');

        const replacement = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk');
        expect(replacement.id).not.toBe(original.id);
    });

    it('re-derives the same id from content when the sidecar row is lost', async () => {
        const path = installEnabled('pak30_dir.vpk', 'the original mod');
        // Give the row the canonical hash an installed mod would carry, so the
        // uid is seeded from content rather than from the path.
        const { setModMetadataWithHash } = await import('./metadata');
        await setModMetadataWithHash('pak30_dir.vpk', { modName: 'Original' }, path);

        const first = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk').id;

        // Wipe the uid but keep the hash, as a rebuilt-from-backfill row would be.
        const metadataPath = join(h.userData, 'mod-metadata.json');
        const sidecar = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        delete sidecar['pak30_dir.vpk'].modUid;
        writeFileSync(metadataPath, JSON.stringify(sidecar), 'utf-8');

        expect(byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk').id).toBe(first);
    });

    it('gives two byte-identical installs distinct ids', async () => {
        installEnabled('pak30_dir.vpk', 'identical bytes');
        installEnabled('pak31_dir.vpk', 'identical bytes');

        const mods = await scanMods(deadlockPath);
        const a = byFileName(mods, 'pak30_dir.vpk');
        const b = byFileName(mods, 'pak31_dir.vpk');

        expect(a.id).not.toBe(b.id);
        // Both are persisted, so the assignment survives a rescan rather than
        // flipping between the two on every scan.
        const rescanned = await scanMods(deadlockPath);
        expect(byFileName(rescanned, 'pak30_dir.vpk').id).toBe(a.id);
        expect(byFileName(rescanned, 'pak31_dir.vpk').id).toBe(b.id);
    });

    it('carries the uid in the sidecar row so it migrates with every rename', async () => {
        installEnabled('pak30_dir.vpk', 'the original mod');
        const mod = byFileName(await scanMods(deadlockPath), 'pak30_dir.vpk');
        expect(getModMetadata('pak30_dir.vpk')?.modUid).toBe(mod.id);

        const disabled = await disableMod(deadlockPath, mod.id);
        expect(getModMetadata('pak30_dir.vpk')?.modUid).toBeUndefined();
        expect(getModMetadata(disabled.metaKey)?.modUid).toBe(mod.id);
    });
});
