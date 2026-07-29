// Download-cache housekeeping for electron-updater.
//
// electron-updater downloads into <platform cache>/<app name>-updater/pending
// and never prunes it. A user who accepts ten updates keeps ten full installers
// (roughly 100 MB each on Windows), plus any partial downloads left behind when
// a transfer died midway. Nothing in electron-updater's public API clears this,
// so Grimoire sweeps it.
//
// Kept free of electron and electron-updater imports on purpose: those pull a
// live app instance at module load, which would make the age policy and the
// path guard below untestable.
import { promises as fsp } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Ages are deliberately generous. At startup a pending installer is usually
// stale (it either already installed, or the user declined it), but a fast
// relaunch after a crash could catch a download that is still wanted, and
// deleting that only costs a re-download. The thresholds make that rare rather
// than relying on being clever about it.
const INSTALLER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PARTIAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** A half-written transfer rather than a usable installer. These are pure
 *  waste the moment their download stops, so they expire far sooner. */
export function isPartialDownload(name: string): boolean {
    return /\.(tmp|part|download)$/i.test(name) || name.startsWith('temp-');
}

/** Pure prune decision, so the age policy is testable without touching disk. */
export function shouldPruneUpdaterFile(name: string, ageMs: number): boolean {
    return ageMs > (isPartialDownload(name) ? PARTIAL_MAX_AGE_MS : INSTALLER_MAX_AGE_MS);
}

/** Where electron-updater keeps its downloads, mirroring its own resolution.
 *  Returns null when the platform cache root cannot be determined, in which
 *  case the sweep is skipped rather than guessed at. */
export function updaterPendingDir(appName: string): string | null {
    const home = homedir();
    if (!home && !process.env.LOCALAPPDATA && !process.env.XDG_CACHE_HOME) return null;
    const root =
        process.platform === 'win32'
            ? process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
            : process.platform === 'darwin'
              ? join(home, 'Library', 'Application Support', 'Caches')
              : process.env.XDG_CACHE_HOME || join(home, '.cache');
    return join(root, `${appName}-updater`, 'pending');
}

/** Refuse to sweep anything that is not recognisably the updater's own pending
 *  directory. A wrong cache-root guess must degrade to doing nothing, never to
 *  deleting a real user directory. */
export function isSafeToSweep(dir: string): boolean {
    const parts = dir.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.at(-1) === 'pending' && (parts.at(-2)?.endsWith('-updater') ?? false);
}

/** Best-effort prune of stale update downloads. Never throws and never blocks
 *  startup: losing a sweep only costs disk, while failing a launch costs the
 *  app. Returns how many entries were removed (for logging and tests). */
export async function pruneUpdaterCache(appName: string, now = Date.now()): Promise<number> {
    const dir = updaterPendingDir(appName);
    if (!dir || !isSafeToSweep(dir)) return 0;
    let entries: string[];
    try {
        entries = await fsp.readdir(dir);
    } catch {
        return 0; // no cache yet, or unreadable: nothing to do either way
    }
    let removed = 0;
    for (const name of entries) {
        const target = join(dir, name);
        try {
            const stats = await fsp.stat(target);
            if (!shouldPruneUpdaterFile(name, now - stats.mtimeMs)) continue;
            await fsp.rm(target, { recursive: true, force: true });
            removed++;
        } catch {
            // A file held open by another process, or removed underneath us.
            // Skip it; the next launch tries again.
        }
    }
    return removed;
}
