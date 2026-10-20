import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const context = vi.hoisted(() => ({ root: '', userData: '', page: 'https://site.test/page' }));
vi.mock('electron', () => ({
    app: { isPackaged: false, getAppPath: () => context.root, getPath: () => context.userData },
    webContents: { fromId: () => ({ isDestroyed: () => false, getURL: () => context.page }) },
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));
// Keep the real parser/cache/matcher. Replace only native session registration,
// which the external dependency cannot reach through Vitest's Electron mock.
vi.mock('@ghostery/adblocker-electron', async importOriginal => {
    const actual = await importOriginal<typeof import('@ghostery/adblocker-electron')>();
    class TestBlocker extends actual.ElectronBlocker {
        sessions = new Set<Electron.Session>();
        enableBlockingInSession(target: Electron.Session) {
            this.sessions.add(target);
            target.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, this.onBeforeRequest);
            return {} as ReturnType<InstanceType<typeof actual.ElectronBlocker>['enableBlockingInSession']>;
        }
        disableBlockingInSession(target: Electron.Session) { this.sessions.delete(target); target.webRequest.onBeforeRequest(null); }
        isBlockingEnabled(target: Electron.Session) { return this.sessions.has(target); }
    }
    return { ...actual, ElectronBlocker: TestBlocker };
});
type Service = typeof import('./browserContentFilter');
let service: Service;
let request: ((details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => void) | null;
function session() {
    return {
        registerPreloadScript: vi.fn(() => 'preload'), unregisterPreloadScript: vi.fn(),
        setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(),
        webRequest: { onBeforeRequest: (...args: unknown[]) => { request = args.at(-1) as typeof request; }, onHeadersReceived: vi.fn() },
    } as unknown as Electron.Session;
}
async function start() {
    service = await import('./browserContentFilter');
    service.configureFilter({ enabled: true });
    service.attachBrowserFilter(session());
    await service.reloadBrowserFilter();
}
function blocked(host: string) {
    let response: Electron.CallbackResponse = {};
    request!({ url: `https://${host}/a.js`, referrer: context.page, webContentsId: 1, resourceType: 'script', id: 1 } as Electron.OnBeforeRequestListenerDetails,
        result => { response = result; });
    return response.cancel === true;
}
beforeEach(() => {
    vi.resetModules();
    context.root = mkdtempSync(join(tmpdir(), 'grimoire-filter-'));
    context.userData = join(context.root, 'data');
    context.page = 'https://site.test/page';
    mkdirSync(context.userData);
    mkdirSync(join(context.root, 'resources', 'filters'), { recursive: true });
    writeFileSync(join(context.root, 'resources', 'filters', 'filters.txt'), '||bundled.test^\nsite.test##.ad\n');
    writeFileSync(join(context.root, 'resources', 'filters', 'resources.json'), '{"scriptlets":[],"redirects":[]}');
    writeFileSync(join(context.root, 'resources', 'filters', 'meta.json'), JSON.stringify({ networkFilters: 900, cosmeticFilters: 900, tag: 'test-generation', fetchedAt: '2026-10-07T12:00:00Z' }));
});
afterEach(() => rmSync(context.root, { recursive: true, force: true }));
describe('Browser filter lifecycle', () => {
    it('counts real supported rules on cold and serialized-cache startup', async () => {
        await start();
        const cold = service.filterStats();
        expect(cold.filters).toBeGreaterThan(2);
        expect(cold.filters).toBeLessThan(900);
        expect(cold.list?.revision).toBe('test-generation');
        expect(readdirSync(context.userData).some(name => name.startsWith('adblocker-engine-'))).toBe(true);
        vi.resetModules();
        await start();
        expect(service.filterStats().filters).toBe(cold.filters);
        expect(service.filterStats().status).toBe('active');
        expect(blocked('bundled.test')).toBe(true);
    });
    it('removes replaced custom rules without removing a duplicate bundled rule', async () => {
        await start();
        const file = join(context.root, 'custom.txt');
        writeFileSync(file, '||bundled.test^\n||custom.test^');
        service.configureFilter({ enabled: true, userListPath: file });
        await service.reloadBrowserFilter();
        expect(blocked('custom.test')).toBe(true);
        writeFileSync(file, '||replacement.test^');
        await service.reloadBrowserFilter();
        expect(blocked('custom.test')).toBe(false);
        expect(blocked('replacement.test')).toBe(true);
        expect(blocked('bundled.test')).toBe(true);
        service.configureFilter({ enabled: true }); await service.reloadBrowserFilter();
        expect(blocked('replacement.test')).toBe(false);
        expect(blocked('bundled.test')).toBe(true);
    });
    it('keeps custom matching through repeated unchanged reloads and off/on cycles', async () => {
        await start();
        const file = join(context.root, 'custom.txt');
        writeFileSync(file, '||custom.test^');
        service.configureFilter({ enabled: true, userListPath: file });
        for (let index = 0; index < 6; index++) {
            await service.reloadBrowserFilter();
            expect(blocked('custom.test'), `reload ${index}`).toBe(true);
        }
        service.configureFilter({ enabled: false, userListPath: file }); await service.reloadBrowserFilter();
        service.configureFilter({ enabled: true, userListPath: file }); await service.reloadBrowserFilter();
        expect(blocked('custom.test')).toBe(true);
    });
    it('pauses only the exact saved origin and keeps permission denial', async () => {
        await start();
        service.configureFilter({ enabled: true, exceptions: ['https://site.test', 'file:///bad', 'https://site.test/path'] });
        await service.reloadBrowserFilter();
        expect(service.filterStats().exceptions).toEqual(['https://site.test']);
        expect(blocked('bundled.test')).toBe(false);
        context.page = 'https://sub.site.test/page'; expect(blocked('bundled.test')).toBe(true);
        context.page = 'http://site.test/page'; expect(blocked('bundled.test')).toBe(true);
        service.configureFilter({ enabled: true, exceptions: [] }); await service.reloadBrowserFilter();
        context.page = 'https://site.test/page'; expect(blocked('bundled.test')).toBe(true);
    });
    it('reports failed custom reads without disabling the bundled engine', async () => {
        await start();
        service.configureFilter({ enabled: true, userListPath: join(context.root, 'missing') });
        await service.reloadBrowserFilter();
        expect(service.filterStats().error).toContain('ENOENT');
        expect(blocked('bundled.test')).toBe(true);
    });
    it('does not attach a loading engine after a rapid switch off', async () => {
        await start();
        service.configureFilter({ enabled: true }); service.configureFilter({ enabled: false });
        await service.reloadBrowserFilter();
        expect(service.filterStats().status).toBe('off');
        service.configureFilter({ enabled: true }); await service.reloadBrowserFilter();
        expect(blocked('bundled.test')).toBe(true);
    });
    it('reports supported custom lines and rejected line numbers', async () => {
        await start();
        expect(service.inspectCustomList('! title\n||ads.test^\nsite.test##.ad\nexample.test#?#unsupported\n')).toEqual({ accepted: 2, rejected: 1, rejectedLines: [4] });
    });
});
