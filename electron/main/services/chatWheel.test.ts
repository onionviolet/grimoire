import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';

/**
 * `mode` steers the stubbed converter: 'ok' writes CONVERTED_YAML to the output
 * path and exits 0, 'fail' emits `outputText` on stderr (when non-empty) and
 * exits 1 without writing anything.
 */
const harness = vi.hoisted(() => ({ appPath: '', calls: [] as string[][], mode: 'ok' as 'ok' | 'fail', outputText: '' }));

const CONVERTED_YAML = 'name: Read Back\n\noverride_bindable: {}\n';

vi.mock('electron', () => ({
    app: { isPackaged: false, getAppPath: () => harness.appPath },
}));

vi.mock('child_process', () => ({
    spawn: vi.fn((_binary: string, args: string[]) => {
        harness.calls.push(args);
        const child = new EventEmitter();
        // Hold the emitters locally: Object.assign's return value is discarded,
        // so `child.stderr` would not typecheck off the EventEmitter binding.
        const stdout = new EventEmitter();
        const stderr = new EventEmitter();
        Object.assign(child, { stdout, stderr });
        queueMicrotask(() => {
            if (harness.mode === 'fail') {
                if (harness.outputText) stderr.emit('data', Buffer.from(harness.outputText));
                child.emit('close', 1);
                return;
            }
            writeFileSync(args[1]!, CONVERTED_YAML);
            child.emit('close', 0);
        });
        return child;
    }),
}));

import { readChatWheelStarter, readChatWheelVpk, validateChatWheelYaml } from './chatWheel';

const CONVERTER = process.platform === 'win32' ? 'ChatLane.exe' : 'ChatLane';

/** A fresh app root whose resources/chatlane holds the converter stub the guards require. */
function appRootWithConverter(): string {
    const appPath = mkdtempSync(join(tmpdir(), 'chat-wheel-app-'));
    const chatlane = join(appPath, 'resources', 'chatlane');
    mkdirSync(chatlane, { recursive: true });
    writeFileSync(join(chatlane, CONVERTER), 'stub');
    return appPath;
}

describe('validateChatWheelYaml', () => {
    it('runs ChatLane and removes its temporary validation VPK', async () => {
        harness.appPath = mkdtempSync(join(tmpdir(), 'chat-wheel-app-'));
        const chatlane = join(harness.appPath, 'resources', 'chatlane');
        mkdirSync(chatlane, { recursive: true });
        writeFileSync(join(chatlane, process.platform === 'win32' ? 'ChatLane.exe' : 'ChatLane'), 'stub');

        await validateChatWheelYaml('name: Checked');

        expect(harness.calls).toHaveLength(1);
        expect(harness.calls[0]?.[0]).toMatch(/chatlane\.yml$/);
        const output = harness.calls[0]?.[1];
        expect(output).toMatch(/chatlane_dir\.vpk$/);
        expect(existsSync(output!)).toBe(false);
    });

    it('rejects empty YAML before invoking the converter', async () => {
        harness.calls.length = 0;

        await expect(validateChatWheelYaml('  ')).rejects.toThrow('cannot be empty');

        expect(harness.calls).toHaveLength(0);
    });
});

describe('readChatWheelStarter', () => {
    const template = '# A working ChatLane configuration.\nname: My Chat Wheel\n\noverride_bindable: {}\n';

    it('returns the bundled template verbatim', async () => {
        harness.appPath = appRootWithConverter();
        writeFileSync(join(harness.appPath, 'resources', 'chatlane', 'starter.yml'), template, 'utf8');

        await expect(readChatWheelStarter()).resolves.toBe(template);
    });

    it('rejects with the resolved path when the template is missing', async () => {
        harness.appPath = mkdtempSync(join(tmpdir(), 'chat-wheel-app-'));

        await expect(readChatWheelStarter()).rejects.toThrow(/starter\.yml/);
    });
});

describe('readChatWheelVpk', () => {
    let fixtures = '';

    beforeEach(() => {
        harness.mode = 'ok';
        harness.outputText = '';
        harness.calls.length = 0;
        harness.appPath = appRootWithConverter();
        fixtures = mkdtempSync(join(tmpdir(), 'chat-wheel-vpk-'));
        writeFileSync(join(fixtures, 'wheel.vpk'), 'stub vpk');
    });

    it('rejects a path that is not a .vpk without spawning the converter', async () => {
        writeFileSync(join(fixtures, 'wheel.zip'), 'stub zip');

        await expect(readChatWheelVpk(join(fixtures, 'wheel.zip'))).rejects.toThrow('Select an existing .vpk file.');

        expect(harness.calls).toHaveLength(0);
    });

    it('rejects a .vpk that does not exist without spawning the converter', async () => {
        await expect(readChatWheelVpk(join(fixtures, 'absent.vpk'))).rejects.toThrow('Select an existing .vpk file.');

        expect(harness.calls).toHaveLength(0);
    });

    it('returns the extracted YAML and removes the temp directory', async () => {
        const vpk = join(fixtures, 'wheel.vpk');

        await expect(readChatWheelVpk(vpk)).resolves.toBe(CONVERTED_YAML);

        expect(harness.calls).toHaveLength(1);
        expect(harness.calls[0]?.[0]).toBe(vpk);
        const output = harness.calls[0]?.[1] ?? '';
        expect(output).toMatch(/chatlane\.yml$/);
        expect(dirname(output)).toMatch(/grimoire-chatwheel-/);
        expect(existsSync(dirname(output))).toBe(false);
    });

    it('propagates the converter output as the error and still cleans up', async () => {
        harness.mode = 'fail';
        harness.outputText = '  Unhandled exception: bad wheel\n';

        await expect(readChatWheelVpk(join(fixtures, 'wheel.vpk'))).rejects.toThrow('Unhandled exception: bad wheel');

        const output = harness.calls[0]?.[1] ?? '';
        expect(existsSync(dirname(output))).toBe(false);
    });

    it('falls back to the exit status when the converter says nothing', async () => {
        harness.mode = 'fail';

        await expect(readChatWheelVpk(join(fixtures, 'wheel.vpk'))).rejects.toThrow('ChatLane exited with status 1.');

        const output = harness.calls[0]?.[1] ?? '';
        expect(existsSync(dirname(output))).toBe(false);
    });
});
