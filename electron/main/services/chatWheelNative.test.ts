import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyChatLaneYaml, chatLaneCrc32, compileChatLaneVpk, readChatLaneConfig, writeChatLaneVpk } from './chatWheelNative';
import { readVpkEntryBytes, parseVpkDirectory } from './vpk';

const resourceDirectory = join(__dirname, '../../../resources/chatlane');
const fixtures = join(__dirname, 'fixtures/chatwheel');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function temporaryVpk(bytes: Buffer, name = 'wheel_dir.vpk'): string {
    const root = mkdtempSync(join(tmpdir(), 'chatlane-native-test-'));
    roots.push(root);
    const path = join(root, name);
    writeFileSync(path, bytes);
    return path;
}

describe('native ChatLane conversion', () => {
    it('matches the original C# converter game resource byte for byte for the starter', async () => {
        const yaml = readFileSync(join(resourceDirectory, 'starter.yml'), 'utf8');
        const native = temporaryVpk(await compileChatLaneVpk(yaml, resourceDirectory));
        const original = join(fixtures, 'starter-original.vpk');
        expect(parseVpkDirectory(native)?.sort()).toEqual(parseVpkDirectory(original)?.sort());
        const gameResource = 'scripts/ping_wheel_messages.vdata_c';
        expect(readVpkEntryBytes(native, gameResource)).toEqual(readVpkEntryBytes(original, gameResource));
        expect(await readChatLaneConfig(native)).toBe(yaml);
        expect(await readChatLaneConfig(original)).toBe(yaml);
    });

    it('preserves comments, CRLF, Unicode and unknown YAML fields verbatim', async () => {
        const yaml = '\uFEFF# Keep me\r\nname: "调用 ☕"\r\ncustom_menus:\r\n  - name: "菜单"\r\n    icon: heart\r\n    items: [Help, Thanks]\r\nfuture_extension: {enabled: true, payload: [1, 2]}\r\n';
        const path = temporaryVpk(await compileChatLaneVpk(yaml, resourceDirectory));
        expect(await readChatLaneConfig(path)).toBe(yaml);
        const resource = readVpkEntryBytes(path, 'scripts/ping_wheel_messages.vdata_c')!;
        expect(resource.includes(Buffer.from('菜单\0'))).toBe(true);
        const dataStart = 32 + resource.readUInt32LE(32);
        const integerBytes = resource.readUInt32LE(dataStart + 32) * 4;
        const doubleBytes = resource.readUInt32LE(dataStart + 36) * 8;
        const stringsStart = dataStart + 64 + Math.ceil(integerBytes / 8) * 8 + doubleBytes;
        expect(resource.readUInt32LE(dataStart + 40)).toBe(resource.length - stringsStart - 4);
    });

    it('matches original override, custom menu ID, icon and empty menu output byte for byte', async () => {
        const yaml = readFileSync(join(fixtures, 'overrides.yml'), 'utf8');
        const native = temporaryVpk(await compileChatLaneVpk(yaml, resourceDirectory));
        const original = join(fixtures, 'overrides-original.vpk');
        expect(readVpkEntryBytes(native, 'scripts/ping_wheel_messages.vdata_c')).toEqual(readVpkEntryBytes(original, 'scripts/ping_wheel_messages.vdata_c'));
        expect(await readChatLaneConfig(original)).toBe(yaml);
    });

    it.each([
        ['name: X\nname: Y', /Map keys must be unique/],
        ['custom_menus: []', /name must be/],
        ['name: X\noverride_bindable: {Help: yes}', /must be true or false/],
        ['name: X\ncustom_menus: nope', /must be a list/],
        ['name: X\ncustom_menus: [{name: X, items: [false]}]', /must be a non-empty string/],
        ['name: X\ncustom_menus: [{name: X}]', /items must be a list/],
        ['name: [', /Flow sequence/],
    ])('rejects malformed config %s', (yaml, message) => {
        expect(() => applyChatLaneYaml(yaml, [])).toThrow(message);
    });

    it('uses the standard CRC32 polynomial', () => expect(chatLaneCrc32(Buffer.from('123456789'))).toBe(0xcbf43926));

    it.each([1, 2])('reads v%s config with preload plus an external archive chunk', async (version) => {
        const yaml = Buffer.from('# chunked\r\nname: Imported\r\n');
        const preloadLength = 4;
        const entry = Buffer.alloc(18);
        entry.writeUInt32LE(chatLaneCrc32(yaml));
        entry.writeUInt16LE(preloadLength, 4);
        entry.writeUInt16LE(7, 6);
        entry.writeUInt32LE(3, 8);
        entry.writeUInt32LE(yaml.length - preloadLength, 12);
        entry.writeUInt16LE(0xffff, 16);
        const tree = Buffer.concat([Buffer.from('yml\0 \0chatlane\0'), entry, yaml.subarray(0, preloadLength), Buffer.alloc(3)]);
        const header = Buffer.alloc(version === 2 ? 28 : 12);
        header.writeUInt32LE(0x55aa1234);
        header.writeUInt32LE(version, 4);
        header.writeUInt32LE(tree.length, 8);
        const path = temporaryVpk(Buffer.concat([header, tree]));
        writeFileSync(path.replace('_dir.vpk', '_007.vpk'), Buffer.concat([Buffer.from('pad'), yaml.subarray(preloadLength)]));
        expect(await readChatLaneConfig(path)).toBe(yaml.toString('utf8'));
    });

    it('rejects invalid UTF-8 rather than silently corrupting imported YAML', async () => {
        const path = temporaryVpk(writeChatLaneVpk(new Map([['chatlane.yml', Buffer.from([0xc0, 0xaf])]])));
        await expect(readChatLaneConfig(path)).rejects.toThrow(/encoded data/);
    });
    it('rejects missing config, truncation, forged sizes and corrupt CRCs', async () => {
        const absent = temporaryVpk(writeChatLaneVpk(new Map([['README', Buffer.from('x')]])));
        await expect(readChatLaneConfig(absent)).rejects.toThrow('chatlane.yml is missing');
        const bytes = writeChatLaneVpk(new Map([['chatlane.yml', Buffer.from('name: test')]]));
        const truncated = temporaryVpk(bytes.subarray(0, bytes.length - 1));
        await expect(readChatLaneConfig(truncated)).rejects.toThrow('Truncated');
        const forged = Buffer.from(bytes);
        forged.writeUInt32LE(0xffffffff, 8);
        await expect(readChatLaneConfig(temporaryVpk(forged))).rejects.toThrow('directory size');
        const corrupt = Buffer.from(bytes);
        corrupt[corrupt.length - 1] ^= 1;
        await expect(readChatLaneConfig(temporaryVpk(corrupt))).rejects.toThrow('CRC check');
    });
});
