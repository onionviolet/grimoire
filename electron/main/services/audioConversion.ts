/** Local, private conversion of Foundry input to vpkmerge's MP3 mint format. */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { app } from 'electron';
import ffmpegStatic from 'ffmpeg-static';
import { basename, dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

export interface MintAudio { path: string; cleanup: () => Promise<void>; }

function extension(path: string): string {
    const name = basename(path);
    return name.slice(Math.max(0, name.lastIndexOf('.'))).toLowerCase();
}

/** Resolve the executable outside app.asar, where electron-builder can execute it. */
export function ffmpegBinaryPath(): string {
    if (!ffmpegStatic) throw new Error('Bundled FFmpeg is unavailable for this platform.');
    const installed = ffmpegStatic as string;
    const binary = app.isPackaged ? installed.replace('app.asar', 'app.asar.unpacked') : installed;
    if (!existsSync(binary)) throw new Error(`Bundled FFmpeg binary is missing at ${binary}. Reinstall Grimoire.`);
    return binary;
}

function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegBinaryPath(), args, { windowsHide: true });
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
        child.once('error', (error) => reject(new Error(`Could not start FFmpeg: ${error.message}`)));
        child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Could not convert audio${code === null ? '' : ` (FFmpeg exited ${code})`}: ${stderr.trim() || 'unsupported or corrupt audio file'}`)));
    });
}

/** MP3 input stays byte-for-byte intact; other formats become temporary 44.1 kHz stereo MP3. */
export async function prepareAudioForMint(inputPath: string): Promise<MintAudio> {
    if (!existsSync(inputPath)) throw new Error(`Audio file not found: ${inputPath}`);
    if (extension(inputPath) === '.mp3') return { path: inputPath, cleanup: async () => {} };
    const dir = join(tmpdir(), `grimoire-audio-${randomUUID()}`);
    const output = join(dir, 'converted.mp3');
    try {
        await runFfmpeg(['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-map', '0:a:0', '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2', output]);
    } catch (error) {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
    return { path: output, cleanup: () => rm(dirname(output), { recursive: true, force: true }).catch(() => {}) };
}
