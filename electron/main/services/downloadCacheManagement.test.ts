import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
const h = vi.hoisted(() => ({ root: '', retryable: false }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => h.root }));
vi.mock('./downloadJobs', () => ({ getDownloadJobs: () => h.retryable ? [{ state: 'paused' }] : [] }));
import { cleanDownloadCache, previewDownloadCache, withArchiveCacheUse } from './downloadCacheManagement';
const id = 'a'.repeat(64);
beforeEach(async () => {
  h.root = await fs.mkdtemp(join(await fs.realpath(tmpdir()), 'grimoire-cache-review-')); h.retryable = false;
  await fs.mkdir(join(h.root, 'download-cache/blobs'), { recursive: true });
  await fs.writeFile(join(h.root, 'download-cache/blobs', id), 'cache copy');
  await fs.writeFile(join(h.root, 'original.vpk'), 'installed original');
});
afterEach(async () => fs.rm(h.root, { recursive: true, force: true }));
describe('reviewed cache cleanup', () => {
  it('removes only reviewed cached copies and retains retryable partials, originals and unrecognized files', async () => {
    const partial = join(h.root, 'download-cache', `${id}.part`);
    await fs.writeFile(partial, 'partial'); await fs.utimes(partial, 1, 1); h.retryable = true;
    await fs.writeFile(join(h.root, 'download-cache', 'user-notes.txt'), 'keep');
    const preview = await previewDownloadCache();
    expect(preview.items.find(item => item.kind === 'partial')).toMatchObject({ removable: false, reason: 'retryable' });
    expect((await cleanDownloadCache(preview.reviewToken)).removed).toBe(1);
    expect(await fs.readFile(partial, 'utf8')).toBe('partial');
    expect(await fs.readFile(join(h.root, 'original.vpk'), 'utf8')).toBe('installed original');
    expect(await fs.readFile(join(h.root, 'download-cache/user-notes.txt'), 'utf8')).toBe('keep');
  });
  it('rejects stale inventories and cleanup during transfers', async () => {
    const preview = await previewDownloadCache();
    await fs.writeFile(join(h.root, 'download-cache/blobs', id), 'changed bytes');
    await expect(cleanDownloadCache(preview.reviewToken)).rejects.toThrow('stale');
    await withArchiveCacheUse(async () => {
      const busy = await previewDownloadCache(); expect(busy.items.every(item => !item.removable)).toBe(true);
      await expect(cleanDownloadCache(busy.reviewToken)).rejects.toThrow('in use');
    });
    expect(await fs.readFile(join(h.root, 'download-cache/blobs', id), 'utf8')).toBe('changed bytes');
  });
  it('skips symbolic links and reclaims only old orphan partials', async () => {
    const partial = join(h.root, 'download-cache', `${id}.part`); await fs.writeFile(partial, 'partial');
    const recent = await previewDownloadCache(); expect(recent.items.find(item => item.kind === 'partial')?.removable).toBe(false);
    await fs.utimes(partial, 1, 1);
    await fs.symlink(join(h.root, 'original.vpk'), join(h.root, 'download-cache/blobs', 'b'.repeat(64)));
    const old = await previewDownloadCache(); expect(old.items).toHaveLength(2);
    await cleanDownloadCache(old.reviewToken);
    expect(await fs.readFile(join(h.root, 'original.vpk'), 'utf8')).toBe('installed original');
  });
});
