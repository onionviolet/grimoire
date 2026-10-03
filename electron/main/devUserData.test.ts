import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const h = vi.hoisted(() => ({ base: '', setPath: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => h.base, setPath: h.setPath } }));
let root: string;
beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 'grimoire-bootstrap-'));
    h.base = join(root, 'profile');
    vi.stubEnv('GRIMOIRE_DEV_SEED', '0');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

describe('user-data selection before service imports', () => {
    it('creates a blank slot even when seeding is disabled', async () => {
        vi.stubEnv('GRIMOIRE_DEV_SLOT', '5');
        const bootstrap = await import('./devUserData');
        expect(bootstrap.devSlotSeeding).toBe('disabled');
        expect(existsSync(`${h.base}-dev5`)).toBe(true);
        expect(existsSync(h.base)).toBe(false);
        expect(h.setPath).toHaveBeenCalledWith('userData', `${h.base}-dev5`);
    });
    it('keeps the normal profile for slot zero', async () => {
        vi.stubEnv('GRIMOIRE_DEV_SLOT', '0');
        await import('./devUserData');
        expect(h.setPath).not.toHaveBeenCalled();
    });
    it('fails invalid slots before selecting or creating any profile', async () => {
        vi.stubEnv('GRIMOIRE_DEV_SLOT', '-1');
        await expect(import('./devUserData')).rejects.toThrow('non-negative integer');
        expect(h.setPath).not.toHaveBeenCalled();
        expect(existsSync(h.base)).toBe(false);
    });
});
