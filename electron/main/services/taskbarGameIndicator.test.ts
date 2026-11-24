import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const h = vi.hoisted(() => ({ enabled: false, bitmap: vi.fn(() => 'badge') }));
vi.mock('electron', () => ({ nativeImage: { createFromBitmap: h.bitmap } }));
vi.mock('./settings', () => ({ loadSettings: () => ({ taskbarGameIndicatorEnabled: h.enabled }) }));

describe('Windows taskbar game indicator', () => {
    afterEach(() => vi.unstubAllGlobals());
    beforeEach(() => {
        vi.resetModules();
        vi.stubGlobal('process', { ...process, platform: 'win32' });
        h.enabled = false;
        h.bitmap.mockClear();
    });

    async function setup() {
        const api = await import('./taskbarGameIndicator');
        const overlay = vi.fn();
        let destroyed = false;
        const target = { isDestroyed: () => destroyed, setOverlayIcon: overlay } as unknown as BrowserWindow;
        return { api, overlay, target, destroy: () => { destroyed = true; } };
    }

    it('uses observed status, opt-in, and clears immediately on disable', async () => {
        const { api, overlay, target } = await setup();
        api.updateTaskbarGameStatus(target, true, api.taskbarGameStatusRevision());
        expect(overlay).not.toHaveBeenCalled();
        h.enabled = true;
        api.syncTaskbarGameIndicatorWithSettings();
        expect(overlay).toHaveBeenLastCalledWith('badge', 'Deadlock');
        h.enabled = false;
        api.syncTaskbarGameIndicatorWithSettings();
        expect(overlay).toHaveBeenLastCalledWith(null, '');
    });

    it('rejects pending results after a stop, disable, or shutdown', async () => {
        const { api, overlay, target } = await setup();
        h.enabled = true;
        const pending = api.taskbarGameStatusRevision();
        api.clearTaskbarGameStatus();
        api.updateTaskbarGameStatus(target, true, pending);
        expect(overlay).not.toHaveBeenCalled();
        api.updateTaskbarGameStatus(target, true, api.taskbarGameStatusRevision());
        expect(overlay).toHaveBeenLastCalledWith('badge', 'Deadlock');
        const beforeDisable = api.taskbarGameStatusRevision();
        h.enabled = false;
        api.syncTaskbarGameIndicatorWithSettings();
        h.enabled = true;
        api.updateTaskbarGameStatus(target, true, beforeDisable);
        expect(overlay).toHaveBeenLastCalledWith(null, '');
        api.destroyTaskbarGameIndicator();
        api.updateTaskbarGameStatus(target, true, api.taskbarGameStatusRevision());
        expect(overlay).toHaveBeenLastCalledWith(null, '');
    });

    it('does not touch destroyed windows or non-Windows hosts', async () => {
        const { api, overlay, target, destroy } = await setup();
        h.enabled = true;
        vi.stubGlobal('process', { ...process, platform: 'linux' });
        api.updateTaskbarGameStatus(target, true, api.taskbarGameStatusRevision());
        expect(overlay).not.toHaveBeenCalled();
        vi.stubGlobal('process', { ...process, platform: 'win32' });
        destroy();
        api.syncTaskbarGameIndicatorWithSettings();
        expect(overlay).not.toHaveBeenCalled();
    });
});
