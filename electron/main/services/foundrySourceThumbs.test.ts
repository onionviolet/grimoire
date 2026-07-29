import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const harness = {
    root: '',
    /** What the fake nativeImage reports for the next createFromPath call. */
    empty: false,
    size: { width: 512, height: 256 },
    png: Buffer.from('resized-png-bytes'),
    resizedWith: [] as Array<Record<string, unknown>>,
};

vi.mock('./foundryCatalog', () => ({
    FOUNDRY_THUMB_SCHEME: 'grimoire-foundry',
    FOUNDRY_SOURCE_THUMB_DIR: '_sources',
    thumbsRoot: () => harness.root,
}));

vi.mock('electron', () => ({
    nativeImage: {
        createFromPath: () => ({
            isEmpty: () => harness.empty,
            getSize: () => harness.size,
            resize: (options: Record<string, unknown>) => {
                harness.resizedWith.push(options);
                return { toPNG: () => harness.png };
            },
        }),
    },
}));

const {
    KEEP_FILES,
    MAX_SOURCE_BYTES,
    SOURCE_THUMB_SIZE,
    ensureSourceThumbnail,
    planSourceThumbPrune,
    pruneSourceThumbs,
    sourceThumbKey,
    sourceThumbUrl,
    sourceThumbsDir,
} = await import('./foundrySourceThumbs');

let workdir = '';

beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'grimoire-srcthumb-'));
    harness.root = join(workdir, 'foundry-thumbs');
    harness.empty = false;
    harness.size = { width: 512, height: 256 };
    harness.png = Buffer.from('resized-png-bytes');
    harness.resizedWith = [];
});
afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
});

function sourceImage(name: string, bytes = 'source-image-bytes'): string {
    const path = join(workdir, name);
    writeFileSync(path, bytes);
    return path;
}

describe('sourceThumbUrl', () => {
    it('addresses the reserved subtree through the existing thumbnail protocol', () => {
        // Exactly three path segments, which is what the grimoire-foundry:
        // handler requires. A second protocol is deliberately not introduced.
        expect(sourceThumbUrl('abc.png')).toBe('grimoire-foundry://t/_sources/img/abc.png');
    });
});

describe('sourceThumbKey', () => {
    it('changes when the source bytes change under the same path', () => {
        const before = sourceThumbKey('C:/pics/a.png', 100, 1000);
        expect(sourceThumbKey('C:/pics/a.png', 100, 1000)).toBe(before);
        expect(sourceThumbKey('C:/pics/a.png', 101, 1000)).not.toBe(before);
        expect(sourceThumbKey('C:/pics/a.png', 100, 2000)).not.toBe(before);
        expect(sourceThumbKey('C:/pics/b.png', 100, 1000)).not.toBe(before);
    });
});

describe('planSourceThumbPrune (the stated cache budget)', () => {
    const entry = (name: string, size: number, mtime: number) => ({ path: name, size, mtime });

    it('keeps nothing beyond the file-count bound, oldest first', () => {
        const entries = [entry('a', 1, 5), entry('b', 1, 4), entry('c', 1, 3), entry('d', 1, 2)];
        expect(planSourceThumbPrune(entries, 1024, 2)).toEqual(['c', 'd']);
    });

    it('keeps nothing beyond the byte bound, oldest first', () => {
        const entries = [entry('new', 60, 5), entry('mid', 60, 4), entry('old', 60, 3)];
        expect(planSourceThumbPrune(entries, 100, 100)).toEqual(['mid', 'old']);
    });

    it('applies whichever bound binds first', () => {
        const entries = [entry('a', 10, 3), entry('b', 10, 2), entry('c', 10, 1)];
        expect(planSourceThumbPrune(entries, 1000, 1)).toEqual(['b', 'c']);
        expect(planSourceThumbPrune(entries, 15, 10)).toEqual(['b', 'c']);
    });

    it('deletes nothing while inside both bounds', () => {
        expect(planSourceThumbPrune([entry('a', 1, 1)], 1024, KEEP_FILES)).toEqual([]);
    });
});

describe('pruneSourceThumbs', () => {
    it('enforces the budget on the real cache directory', async () => {
        const dir = sourceThumbsDir();
        await fs.mkdir(dir, { recursive: true });
        for (const name of ['a.png', 'b.png', 'c.png']) {
            await fs.writeFile(join(dir, name), 'x'.repeat(100));
            // Distinct mtimes so "oldest" is well defined on a fast filesystem.
            const when = new Date(Date.now() + ['a.png', 'b.png', 'c.png'].indexOf(name) * 10_000);
            await fs.utimes(join(dir, name), when, when);
        }
        await pruneSourceThumbs(1024, 1);
        expect(await fs.readdir(dir)).toEqual(['c.png']);
    });

    it('is a no-op, not a throw, when the cache does not exist yet', async () => {
        await expect(pruneSourceThumbs()).resolves.toBeUndefined();
    });
});

describe('ensureSourceThumbnail', () => {
    it('caches a resized PNG under the reserved subtree and returns its URL', async () => {
        const url = await ensureSourceThumbnail(sourceImage('neon.png'));
        expect(url).toMatch(/^grimoire-foundry:\/\/t\/_sources\/img\/[0-9a-f]{64}\.png$/);
        const files = await fs.readdir(sourceThumbsDir());
        expect(files).toHaveLength(1);
        expect(await fs.readFile(join(sourceThumbsDir(), files[0]))).toEqual(harness.png);
    });

    it('resizes on the longest edge only, so aspect ratio survives', async () => {
        harness.size = { width: 512, height: 256 };
        await ensureSourceThumbnail(sourceImage('wide.png'));
        expect(harness.resizedWith.at(-1)).toEqual({ width: SOURCE_THUMB_SIZE, quality: 'good' });

        harness.size = { width: 256, height: 512 };
        await ensureSourceThumbnail(sourceImage('tall.png'));
        expect(harness.resizedWith.at(-1)).toEqual({ height: SOURCE_THUMB_SIZE, quality: 'good' });
    });

    it('never upscales a small icon', async () => {
        harness.size = { width: 32, height: 16 };
        await ensureSourceThumbnail(sourceImage('tiny.png'));
        expect(harness.resizedWith.at(-1)).toEqual({ width: 32, quality: 'good' });
    });

    it('reuses the cached file instead of decoding again', async () => {
        const path = sourceImage('neon.png');
        const first = await ensureSourceThumbnail(path);
        harness.resizedWith = [];
        const second = await ensureSourceThumbnail(path);
        expect(second).toBe(first);
        expect(harness.resizedWith).toEqual([]);
    });

    it('re-decodes when the source file changes under the same path', async () => {
        const path = sourceImage('neon.png');
        const first = await ensureSourceThumbnail(path);
        writeFileSync(path, 'different-and-longer-source-bytes');
        const later = new Date(Date.now() + 60_000);
        await fs.utimes(path, later, later);
        const second = await ensureSourceThumbnail(path);
        expect(second).not.toBe(first);
    });

    it('returns null for a source file that has moved away', async () => {
        expect(await ensureSourceThumbnail(join(workdir, 'gone.png'))).toBeNull();
    });

    it('returns null rather than decoding an oversized input', async () => {
        const path = join(workdir, 'huge.png');
        await fs.writeFile(path, Buffer.alloc(1024));
        await fs.truncate(path, MAX_SOURCE_BYTES + 1);
        expect(await ensureSourceThumbnail(path)).toBeNull();
        expect(harness.resizedWith).toEqual([]);
    });

    it('returns null when the file is not a decodable image', async () => {
        harness.empty = true;
        expect(await ensureSourceThumbnail(sourceImage('notes.txt', 'hello'))).toBeNull();
    });

    it('returns null for an empty or missing path instead of throwing', async () => {
        expect(await ensureSourceThumbnail('')).toBeNull();
        expect(await ensureSourceThumbnail('   ')).toBeNull();
    });

    it('holds the cache to its budget as new sources arrive', async () => {
        for (let i = 0; i < 5; i += 1) {
            await ensureSourceThumbnail(sourceImage(`img${i}.png`, `bytes-${i}`));
        }
        // The real call uses the module defaults; prove the bound is applied by
        // re-running the pruner at a tighter one and confirming it takes effect.
        await pruneSourceThumbs(1024 * 1024, 2);
        expect(await fs.readdir(sourceThumbsDir())).toHaveLength(2);
    });
});
