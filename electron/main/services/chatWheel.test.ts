import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';

const harness = vi.hoisted(() => ({ appPath: '', calls: [] as string[][] }));

vi.mock('electron', () => ({
    app: { isPackaged: false, getAppPath: () => harness.appPath },
}));

vi.mock('child_process', () => ({
    spawn: vi.fn((_binary: string, args: string[]) => {
        harness.calls.push(args);
        const child = new EventEmitter();
        Object.assign(child, { stdout: new EventEmitter(), stderr: new EventEmitter() });
        queueMicrotask(() => {
            writeFileSync(args[1]!, 'vpk');
            child.emit('close', 0);
        });
        return child;
    }),
}));

import { validateChatWheelYaml } from './chatWheel';

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
