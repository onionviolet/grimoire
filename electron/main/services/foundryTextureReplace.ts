import { existsSync, promises as fs } from 'fs';
import { join, resolve, sep, win32 } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { getCitadelPath } from './deadlock';
import { runVpkmerge, verifyVpkOutput, vpkmergeBinaryPath } from './modMerger';

const YCOCG_SAFE_MARKER = '.ycocg-icon-safe';

/** Keep untrusted renderer input to one VPK entry and one ordinary PNG. */
export function validateTextureReplacement(entryPath: string, imagePath: string): void {
    if (!entryPath || entryPath.includes('..') || !entryPath.toLowerCase().endsWith('.vtex_c')) {
        throw new Error('Texture target must be a compiled texture entry.');
    }
    if (!imagePath.toLowerCase().endsWith('.png')) throw new Error('Texture replacements must be PNG files.');
    if (!imagePath || !existsSync(imagePath)) throw new Error('PNG file not found.');
}

/**
 * The stock v0.19 engine can write an icon but corrupts the mixed YCoCg icon
 * subset. There is no safe runtime feature probe in that release, so only a
 * sibling fork build in dev or an explicitly marked packaged fork is allowed.
 */
export function hasVerifiedYcocgIconSupport(options: {
    binaryPath: string;
    appPath: string;
    packaged: boolean;
    markerExists: boolean;
}): boolean {
    // Tests supply Windows paths even when Vitest runs on Linux. More
    // importantly, this check is security-sensitive: compare both paths using
    // the semantics of the path we were passed, never the CI host's separator.
    const paths = /^[A-Za-z]:\\/.test(options.appPath) || options.binaryPath.includes('\\')
        ? win32
        : { resolve, sep };
    const siblingBuild = paths.resolve(options.appPath, '..', 'vpkmerge', 'target');
    const resolvedBinary = paths.resolve(options.binaryPath);
    return (!options.packaged && resolvedBinary.startsWith(siblingBuild + paths.sep)) || options.markerExists;
}

function assertYcocgIconSupport(): void {
    const binaryPath = vpkmergeBinaryPath();
    const markerPath = join(resolve(binaryPath, '..'), YCOCG_SAFE_MARKER);
    if (
        !hasVerifiedYcocgIconSupport({
            binaryPath,
            appPath: app.getAppPath(),
            packaged: app.isPackaged,
            markerExists: existsSync(markerPath),
        })
    ) {
        throw new Error(
            'Texture replacement requires the forked vpkmerge engine with the YCoCg icon fix. Build the sibling engine and run pnpm use-local-vpkmerge before packaging.'
        );
    }
}

export interface BuiltTextureReplacement {
    vpkPath: string;
}

/** Build one in-place texture override against the installed game's pak. */
export async function buildTextureReplacementVpk(
    deadlockPath: string,
    entryPath: string,
    imagePath: string
): Promise<BuiltTextureReplacement> {
    validateTextureReplacement(entryPath, imagePath);
    assertYcocgIconSupport();
    const dir = join(tmpdir(), `grimoire-foundry-texture-${randomUUID()}`);
    const vpkPath = join(dir, 'texture-replacement_dir.vpk');
    await fs.mkdir(dir, { recursive: true });
    try {
        await runVpkmerge([
            'icon',
            '--template-vpk', join(getCitadelPath(deadlockPath), 'pak01_dir.vpk'),
            '--set', `${entryPath}=${imagePath}`,
            '--encode-vpk', vpkPath,
        ], 120000);
        await verifyVpkOutput(vpkPath);
        return { vpkPath };
    } catch (err) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}

export async function cleanupTextureReplacementBuild(vpkPath: string): Promise<void> {
    await fs.rm(resolve(vpkPath, '..'), { recursive: true, force: true }).catch(() => {});
}
