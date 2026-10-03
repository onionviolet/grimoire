import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ repoRoot: '' }));
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => harness.repoRoot } }));
import { buildChatWheelVpk, getChatWheelConverterStatus, readChatWheelStarter, readChatWheelVpk } from './chatWheel';
harness.repoRoot = join(__dirname, '../../..');

// Always runs on Windows, macOS and Linux. No executable or external runtime required.
describe('Chat Wheel VPK round trip (real native converter)', () => {
    it('has its shipped resources on this platform', () => expect(getChatWheelConverterStatus().available).toBe(true));
    it('preserves starter YAML byte for byte through save and reopen', async () => {
        const yaml = await readChatWheelStarter();
        const built = await buildChatWheelVpk(yaml);
        try { expect(await readChatWheelVpk(built.vpkPath)).toBe(yaml); }
        finally { await built.cleanup(); }
        expect(existsSync(built.vpkPath)).toBe(false);
    });
    it('preserves override maps, unknown commands, fields, comments and CRLF', async () => {
        const yaml = [
            '# Imported config', 'name: Overrides', '',
            'override_bindable:', '  Flank: true', '  Good Game (Post Game) - All Chat: true',
            "  You're Welcome: false", '  Totally Unknown Cmd: true', '',
            'override_ping_wheel_bindable:', '  Good Game (Post Game) - All Chat: true', '',
            'custom_menus:', '  - name: Calls', '    icon: quick', '    items:', '      - Help', '      - Thanks', '',
            'future_extension: {payload: [1, 2, 3]}', '',
        ].join('\r\n');
        const built = await buildChatWheelVpk(yaml);
        try { expect(await readChatWheelVpk(built.vpkPath)).toBe(yaml); }
        finally { await built.cleanup(); }
    });
    it('rejects missing name with a readable diagnostic', async () => {
        await expect(buildChatWheelVpk('custom_menus:\n  - name: X\n    items: [Help]\n')).rejects.toThrow('name must be');
    });
    it('rejects whitespace-only YAML before staging output', async () => {
        await expect(buildChatWheelVpk('   \n\t  ')).rejects.toThrow('Chat Wheel YAML cannot be empty.');
    });
});
