import { describe, expect, it } from 'vitest';
import { isPartialDownload, shouldPruneUpdaterFile, updaterPendingDir } from './updaterCache';

const DAY = 24 * 60 * 60 * 1000;

describe('isPartialDownload', () => {
    it('recognizes the half-written transfer shapes', () => {
        expect(isPartialDownload('Grimoire-Setup-1.25.171.exe.tmp')).toBe(true);
        expect(isPartialDownload('Grimoire-Setup-1.25.171.exe.part')).toBe(true);
        expect(isPartialDownload('temp-1234')).toBe(true);
    });

    it('does not mistake a finished installer for a partial', () => {
        expect(isPartialDownload('Grimoire-Setup-1.25.171.exe')).toBe(false);
        expect(isPartialDownload('Grimoire-1.25.171.AppImage')).toBe(false);
    });
});

describe('shouldPruneUpdaterFile', () => {
    it('keeps a recent installer so a fast relaunch does not force a re-download', () => {
        expect(shouldPruneUpdaterFile('Grimoire-Setup-1.25.171.exe', 2 * DAY)).toBe(false);
    });

    it('drops an installer once it is clearly stale', () => {
        expect(shouldPruneUpdaterFile('Grimoire-Setup-1.25.171.exe', 8 * DAY)).toBe(true);
    });

    // A partial is pure waste the moment its transfer stops, so it expires on a
    // much shorter clock than a usable installer.
    it('drops a partial download far sooner than a complete one', () => {
        expect(shouldPruneUpdaterFile('Grimoire-Setup-1.25.171.exe.tmp', 2 * DAY)).toBe(true);
        expect(shouldPruneUpdaterFile('Grimoire-Setup-1.25.171.exe', 2 * DAY)).toBe(false);
    });

    it('keeps a partial that is still plausibly in flight', () => {
        expect(shouldPruneUpdaterFile('Grimoire-Setup-1.25.171.exe.tmp', 60 * 1000)).toBe(false);
    });
});

describe('updaterPendingDir', () => {
    // The sweep refuses to run anywhere that is not shaped like the updater's
    // own cache, so this naming is load-bearing rather than cosmetic.
    it('resolves a path ending in <app name>-updater/pending', () => {
        const dir = updaterPendingDir('Grimoire');
        expect(dir).not.toBeNull();
        const parts = dir!.replace(/\\/g, '/').split('/');
        expect(parts.at(-1)).toBe('pending');
        expect(parts.at(-2)).toBe('Grimoire-updater');
    });
});
