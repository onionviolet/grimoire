import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

// This suite exercises the real bundled ChatLane.exe converter: no
// child_process mock, no golden fixture (D-05). electron/main/services/chatWheel.test.ts
// keeps its stubbed coverage untouched; this file is a separate, deliberately
// un-stubbed sibling.
//
// Skip guard (D-06): chatLaneBinaryPath() is called eagerly below, outside any
// `it`, and the suite skips when it throws. On a Windows dev machine the
// tracked resources/chatlane/ChatLane.exe resolves and the suite runs. On
// ubuntu-latest CI there is no Linux build of the converter, so the throw is
// the natural skip signal and CI stays green with no workflow change.
const harness = vi.hoisted(() => ({ repoRoot: '' }));

vi.mock('electron', () => ({
    app: { isPackaged: false, getAppPath: () => harness.repoRoot },
}));

import { buildChatWheelVpk, chatLaneBinaryPath, readChatWheelStarter, readChatWheelVpk } from './chatWheel';

// electron/main/services -> repo root is three levels up. Set before the
// eager chatLaneBinaryPath() call below so app.getAppPath() resolves the real
// tracked resources/chatlane directory, matching dev-mode behavior.
harness.repoRoot = join(__dirname, '..', '..', '..');

let binaryAvailable = true;
try {
    chatLaneBinaryPath();
} catch {
    binaryAvailable = false;
}

describe.skipIf(!binaryAvailable)('Chat Wheel VPK round trip (real ChatLane.exe)', () => {
    // Observed fidelity (run locally against the tracked binary before writing
    // this assertion, per D-05): the bundled starter.yml, including its two
    // leading comment lines, blank lines, key order, and CRLF line endings,
    // comes back byte-for-byte identical after a build-then-read round trip.
    // Plain string equality after trim is therefore the correct assertion;
    // ChatLane does not reformat this input.
    it('survives a build -> read round trip of the starter YAML', async () => {
        const yaml = await readChatWheelStarter();

        const built = await buildChatWheelVpk(yaml);
        try {
            const roundTripped = await readChatWheelVpk(built.vpkPath);
            expect(roundTripped.trim()).toBe(yaml.trim());
        } finally {
            await built.cleanup();
        }

        expect(existsSync(built.vpkPath)).toBe(false);
    });
});
