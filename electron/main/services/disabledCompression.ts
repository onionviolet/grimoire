import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { runExclusiveModMutation } from './mods';
import type { DisabledCompressionMode, DisabledCompressionResult, DisabledCompressionStatus } from '../../../src/types/disabledCompression';

/** compact applies NTFS compression transparently: paths, logical bytes and
 * multipart relationships stay unchanged. Never pass a directory, wildcard,
 * recursive flag or /EXE to this executable. */
function executable(): string {
    const windows = process.env.SystemRoot;
    if (!windows || !/^[a-z]:[\\/]/i.test(windows)) throw new Error('Windows system directory is unavailable');
    return join(windows, 'System32', 'compact.exe');
}

function compact(path: string, mode: DisabledCompressionMode): Promise<void> {
    return new Promise((accept, reject) => {
        execFile(executable(), [mode === 'compress' ? '/C' : '/U', '/A', '/F', '/Q', path],
            { windowsHide: true, shell: false, timeout: 120_000, maxBuffer: 1024 * 1024 },
            (error) => error ? reject(error) : accept());
    });
}

async function assertUnlinkedDirectory(directory: string): Promise<void> {
    // Check the entire ancestry, including game/citadel/addons and the parking
    // directory itself. A junction at any level could redirect these writes.
    let current = resolve(directory);
    while (true) {
        try {
            const stats = await fs.lstat(current);
            if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('Disabled storage must not use linked directories');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }
}

async function eligibleFiles(gamePath: string) {
    const directory = resolve(gamePath, 'game', 'citadel', 'addons', '.disabled');
    await assertUnlinkedDirectory(directory);
    let names: string[];
    try { names = await fs.readdir(directory); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { directory, files: [], skippedFiles: 0 };
        throw error;
    }
    const files = [];
    let skippedFiles = 0;
    for (const name of names) {
        if (!name.toLowerCase().endsWith('.vpk')) continue;
        const path = join(directory, name);
        const stats = await fs.lstat(path);
        if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || /[*?]/.test(name)) { skippedFiles++; continue; }
        files.push({ path, size: stats.size, ino: stats.ino, dev: stats.dev });
    }
    return { directory, files, skippedFiles };
}

export async function inspectDisabledCompression(gamePath: string): Promise<DisabledCompressionStatus> {
    if (process.platform !== 'win32') return { supported: false, fileCount: 0, totalBytes: 0, skippedFiles: 0 };
    try {
        if (!(await fs.stat(executable())).isFile()) throw new Error('Windows compact utility is unavailable');
        const { files, skippedFiles } = await eligibleFiles(gamePath);
        return { supported: true, fileCount: files.length, totalBytes: files.reduce((total, file) => total + file.size, 0), skippedFiles };
    } catch {
        return { supported: false, fileCount: 0, totalBytes: 0, skippedFiles: 0 };
    }
}

export async function applyDisabledCompression(gamePath: string, mode: DisabledCompressionMode): Promise<DisabledCompressionResult> {
    if (process.platform !== 'win32') throw new Error('Disabled VPK compression is supported only on Windows NTFS storage');
    if (mode !== 'compress' && mode !== 'expand') throw new Error('Invalid disabled compression operation');
    return runExclusiveModMutation(async () => {
        if (!(await fs.stat(executable())).isFile()) throw new Error('Windows compact utility is unavailable');
        const { directory, files, skippedFiles } = await eligibleFiles(gamePath);
        const result: DisabledCompressionResult = { processedFiles: 0, skippedFiles, failedFiles: 0 };
        for (const file of files) {
            try {
                // Revalidate after waiting for prior processes. The app's mod
                // mutation lock prevents enable/import/update moves meanwhile.
                await assertUnlinkedDirectory(directory);
                const before = await fs.lstat(file.path);
                if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.ino !== file.ino || before.dev !== file.dev || before.size !== file.size) { result.skippedFiles++; continue; }
                await compact(file.path, mode);
                const after = await fs.lstat(file.path);
                if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1 || after.ino !== before.ino || after.dev !== before.dev || after.size !== before.size) throw new Error('Disabled VPK changed during compression');
                result.processedFiles++;
            } catch {
                // Partial success is explicit. NTFS leaves logical files readable
                // on interrupted compression; /F allows an explicit retry.
                result.failedFiles++;
            }
        }
        return result;
    });
}
