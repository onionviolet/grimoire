import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getUserDataPath } from '../utils/paths';
import { assertRecoveryPath } from './recoveryBackup';
import { getDownloadJobs } from './downloadJobs';
import type { DownloadCachePreview, DownloadCacheCleanup } from '../../../src/types/downloadCache';

let users = 0;
let maintenance: Promise<DownloadCacheCleanup> | null = null;
/** Transfers and cleanup share ownership; a transfer never starts inside a cleanup. */
export async function withArchiveCacheUse<T>(work: () => Promise<T>): Promise<T> {
  while (maintenance) await maintenance.catch(() => {});
  users++;
  try { return await work(); } finally { users--; }
}
const rootPath = () => join(getUserDataPath(), 'download-cache');
async function inspect() {
  const root = rootPath();
  await assertRecoveryPath(root);
  const retryable = getDownloadJobs().some(job => ['queued', 'downloading', 'retrying', 'paused', 'failed'].includes(job.state));
  const items: DownloadCachePreview['items'] = [];
  const stamps: unknown[] = [];
  for (const folder of ['', 'blobs']) {
    const path = join(root, folder);
    await assertRecoveryPath(path);
    const entries = await fs.readdir(path, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile()) continue;
      const archive = folder === 'blobs' && /^[a-f0-9]{64}$/.test(entry.name);
      const partial = folder === '' && /^[a-f0-9]{64}\.part(?:\.json)?$/.test(entry.name);
      const metadata = folder === '' && /^[a-f0-9]{64}\.json$/.test(entry.name);
      if (!archive && !partial && !metadata) continue;
      const file = join(path, entry.name);
      await assertRecoveryPath(file);
      const stat = await fs.lstat(file, { bigint: true });
      if (!stat.isFile()) throw new Error('Download cache changed during review');
      const recent = Date.now() - Number(stat.mtimeMs) < 7 * 86400000;
      const reason = users ? 'in-use' : partial && retryable ? 'retryable' : partial && recent ? 'recent' : 'copy';
      const name = folder ? `${folder}/${entry.name}` : entry.name;
      items.push({ name, bytes: Number(stat.size), kind: archive ? 'archive' : partial ? 'partial' : 'metadata', removable: reason === 'copy', reason });
      stamps.push([name, String(stat.ino), String(stat.size), String(stat.mtimeNs), String(stat.ctimeNs), reason]);
      if (items.length > 5000) throw new Error('Download cache inventory exceeds its review limit');
    }
  }
  const preview: DownloadCachePreview = { items, bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    reviewToken: createHash('sha256').update(JSON.stringify({ root, stamps })).digest('hex') };
  return preview;
}
export async function previewDownloadCache(): Promise<DownloadCachePreview> {
  if (maintenance) await maintenance;
  return inspect();
}
export function cleanDownloadCache(reviewToken: string): Promise<DownloadCacheCleanup> {
  if (maintenance || users) return Promise.reject(new Error('Download cache is currently in use'));
  // Install the gate synchronously, before the first filesystem await.
  maintenance = Promise.resolve().then(async () => {
    const preview = await inspect();
    if (preview.reviewToken !== reviewToken) throw new Error('Download cache review is stale. Review again before cleanup.');
    const result: DownloadCacheCleanup = { removed: 0, bytesFreed: 0, failed: 0 };
    for (const item of preview.items.filter(item => item.removable)) {
      const path = join(rootPath(), item.name);
      await assertRecoveryPath(path);
      try { await fs.unlink(path); result.removed++; result.bytesFreed += item.bytes; }
      catch { result.failed++; }
    }
    return result;
  }).finally(() => { maintenance = null; });
  return maintenance;
}
