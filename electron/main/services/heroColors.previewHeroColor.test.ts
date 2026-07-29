/**
 * previewHeroColor is the one place the vpkmerge engine's failure wording is
 * classified. "particle-only" (this hero has no representative texture to draw)
 * must become `null` so the picker stops asking; anything else must stay a
 * throw so a transient failure still retries. That distinction cannot ride on
 * an Error subclass, since Electron IPC flattens errors to message strings, so
 * it is pinned here instead.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const harness = vi.hoisted(() => ({
    userData: '',
    calls: [] as string[][],
    // What the faked `vpkmerge recolor-hero` does: write the PNG and succeed,
    // or reject the way the real runVpkmerge reports a non-zero exit.
    behavior: 'success' as 'success' | 'particleOnly' | 'otherFailure',
}));

vi.mock('electron', () => ({
    app: { isPackaged: false, getPath: () => harness.userData, getAppPath: () => harness.userData },
}));

vi.mock('./modMerger', () => ({
    runVpkmerge: vi.fn(async (args: string[]) => {
        harness.calls.push(args);
        if (harness.behavior === 'particleOnly') {
            throw new Error(
                'vpkmerge exited with code 1: recipe for bookworm is particle-only; no representative texture to preview'
            );
        }
        if (harness.behavior === 'otherFailure') {
            throw new Error('vpkmerge exited with code 1: failed to open pak01_dir.vpk');
        }
        const pngPath = args[args.indexOf('--preview-png') + 1]!;
        // A 1x1 PNG stand-in: the service only base64s the bytes back out.
        writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }),
    vpkmergeBinaryPath: () => 'vpkmerge',
    verifyVpkOutput: vi.fn(async () => {}),
}));

import { previewHeroColor } from './heroColors';

/** A Deadlock tree with just the one file previewHeroColor checks for. */
function makeDeadlockPath(): string {
    const root = mkdtempSync(join(tmpdir(), 'hero-colors-game-'));
    const citadel = join(root, 'game', 'citadel');
    mkdirSync(citadel, { recursive: true });
    writeFileSync(join(citadel, 'pak01_dir.vpk'), 'vpk');
    return root;
}

describe('previewHeroColor', () => {
    let deadlockPath: string;

    beforeEach(() => {
        harness.userData = mkdtempSync(join(tmpdir(), 'hero-colors-user-'));
        harness.calls.length = 0;
        harness.behavior = 'success';
        deadlockPath = makeDeadlockPath();
    });

    it('returns a data URL when the engine renders a swatch', async () => {
        const url = await previewHeroColor(deadlockPath, 'Paige', 200, 1, 1);

        expect(url).toMatch(/^data:image\/png;base64,/);
        expect(harness.calls).toHaveLength(1);
        expect(harness.calls[0]?.[0]).toBe('recolor-hero');
    });

    it('returns null (do not retry) when the engine reports particle-only', async () => {
        harness.behavior = 'particleOnly';

        await expect(previewHeroColor(deadlockPath, 'Paige', 200, 1, 1)).resolves.toBeNull();
    });

    it('rethrows any other engine failure so the caller keeps retrying', async () => {
        harness.behavior = 'otherFailure';

        await expect(previewHeroColor(deadlockPath, 'Paige', 200, 1, 1)).rejects.toThrow(
            'failed to open pak01_dir.vpk'
        );
    });

    it('cleans up the temporary preview PNG on every outcome', async () => {
        await previewHeroColor(deadlockPath, 'Paige', 200, 1, 1);
        const pngPath = harness.calls[0]![harness.calls[0]!.indexOf('--preview-png') + 1]!;
        expect(existsSync(pngPath)).toBe(false);

        harness.behavior = 'particleOnly';
        await previewHeroColor(deadlockPath, 'Paige', 200, 1, 1);
        expect(existsSync(pngPath)).toBe(false);
    });
});
