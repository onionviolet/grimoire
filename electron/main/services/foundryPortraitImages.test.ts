import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

const harness = { userData: '' };
vi.mock('electron', () => ({ app: { getPath: () => harness.userData } }));

const {
    decodePortraitPngDataUrl,
    listFoundryPortraitImages,
    portraitEditsRoot,
    portraitImageNames,
    prunePortraitEdits,
    writeFoundryPortraitImage,
} = await import('./foundryPortraitImages');

/** Smallest thing that satisfies the PNG signature check. */
const pngBytes = (tail: string): Buffer =>
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(tail)]);
const pngDataUrl = (tail: string): string => `data:image/png;base64,${pngBytes(tail).toString('base64')}`;

beforeEach(() => {
    harness.userData = mkdtempSync(join(tmpdir(), 'grimoire-portrait-'));
});
afterEach(() => {
    rmSync(harness.userData, { recursive: true, force: true });
});

describe('decodePortraitPngDataUrl', () => {
    it('accepts a PNG data URL', () => {
        expect(decodePortraitPngDataUrl(pngDataUrl('body')).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    it('rejects a non-PNG media type, a non-data URL, and bytes that are not a PNG', () => {
        expect(() => decodePortraitPngDataUrl('data:image/jpeg;base64,AAAA')).toThrow(/not a PNG data URL/);
        expect(() => decodePortraitPngDataUrl('C:/art/mina.png')).toThrow(/not a PNG data URL/);
        expect(() => decodePortraitPngDataUrl(`data:image/png;base64,${Buffer.from('PK\u0003\u0004zip').toString('base64')}`))
            .toThrow(/not a PNG/);
    });
});

describe('writeFoundryPortraitImage', () => {
    it('writes the bytes under userData and returns the absolute path', async () => {
        const path = await writeFoundryPortraitImage(pngDataUrl('one'));
        expect(path.startsWith(portraitEditsRoot())).toBe(true);
        expect(await fs.readFile(path)).toEqual(pngBytes('one'));
    });

    it('is content addressed, so the same bake stages to one file', async () => {
        const first = await writeFoundryPortraitImage(pngDataUrl('same'));
        const second = await writeFoundryPortraitImage(pngDataUrl('same'));
        expect(second).toBe(first);
        expect(await fs.readdir(portraitEditsRoot())).toHaveLength(1);
    });

    it('prunes the cache to its stated budget, newest first', async () => {
        const older = await writeFoundryPortraitImage(pngDataUrl('older-payload'));
        await fs.utimes(older, new Date(1), new Date(1));
        const newer = await writeFoundryPortraitImage(pngDataUrl('newer'));

        // A budget that fits only the newest file: the older bake is dropped.
        await prunePortraitEdits((await fs.stat(newer)).size);
        expect(await fs.readdir(portraitEditsRoot())).toEqual([basename(newer)]);
    });
});


describe('original filenames beside the content hash (#261)', () => {
    it('records the picked name without changing the storage key', async () => {
        const first = await writeFoundryPortraitImage(pngDataUrl('same'), 'my-portrait.png');
        const second = await writeFoundryPortraitImage(pngDataUrl('same'), 'renamed-copy.png');

        // Same bytes stay one file: the name is display metadata, not identity.
        expect(second).toBe(first);
        const names = await portraitImageNames();
        expect(names[basename(first)]).toBe('my-portrait.png');
    });

    it('offers the name back with the image', async () => {
        const path = await writeFoundryPortraitImage(pngDataUrl('listed'), 'grey-talon-card.jpg');
        const listed = await listFoundryPortraitImages();
        const entry = listed.find((image) => image.path === path);
        expect(entry?.label).toBe('grey-talon-card.jpg');
    });

    it('leaves the label null when nothing was recorded', async () => {
        const path = await writeFoundryPortraitImage(pngDataUrl('unnamed'));
        const listed = await listFoundryPortraitImages();
        expect(listed.find((image) => image.path === path)?.label).toBeNull();
    });

    it('keeps the names when the images themselves are pruned', async () => {
        const path = await writeFoundryPortraitImage(pngDataUrl('doomed'), 'the-one-that-vanished.png');
        // Budget of zero evicts everything the pruner is allowed to touch.
        await prunePortraitEdits(0);

        await expect(fs.stat(path)).rejects.toThrow();
        // The surface that most needs the name is the one whose file is gone.
        expect((await portraitImageNames())[basename(path)]).toBe('the-one-that-vanished.png');
    });
});
