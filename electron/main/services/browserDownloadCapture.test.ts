import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `attachBrowserDownloadCapture` reads `app.getPath('userData')` and
// `getMainWindow`/`openExternalSafe` come from `../index` (electron/main's
// entry point, which has heavy top-level Electron side effects on its own).
// Both are mocked so this file exercises only browserDownloadCapture's own
// logic, matching the project's existing convention for main-process service
// tests (see electron/main/services/priorityFolderFailure.test.ts).
const harness = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => harness.userData } }));
vi.mock('../index', () => ({
    getMainWindow: vi.fn(() => null),
    openExternalSafe: vi.fn(),
}));

import {
    allocateToolDownloadTempPath,
    attachBrowserDownloadCapture,
    classifyToolDownload,
    displayNameForDownload,
    shouldCaptureToolDownload,
    toolDownloadTempRoot,
} from './browserDownloadCapture';

function writeVpkFixture(path: string): void {
    const header = Buffer.alloc(64);
    header.writeUInt32LE(0x55aa1234, 0); // VPK_MAGIC
    header.writeUInt32LE(2, 4); // version 2
    writeFileSync(path, header);
}

describe('shouldCaptureToolDownload', () => {
    it('is true for a tool destination whose origin matches the live guest URL', () => {
        expect(
            shouldCaptureToolDownload(
                { kind: 'tool', origin: 'https://xkitkatcat.github.io' },
                'https://xkitkatcat.github.io/pimpmyhideout/'
            )
        ).toBe(true);
    });

    it('is false when the live guest URL has redirected to a different origin', () => {
        expect(
            shouldCaptureToolDownload(
                { kind: 'tool', origin: 'https://xkitkatcat.github.io' },
                'https://evil.example/page'
            )
        ).toBe(false);
    });

    it('is false when the live guest URL cannot be parsed', () => {
        expect(
            shouldCaptureToolDownload({ kind: 'tool', origin: 'https://xkitkatcat.github.io' }, 'not a url')
        ).toBe(false);
    });

    it('is false for every non-tool kind', () => {
        for (const kind of ['mod-host', 'reference', 'community-feed'] as const) {
            expect(
                shouldCaptureToolDownload({ kind, origin: 'https://example.com' }, 'https://example.com/')
            ).toBe(false);
        }
    });

    it('is false when the active kind is null', () => {
        expect(shouldCaptureToolDownload({ kind: null, origin: null }, 'https://example.com/')).toBe(false);
    });

    it('is false when kind is tool but no origin was pushed', () => {
        expect(shouldCaptureToolDownload({ kind: 'tool', origin: null }, 'https://example.com/')).toBe(false);
    });
});

describe('toolDownloadTempRoot', () => {
    it('resolves under the given userData directory, not the OS temp/Downloads folder', () => {
        const root = toolDownloadTempRoot('C:/Users/someone/AppData/Roaming/grimoire');
        expect(root).toBe(join('C:/Users/someone/AppData/Roaming/grimoire', 'browser-downloads'));
    });
});

describe('allocateToolDownloadTempPath', () => {
    it('returns distinct paths for two calls with the same suggested filename', () => {
        // Built with `join` (not a raw string) so the expected prefix uses
        // this OS's own separator convention before comparing.
        const root = join('C:', 'fake', 'root');
        const first = allocateToolDownloadTempPath(root, 'build.vpk');
        const second = allocateToolDownloadTempPath(root, 'build.vpk');
        expect(first).not.toBe(second);
        expect(first.startsWith(root)).toBe(true);
        expect(second.startsWith(root)).toBe(true);
        expect(first.endsWith('.download')).toBe(true);
        expect(second.endsWith('.download')).toBe(true);
    });
});

describe('displayNameForDownload', () => {
    it('passes a normal filename through unchanged', () => {
        expect(displayNameForDownload('hideout-build.vpk', 'Browser download')).toBe('hideout-build.vpk');
    });

    it('falls back for an empty name', () => {
        expect(displayNameForDownload('', 'Browser download')).toBe('Browser download');
    });

    it('falls back for an extensionless name', () => {
        expect(displayNameForDownload('download', 'Browser download')).toBe('Browser download');
    });

    it('reduces a name containing a path separator to its basename', () => {
        expect(displayNameForDownload('C:\\Users\\evil\\payload.vpk', 'Browser download')).toBe('payload.vpk');
        expect(displayNameForDownload('some/dir/build.vpk', 'Browser download')).toBe('build.vpk');
    });
});

describe('classifyToolDownload', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'browser-download-classify-'));
    });

    it('refuses a zero-byte file, reason mentions empty', () => {
        const path = join(dir, 'empty.download');
        writeFileSync(path, Buffer.alloc(0));
        const result = classifyToolDownload(path, 'Browser download');
        expect(result.ok).toBe(false);
        expect(!result.ok && result.reason.toLowerCase()).toContain('empty');
    });

    it('refuses a short non-VPK file, reason names the detected type', () => {
        const path = join(dir, 'notavpk.download');
        writeFileSync(path, Buffer.from([0x50, 0x4b, 0x03, 0x04])); // ZIP signature
        const result = classifyToolDownload(path, 'Pimp My Hideout download');
        expect(result.ok).toBe(false);
        expect(!result.ok && result.reason).toContain('ZIP archive');
    });

    it('accepts a file whose header is the VPK signature', () => {
        const path = join(dir, 'build.download');
        writeVpkFixture(path);
        const result = classifyToolDownload(path, 'Browser download');
        expect(result.ok).toBe(true);
    });
});

describe('attachBrowserDownloadCapture', () => {
    beforeEach(() => {
        harness.userData = mkdtempSync(join(tmpdir(), 'browser-download-attach-userdata-'));
    });

    it('registers will-download exactly once even when called twice with the same session', () => {
        const listeners: Array<(...args: unknown[]) => void> = [];
        const stubSession = {
            on: (event: string, listener: (...args: unknown[]) => void) => {
                if (event === 'will-download') listeners.push(listener);
            },
        } as unknown as Parameters<typeof attachBrowserDownloadCapture>[0];

        attachBrowserDownloadCapture(stubSession);
        attachBrowserDownloadCapture(stubSession);

        expect(listeners).toHaveLength(1);
    });
});
