import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DownloadItem, Session, WebContents } from 'electron';

// `attachBrowserDownloadCapture` reads `app.getPath('userData')` and
// `getMainWindow`/`openExternalSafe` come from `../index` (electron/main's
// entry point, which has heavy top-level Electron side effects on its own).
// Both are mocked so this file exercises only browserDownloadCapture's own
// logic, matching the project's existing convention for main-process service
// tests (see electron/main/services/priorityFolderFailure.test.ts).
const harness = vi.hoisted(() => ({ userData: '', mainWindow: null as unknown }));
vi.mock('electron', () => ({ app: { getPath: () => harness.userData } }));
vi.mock('../index', () => ({
    getMainWindow: vi.fn(() => harness.mainWindow),
    openExternalSafe: vi.fn(),
}));

// Lets one test (the "cannot be deleted" case) force a single `unlink` call
// to fail without touching filesystem permissions, which is unreliable
// cross-platform (notably on Windows). Every other path delegates to the
// real implementation, so this mock is inert unless a test opts in.
const unlinkControl = vi.hoisted(() => ({ failPath: null as string | null }));
vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return {
        ...actual,
        unlink: vi.fn(async (path: Parameters<typeof actual.unlink>[0]) => {
            if (typeof path === 'string' && path === unlinkControl.failPath) {
                throw new Error('EPERM: simulated unlink failure');
            }
            return actual.unlink(path);
        }),
    };
});

import { describeVpkRejection } from './vpk';
import {
    allocateToolDownloadTempPath,
    attachBrowserDownloadCapture,
    classifyToolDownload,
    displayNameForDownload,
    pendingToolDownloadIds,
    pendingToolDownloadPaths,
    setActiveDestination,
    shouldCaptureToolDownload,
    sweepToolDownloadTempRoot,
    toolDownloadTempRoot,
} from './browserDownloadCapture';
import type { BrowserToolDownloadEvent } from '../../../src/types/electron';

function writeVpkFixture(path: string): void {
    const header = Buffer.alloc(64);
    header.writeUInt32LE(0x55aa1234, 0); // VPK_MAGIC
    header.writeUInt32LE(2, 4); // version 2
    writeFileSync(path, header);
}

/** A stub `DownloadItem` whose `done` callback is captured (not fired by
 *  Electron) so a test can control exactly when the classification/cleanup
 *  continuation runs and await it, since `registerToolDownloadCompletion`'s
 *  listener is an async function that production code never awaits. */
function makeStubItem(filename: string, guestUrl: string): {
    item: DownloadItem;
    webContents: WebContents;
    getSavePath: () => string;
    triggerDone: (state: 'completed' | 'cancelled' | 'interrupted') => Promise<void>;
} {
    let savePath = '';
    let doneCb: ((event: unknown, state: string) => unknown) | null = null;
    const item = {
        getFilename: () => filename,
        getURL: () => guestUrl,
        setSavePath: (p: string) => { savePath = p; },
        getSavePath: () => savePath,
        once: (event: string, cb: (...args: unknown[]) => unknown) => {
            if (event === 'done') doneCb = cb;
        },
    } as unknown as DownloadItem;
    const webContents = { getURL: () => guestUrl } as unknown as WebContents;
    return {
        item,
        webContents,
        getSavePath: () => savePath,
        triggerDone: async (state) => {
            await doneCb?.({}, state);
        },
    };
}

/** Attaches the capture handler to a fresh stub session and returns the
 *  captured `will-download` listener, so a test can invoke it directly with
 *  synthesized `(event, item, webContents)` arguments. */
function attachAndCaptureListener(): (event: unknown, item: DownloadItem, webContents: WebContents) => void {
    let willDownloadListener: ((...args: unknown[]) => void) | null = null;
    const stubSession = {
        on: (event: string, listener: (...args: unknown[]) => void) => {
            if (event === 'will-download') willDownloadListener = listener;
        },
    } as unknown as Session;
    attachBrowserDownloadCapture(stubSession);
    if (!willDownloadListener) throw new Error('will-download listener was not registered');
    return willDownloadListener;
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
        expect(first.endsWith('.vpk')).toBe(true);
        expect(second.endsWith('.vpk')).toBe(true);
    });

    it('is independent of the suggested filename: no extension still yields the same shape of path', () => {
        const root = join('C:', 'fake', 'root');
        const withNoExtension = allocateToolDownloadTempPath(root, 'build-with-no-extension');
        expect(withNoExtension.startsWith(root)).toBe(true);
        expect(withNoExtension.endsWith('.vpk')).toBe(true);
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

describe('will-download tool capture: refusal and failure paths (D-10)', () => {
    let dir: string;
    let sendSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'browser-download-roundtrip-'));
        harness.userData = dir;
        sendSpy = vi.fn();
        harness.mainWindow = {
            isDestroyed: () => false,
            webContents: { isDestroyed: () => false, send: sendSpy },
        };
        setActiveDestination('tool', 'https://xkitkatcat.github.io', 'Pimp My Hideout');
    });

    function pushedEvents(): BrowserToolDownloadEvent[] {
        return sendSpy.mock.calls
            .filter(([channel]) => channel === 'browser:tool-download')
            .map(([, payload]) => payload as BrowserToolDownloadEvent);
    }

    /** Events after the synchronous `started` push every will-download
     *  capture now emits (Task 2) — this describe block asserts only the
     *  terminal (refused/ready/failed) outcome, not the in-flight push. */
    function terminalEvents(): BrowserToolDownloadEvent[] {
        return pushedEvents().filter((e) => e.status !== 'started');
    }

    it('refuses a ZIP-header file: pushed reason equals describeVpkRejection, temp file is gone, no ready is ever pushed', async () => {
        const willDownload = attachAndCaptureListener();
        const { item, webContents, getSavePath, triggerDone } = makeStubItem(
            'build.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );

        willDownload({}, item, webContents);
        writeFileSync(getSavePath(), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]));
        await triggerDone('completed');

        expect(existsSync(getSavePath())).toBe(false);
        const events = terminalEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe('refused');
        expect(events[0].reason).toBe(
            describeVpkRejection('build.vpk', { valid: false, format: 'zip', label: 'ZIP archive' })
        );
        expect(events.some((e) => e.status === 'ready')).toBe(false);
    });

    it('refuses a zero-byte file, reason equals describeVpkRejection for an empty file', async () => {
        const willDownload = attachAndCaptureListener();
        const { item, webContents, getSavePath, triggerDone } = makeStubItem(
            'empty.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );

        willDownload({}, item, webContents);
        writeFileSync(getSavePath(), Buffer.alloc(0));
        await triggerDone('completed');

        expect(existsSync(getSavePath())).toBe(false);
        const events = terminalEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe('refused');
        expect(events[0].reason).toBe(
            describeVpkRejection('empty.vpk', { valid: false, format: 'empty', label: 'empty file' })
        );
    });

    it('accepts a real VPK header: no refusal, status is ready, temp file is kept', async () => {
        const willDownload = attachAndCaptureListener();
        const { item, webContents, getSavePath, triggerDone } = makeStubItem(
            'build.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );

        willDownload({}, item, webContents);
        writeVpkFixture(getSavePath());
        await triggerDone('completed');

        expect(existsSync(getSavePath())).toBe(true);
        const events = terminalEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe('ready');
        expect(events[0].name).toBe('build.vpk');
    });

    it('a non-completed terminal state deletes the temp file, pushes failed, and never shows a confirm dialog (no ready/refused)', async () => {
        const willDownload = attachAndCaptureListener();
        const { item, webContents, getSavePath, triggerDone } = makeStubItem(
            'build.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );

        willDownload({}, item, webContents);
        writeVpkFixture(getSavePath());
        await triggerDone('interrupted');

        expect(existsSync(getSavePath())).toBe(false);
        const events = terminalEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe('failed');
        expect(events.some((e) => e.status === 'ready' || e.status === 'refused')).toBe(false);
    });

    it('pushes started as the last statement of the tool branch, before any file classification runs', () => {
        const willDownload = attachAndCaptureListener();
        const { item, webContents, getSavePath } = makeStubItem(
            'build.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );

        willDownload({}, item, webContents);

        // No fixture bytes were ever written to getSavePath() and `done` was
        // never triggered, so classifyToolDownload cannot have run yet; the
        // only thing that could have been pushed synchronously is `started`.
        const events = pushedEvents();
        expect(events).toHaveLength(1);
        expect(events[0].status).toBe('started');
        expect(events[0].tool).toBe('Pimp My Hideout');
        expect(existsSync(getSavePath())).toBe(false);
    });
});

describe('replace-newest: only one pending tool download disclosure at a time', () => {
    let dir: string;
    let sendSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'browser-download-replace-'));
        harness.userData = dir;
        sendSpy = vi.fn();
        harness.mainWindow = {
            isDestroyed: () => false,
            webContents: { isDestroyed: () => false, send: sendSpy },
        };
        setActiveDestination('tool', 'https://xkitkatcat.github.io', 'Pimp My Hideout');
    });

    function pushedEvents(): BrowserToolDownloadEvent[] {
        return sendSpy.mock.calls
            .filter(([channel]) => channel === 'browser:tool-download')
            .map(([, payload]) => payload as BrowserToolDownloadEvent);
    }

    it('two consecutive captures produce a replaced push for the first id; the first temp path is gone and the pending map holds exactly one entry', async () => {
        const willDownload = attachAndCaptureListener();

        const first = makeStubItem('first.vpk', 'https://xkitkatcat.github.io/pimpmyhideout/');
        willDownload({}, first.item, first.webContents);
        writeVpkFixture(first.getSavePath());
        await first.triggerDone('completed');

        const firstReady = pushedEvents().find((e) => e.status === 'ready');
        expect(firstReady).toBeDefined();
        const firstId = firstReady!.id;
        const firstTempPath = first.getSavePath();

        const second = makeStubItem('second.vpk', 'https://xkitkatcat.github.io/pimpmyhideout/');
        willDownload({}, second.item, second.webContents);
        writeVpkFixture(second.getSavePath());
        await second.triggerDone('completed');

        expect(existsSync(firstTempPath)).toBe(false);
        expect(existsSync(second.getSavePath())).toBe(true);

        const ids = pendingToolDownloadIds();
        expect(ids).toHaveLength(1);
        expect(ids).not.toContain(firstId);

        const replaced = pushedEvents().filter((e) => e.status === 'replaced');
        expect(replaced.some((e) => e.id === firstId && e.tool === 'Pimp My Hideout')).toBe(true);
    });
});

describe('sweepToolDownloadTempRoot (WR-05)', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'browser-download-sweep-'));
        unlinkControl.failPath = null;
    });

    it('sweeping a root that does not exist returns 0 and does not throw', async () => {
        const missing = join(dir, 'does-not-exist');
        await expect(sweepToolDownloadTempRoot(missing)).resolves.toBe(0);
    });

    it('sweeping an empty root returns 0', async () => {
        await expect(sweepToolDownloadTempRoot(dir)).resolves.toBe(0);
    });

    it('sweeping a root holding three plain files deletes all three and returns 3', async () => {
        writeFileSync(join(dir, 'a.download'), 'a');
        writeFileSync(join(dir, 'b.download'), 'b');
        writeFileSync(join(dir, 'c.download'), 'c');

        await expect(sweepToolDownloadTempRoot(dir)).resolves.toBe(3);
        expect(readdirSync(dir)).toHaveLength(0);
    });

    it('a second sweep immediately after the first returns 0 and leaves the directory in the same state', async () => {
        writeFileSync(join(dir, 'a.download'), 'a');
        writeFileSync(join(dir, 'b.download'), 'b');

        await expect(sweepToolDownloadTempRoot(dir)).resolves.toBe(2);
        expect(readdirSync(dir)).toHaveLength(0);

        await expect(sweepToolDownloadTempRoot(dir)).resolves.toBe(0);
        expect(readdirSync(dir)).toHaveLength(0);
    });

    it('a subdirectory inside the root survives the sweep and is not recursed into', async () => {
        const subdir = join(dir, 'nested');
        mkdirSync(subdir);
        const nestedFile = join(subdir, 'inside.download');
        writeFileSync(nestedFile, 'inside');
        writeFileSync(join(dir, 'orphan.download'), 'orphan');

        const deleted = await sweepToolDownloadTempRoot(dir);

        expect(deleted).toBe(1);
        expect(existsSync(subdir)).toBe(true);
        expect(existsSync(nestedFile)).toBe(true);
        expect(existsSync(join(dir, 'orphan.download'))).toBe(false);
    });

    it('a path passed as protected survives the sweep even though it is a plain file in the root', async () => {
        const protectedPath = join(dir, 'keep.download');
        const orphanPath = join(dir, 'orphan.download');
        writeFileSync(protectedPath, 'keep');
        writeFileSync(orphanPath, 'orphan');

        const deleted = await sweepToolDownloadTempRoot(dir, [protectedPath]);

        expect(deleted).toBe(1);
        expect(existsSync(protectedPath)).toBe(true);
        expect(existsSync(orphanPath)).toBe(false);
    });

    it('by default the protected set is whatever the live pending map holds: a pending file survives, a non-pending file does not', async () => {
        harness.userData = dir;
        setActiveDestination('tool', 'https://xkitkatcat.github.io', 'Pimp My Hideout');
        const willDownload = attachAndCaptureListener();
        const root = toolDownloadTempRoot(dir);

        const { item, webContents, getSavePath, triggerDone } = makeStubItem(
            'build.vpk',
            'https://xkitkatcat.github.io/pimpmyhideout/'
        );
        willDownload({}, item, webContents);
        writeVpkFixture(getSavePath());
        await triggerDone('completed');

        // Registered through the real will-download harness rather than
        // reaching into module state, so this proves the default wiring
        // (sweepToolDownloadTempRoot's own pendingToolDownloadPaths()
        // default), not just the explicit-parameter path above.
        expect(pendingToolDownloadPaths()).toContain(getSavePath());

        const orphanPath = join(root, 'orphan.download');
        writeFileSync(orphanPath, 'orphan');

        const deleted = await sweepToolDownloadTempRoot(root);

        expect(deleted).toBe(1);
        expect(existsSync(getSavePath())).toBe(true);
        expect(existsSync(orphanPath)).toBe(false);
    });

    it('a file that cannot be deleted does not abort the sweep: the remaining entries are still processed', async () => {
        const stubbornPath = join(dir, 'stubborn.download');
        const orphanPath = join(dir, 'orphan.download');
        writeFileSync(stubbornPath, 'stubborn');
        writeFileSync(orphanPath, 'orphan');
        unlinkControl.failPath = stubbornPath;

        const deleted = await sweepToolDownloadTempRoot(dir);

        expect(deleted).toBe(1);
        expect(existsSync(stubbornPath)).toBe(true);
        expect(existsSync(orphanPath)).toBe(false);
    });

    // Bonus, not load-bearing: the directory case above already proves the
    // isFile gate on every platform. Creating a symlink on Windows needs
    // Developer Mode, so this is guarded rather than required.
    it.skipIf(process.platform === 'win32')(
        'a symlink entry in the root is skipped and never followed',
        async () => {
            const targetPath = join(dir, 'target.download');
            writeFileSync(targetPath, 'target');
            const linkPath = join(dir, 'link.download');
            try {
                symlinkSync(targetPath, linkPath);
            } catch {
                // Symlink creation can still fail in a locked-down sandbox
                // even off Windows; skip rather than fail this bonus case.
                return;
            }
            const orphanPath = join(dir, 'orphan.download');
            writeFileSync(orphanPath, 'orphan');

            const deleted = await sweepToolDownloadTempRoot(dir);

            expect(deleted).toBe(1);
            expect(existsSync(linkPath)).toBe(true);
            expect(existsSync(targetPath)).toBe(true);
            expect(existsSync(orphanPath)).toBe(false);
        }
    );
});
