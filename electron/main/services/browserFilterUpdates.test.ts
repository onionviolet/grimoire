import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const context = vi.hoisted(() => ({ root: '' }));
vi.mock('electron', () => ({ app: { getPath: () => context.root } }));
vi.mock('./rateLimiter', () => ({ githubRateLimiter: { acquire: vi.fn().mockResolvedValue(undefined) } }));
import { fetchFilterUpdate, saveFilterUpdate, readFilterUpdate, FILTER_ASSETS } from './browserFilterUpdates';
const revision = 'a'.repeat(40);
const bundle = { filters: '||ads.test^', resources: '{"scriptlets":[],"redirects":[]}',
    info: { revision, fetchedAt: '2026-10-07T12:00:00Z', source: 'updated' as const } };
beforeEach(async () => { context.root = await mkdtemp(join(tmpdir(), 'grimoire-filter-update-')); });
afterEach(async () => { await rm(context.root, { recursive: true, force: true }); });
describe('Browser filter updates', () => {
    it('stores and verifies one atomic generation and rejects changed bytes', async () => {
        expect(await readFilterUpdate()).toBeNull();
        await saveFilterUpdate(bundle);
        expect(await readFilterUpdate()).toEqual(bundle);
        const path = join(context.root, 'browser-filter-update.json');
        const record = JSON.parse(await readFile(path, 'utf8'));
        record.bundle.filters = '||changed.test^';
        await writeFile(path, JSON.stringify(record));
        await expect(readFilterUpdate()).rejects.toThrow('invalid');
    });
    it('does not replace an existing generation with an oversized write', async () => {
        await saveFilterUpdate(bundle);
        await expect(saveFilterUpdate({ ...bundle, filters: 'x'.repeat(25 * 1024 * 1024) })).rejects.toThrow('size limit');
        expect(await readFilterUpdate()).toEqual(bundle);
    });
    it('resolves one revision and pins every asset request to it', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
            const address = String(url);
            if (address.includes('api.github.com')) return new Response(JSON.stringify({ sha: revision }));
            if (address.endsWith('resources.json')) return new Response(bundle.resources);
            return new Response('! filter fixture\n' + '||ads.test^\n'.repeat(11_000));
        });
        const result = await fetchFilterUpdate(fetcher);
        expect(result.info.revision).toBe(revision);
        expect(fetcher).toHaveBeenCalledTimes(FILTER_ASSETS.length + 2);
        expect(fetcher.mock.calls.slice(1).every(([url]) => String(url).includes(`/${revision}/`))).toBe(true);
        expect(await readFilterUpdate()).toBeNull();
    });
    it('rejects a failed or truncated source without changing the saved generation', async () => {
        await saveFilterUpdate(bundle);
        const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response('offline', { status: 503 }));
        await expect(fetchFilterUpdate(failed)).rejects.toThrow('503');
        const truncated = vi.fn<typeof fetch>().mockImplementation(async url =>
            new Response(String(url).includes('api.github.com') ? JSON.stringify({ sha: revision }) : '<html>bad response</html>'));
        await expect(fetchFilterUpdate(truncated)).rejects.toThrow('truncated');
        expect(await readFilterUpdate()).toEqual(bundle);
    });
});
