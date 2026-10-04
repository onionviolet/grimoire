import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createServer } from 'http';
const h = vi.hoisted(() => ({ root: '' }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => h.root }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), validateDownloadUrl: () => {} }));
import { downloadCachedArchive } from './downloadCache';
afterEach(async () => { if (h.root) await fs.rm(h.root, { recursive: true, force: true }); });
describe('verified completed archive cache', () => {
  it('reuses completed bytes without another network request and rejects a changed cached blob', async () => {
    h.root = await fs.mkdtemp(join(await fs.realpath(tmpdir()), 'grimoire-cache-test-'));
    const body = Buffer.alloc(2048, 42); let requests = 0;
    const server = createServer((_request, response) => { requests++; response.writeHead(200, { 'Content-Length': body.length, ETag: '"cache-v1"' }); response.end(body); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as import('net').AddressInfo;
    const url = `http://127.0.0.1:${address.port}/archive.zip`;
    try {
      await downloadCachedArchive(url, join(h.root, 'first.zip'), body.length, { onProgress: () => {} });
      await downloadCachedArchive(url, join(h.root, 'second.zip'), body.length, { onProgress: () => {} });
      expect(requests).toBe(1); expect(await fs.readFile(join(h.root, 'second.zip'))).toEqual(body);
      const blobs = join(h.root, 'download-cache/blobs');
      await fs.writeFile(join(blobs, (await fs.readdir(blobs))[0]), Buffer.alloc(2048, 0));
      await downloadCachedArchive(url, join(h.root, 'third.zip'), body.length, { onProgress: () => {} });
      expect(requests).toBe(2); expect(await fs.readFile(join(h.root, 'third.zip'))).toEqual(body);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
