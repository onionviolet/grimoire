import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const harness = vi.hoisted(() => ({ appPath: '' }));
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => harness.appPath } }));
import { buildChatWheelVpk, getChatWheelConverterStatus, readChatWheelStarter, readChatWheelVpk, validateChatWheelYaml } from './chatWheel';

const roots: string[] = [];
beforeEach(() => { harness.appPath = join(__dirname, '../../..'); });
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function temporaryRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'chat-wheel-test-'));
    roots.push(root);
    return root;
}

describe('native converter status', () => {
    it.each(['darwin', 'linux', 'win32'] as const)('supports %s using the same packaged native resources', (platform) => {
        const fileExists = vi.fn<(path: string) => boolean>(() => true);
        expect(getChatWheelConverterStatus(platform, '/resources', fileExists)).toEqual({ available: true, platform });
        expect(fileExists.mock.calls.map(([path]) => path)).toEqual(['base-commands.json', 'red2.bin', 'starter.yml', 'LICENSE'].map((name) => join('/resources/chatlane', name)));
    });
    it('reports unsupported operating systems', () => {
        const fileExists = vi.fn<(path: string) => boolean>(() => true);
        expect(getChatWheelConverterStatus('freebsd', '/resources', fileExists)).toEqual({ available: false, platform: 'freebsd', reason: 'unsupported-platform' });
        expect(fileExists).not.toHaveBeenCalled();
    });
    it('reports missing data resources without depending on a Windows executable', () => {
        expect(getChatWheelConverterStatus('darwin', '/resources', () => false)).toEqual({ available: false, platform: 'darwin', reason: 'missing-resource' });
    });
});

describe('Chat Wheel services', () => {
    it('validates with the real native converter and rejects malformed YAML', async () => {
        await expect(validateChatWheelYaml('name: Valid\ncustom_menus: []')).resolves.toBeUndefined();
        await expect(validateChatWheelYaml('name: Valid\ncustom_menus: invalid')).rejects.toThrow('must be a list');
        await expect(validateChatWheelYaml('  ')).rejects.toThrow('cannot be empty');
    });
    it('creates a removable staging VPK with the original YAML', async () => {
        const yaml = 'name: Test\nfuture_field: {keep: true}\n';
        const built = await buildChatWheelVpk(yaml);
        expect(await readChatWheelVpk(built.vpkPath)).toBe(yaml);
        await built.cleanup();
        expect(existsSync(built.vpkPath)).toBe(false);
    });
    it('returns a bundled starter verbatim', async () => {
        harness.appPath = temporaryRoot();
        const resource = join(harness.appPath, 'resources/chatlane');
        mkdirSync(resource, { recursive: true });
        const yaml = '# Keep this\nname: Starter\n';
        writeFileSync(join(resource, 'starter.yml'), yaml);
        expect(await readChatWheelStarter()).toBe(yaml);
    });
    it('reports missing starter and converter data resources', async () => {
        harness.appPath = temporaryRoot();
        await expect(readChatWheelStarter()).rejects.toThrow(/starter.yml/);
        await expect(buildChatWheelVpk('name: X')).rejects.toThrow(/resources are unavailable/);
    });
    it('rejects missing and non-VPK files before reading', async () => {
        const root = temporaryRoot();
        writeFileSync(join(root, 'wheel.zip'), 'x');
        await expect(readChatWheelVpk(join(root, 'wheel.zip'))).rejects.toThrow('Select an existing .vpk file.');
        await expect(readChatWheelVpk(join(root, 'absent.vpk'))).rejects.toThrow('Select an existing .vpk file.');
    });
});
