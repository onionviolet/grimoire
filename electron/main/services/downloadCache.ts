import { promises as fs, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { getUserDataPath } from '../utils/paths';
import { assertRecoveryPath, writeRecoveryJson } from './recoveryBackup';
import { downloadTransfer, type DownloadTransferOptions } from './downloadTransfer';
import { validateDownloadUrl, validateFileSize } from './security';

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
/** Stable partials live outside disposable extraction directories. Completed bytes are content-addressed. */
export async function downloadCachedArchive(url: string, destinationPath: string, expectedSize: number, options: Omit<DownloadTransferOptions, 'candidateUrls' | 'destinationPath'>, transfer?: (partial: string, metadata: string, identity: string) => Promise<void>): Promise<void> {
  validateDownloadUrl(url);
  const root = join(getUserDataPath(), 'download-cache');
  await assertRecoveryPath(root); await fs.mkdir(join(root, 'blobs'), { recursive: true });
  const id = createHash('sha256').update(url).digest('hex');
  const partial = join(root, `${id}.part`), completed = join(root, `${id}.json`);
  try {
    const saved = JSON.parse(await fs.readFile(completed, 'utf8')) as { sha256: string; size: number };
    if (!/^[a-f0-9]{64}$/.test(saved.sha256)) throw new Error('Invalid archive cache');
    const blob = join(root, 'blobs', saved.sha256);
    await assertRecoveryPath(blob);
    const bytes = (await fs.stat(blob)).size;
    validateFileSize(expectedSize, bytes);
    if (bytes !== saved.size || expectedSize > 0 && bytes !== expectedSize) throw new Error('Cached archive size changed');
    if (await hashFile(blob) !== saved.sha256) throw new Error('Archive cache changed');
    await fs.copyFile(blob, destinationPath); options.onProgress(saved.size, saved.size); return;
  } catch (error) {
    if (['EACCES', 'EPERM', 'EIO'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
  }
  if (transfer) await transfer(partial, `${partial}.json`, id);
  else await downloadTransfer({ ...options, candidateUrls: [url], destinationPath: partial, resumeMetadataPath: `${partial}.json`, resumeIdentity: id, retryCount: 2 });
  const size = (await fs.stat(partial)).size;
  validateFileSize(expectedSize, size);
  if (expectedSize > 0 && size !== expectedSize) {
    await fs.unlink(partial); await fs.unlink(`${partial}.json`).catch(() => {});
    throw new Error('Downloaded archive size did not match its source');
  }
  const sha256 = await hashFile(partial), blob = join(root, 'blobs', sha256);
  await assertRecoveryPath(blob);
  await fs.rename(partial, blob);
  await writeRecoveryJson(completed, { sha256, size });
  await fs.unlink(`${partial}.json`).catch(() => {});
  await fs.copyFile(blob, destinationPath);
  // Cache files are copies, never the installed or retained recovery originals.
  const cached: Array<{ path: string; bytes: number; time: number }> = [];
  for (const entry of await fs.readdir(join(root, 'blobs'), { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const path = join(root, 'blobs', entry.name), stat = await fs.stat(path);
    cached.push({ path, bytes: stat.size, time: stat.mtimeMs });
  }
  let total = cached.reduce((sum, file) => sum + file.bytes, 0);
  for (const file of cached.sort((a, b) => a.time - b.time)) {
    if (total <= 512 * 1024 * 1024) break;
    if (file.path === blob) continue;
    await fs.unlink(file.path).catch(() => {}); total -= file.bytes;
  }
}
