/**
 * prepareAudioForMint is the Foundry sound mint path's front door: it hands
 * buildHeroSoundSwapVpk an MP3 no matter what the user picked. MP3 must survive
 * byte-for-byte (no re-encode of an already-fine file), everything else becomes
 * a temporary MP3 that the caller cleans up.
 *
 * The FFmpeg spawn is faked, and the fake models the two behaviors that matter:
 * it refuses to create its own output directory (real FFmpeg fails with "No
 * such file or directory"), and it reports bad input as a non-zero exit. No
 * real FFmpeg runs and no game file is touched.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';

const harness = vi.hoisted(() => ({
    calls: [] as string[][],
    /** Set non-zero to make the fake FFmpeg reject the input. */
    exitCode: 0 as number | null,
}));

vi.mock('electron', () => ({
    app: { isPackaged: false },
}));

// Any path that exists satisfies ffmpegBinaryPath's existence check; the binary
// is never actually executed because spawn is faked below.
vi.mock('ffmpeg-static', () => ({ default: process.execPath }));

vi.mock('child_process', () => ({
    spawn: vi.fn((_binary: string, args: string[]) => {
        harness.calls.push(args);
        const child = new EventEmitter();
        Object.assign(child, { stderr: new EventEmitter() });
        const stderr = (child as unknown as { stderr: EventEmitter }).stderr;
        // runFfmpeg attaches its listeners synchronously, so defer by a
        // microtask to let it subscribe before anything is emitted.
        queueMicrotask(() => {
            if (harness.exitCode !== 0) {
                stderr.emit('data', Buffer.from('Invalid data found when processing input'));
                child.emit('close', harness.exitCode);
                return;
            }
            const output = args[args.length - 1]!;
            if (!existsSync(dirname(output))) {
                // What real FFmpeg does: it will not mkdir for you.
                stderr.emit('data', Buffer.from(`${output}: No such file or directory`));
                child.emit('close', 1);
                return;
            }
            writeFileSync(output, 'fake mp3 bytes');
            child.emit('close', 0);
        });
        return child;
    }),
}));

import { prepareAudioForMint } from './audioConversion';

/** Every non-MP3 format the sound picker's file filter advertises. */
const ADVERTISED_INPUTS = ['.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'];

let sourceDir: string;

/** A stand-in input file. Contents are irrelevant: FFmpeg is faked. */
function makeInput(extension: string, contents = 'source audio bytes'): string {
    const path = join(sourceDir, `clip${extension}`);
    writeFileSync(path, contents);
    return path;
}

/** The output path the fake FFmpeg was told to write, from the recorded args. */
function lastOutputPath(): string {
    const args = harness.calls[harness.calls.length - 1]!;
    return args[args.length - 1]!;
}

describe('prepareAudioForMint', () => {
    beforeEach(() => {
        sourceDir = mkdtempSync(join(tmpdir(), 'audio-conversion-src-'));
        harness.calls.length = 0;
        harness.exitCode = 0;
    });

    it('passes MP3 through untouched without spawning FFmpeg', async () => {
        const input = makeInput('.mp3', 'original mp3 bytes');

        const mint = await prepareAudioForMint(input);

        expect(mint.path).toBe(input);
        expect(harness.calls).toHaveLength(0);
        // Cleanup for a pass-through must not delete the user's own file.
        await mint.cleanup();
        expect(existsSync(input)).toBe(true);
        expect(readFileSync(input, 'utf8')).toBe('original mp3 bytes');
    });

    it('treats the extension case-insensitively', async () => {
        const input = makeInput('.MP3');

        const mint = await prepareAudioForMint(input);

        expect(mint.path).toBe(input);
        expect(harness.calls).toHaveLength(0);
    });

    it.each(ADVERTISED_INPUTS)('transcodes %s to a temporary MP3', async (extension) => {
        const input = makeInput(extension);

        const mint = await prepareAudioForMint(input);

        expect(harness.calls).toHaveLength(1);
        const args = harness.calls[0]!;
        expect(args).toContain(input);
        expect(args).toContain('libmp3lame');
        // 44.1 kHz stereo, as the mint format requires.
        expect(args[args.indexOf('-ar') + 1]).toBe('44100');
        expect(args[args.indexOf('-ac') + 1]).toBe('2');

        expect(mint.path).toMatch(/converted\.mp3$/);
        expect(mint.path).not.toBe(input);
        expect(existsSync(mint.path)).toBe(true);

        await mint.cleanup();
        expect(existsSync(mint.path)).toBe(false);
        expect(existsSync(dirname(mint.path))).toBe(false);
        // The source is the user's file: cleanup must leave it alone.
        expect(existsSync(input)).toBe(true);
    });

    it('creates the output directory before handing the path to FFmpeg', async () => {
        // Regression guard: the temp directory was never created, so the fake
        // (like real FFmpeg) refused to write into it and every non-MP3 failed.
        const mint = await prepareAudioForMint(makeInput('.wav'));

        expect(existsSync(dirname(mint.path))).toBe(true);
        await mint.cleanup();
    });

    it('surfaces a non-zero FFmpeg exit and leaves no temp directory behind', async () => {
        harness.exitCode = 1;

        await expect(prepareAudioForMint(makeInput('.wav'))).rejects.toThrow(
            /Could not convert audio \(FFmpeg exited 1\)/
        );

        expect(harness.calls).toHaveLength(1);
        expect(existsSync(dirname(lastOutputPath()))).toBe(false);
    });

    it('rejects an unsupported extension by way of the FFmpeg failure', async () => {
        // There is no allowlist in this service: anything that is not MP3 goes
        // to FFmpeg, and FFmpeg is what rejects a file it cannot decode.
        harness.exitCode = 1;

        await expect(prepareAudioForMint(makeInput('.txt'))).rejects.toThrow(
            'Invalid data found when processing input'
        );

        expect(existsSync(dirname(lastOutputPath()))).toBe(false);
    });

    it('rejects a missing input before spawning FFmpeg', async () => {
        await expect(prepareAudioForMint(join(sourceDir, 'gone.wav'))).rejects.toThrow(
            'Audio file not found'
        );

        expect(harness.calls).toHaveLength(0);
    });
});
