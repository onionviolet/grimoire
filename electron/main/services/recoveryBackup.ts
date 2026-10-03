import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { getUserDataPath } from '../utils/paths';
import { fingerprintFile } from './fileMatch';

export const recoveryDirectory = () => join(getUserDataPath(), 'profile-recovery');
const blobPath = (hash: string) => {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid recovery hash');
  return join(recoveryDirectory(), 'blobs', hash);
};
/** Reject symlink components, including parents. Recovery never follows a redirected root. */
export async function assertRecoveryPath(path: string): Promise<void> {
  const absolute = resolve(path);
  let current = absolute;
  while (true) {
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Recovery path contains a symbolic link');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
export function isWithinRecoveryRoot(path: string, root: string): boolean {
  return resolve(path).startsWith(resolve(root) + sep);
}
export async function retainRecoveryFile(path: string): Promise<string> {
  await assertRecoveryPath(path);
  const hash = (await fingerprintFile(path)).sha256;
  const target = blobPath(hash);
  await assertRecoveryPath(target);
  await fs.mkdir(dirname(target), { recursive: true });
  if (await hasRecoveryFile(hash)) return hash;
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.copyFile(path, temp);
    if ((await fingerprintFile(temp)).sha256 !== hash) throw new Error('Recovery source changed during capture');
    await fs.rename(temp, target);
  } finally { await fs.unlink(temp).catch(() => {}); }
  return hash;
}
export async function hasRecoveryFile(hash: string): Promise<boolean> {
  const path = blobPath(hash);
  await assertRecoveryPath(path);
  try { return (await fingerprintFile(path)).sha256 === hash; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function placeRecoveryFile(hash: string, target: string, validateBeforeRename?: () => Promise<void>): Promise<void> {
  if (!await hasRecoveryFile(hash)) throw new Error('Retained recovery bytes are missing or changed');
  await assertRecoveryPath(target);
  await fs.mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.copyFile(blobPath(hash), temp);
    if ((await fingerprintFile(temp)).sha256 !== hash) throw new Error('Retained recovery bytes changed during copy');
    await assertRecoveryPath(target);
    await validateBeforeRename?.();
    await fs.rename(temp, target);
  } finally { await fs.unlink(temp).catch(() => {}); }
}
export async function writeRecoveryJson(path: string, value: unknown): Promise<void> {
  await assertRecoveryPath(path);
  await fs.mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temp, 'w');
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, path);
  } finally { await fs.unlink(temp).catch(() => {}); }
}

/** Kept recovery points and the pending journal own blobs. Unreferenced copies can be reclaimed. */
export async function pruneRecoveryFiles(keep: Set<string>): Promise<void> {
  const root = join(recoveryDirectory(), 'blobs');
  await assertRecoveryPath(root);
  const names = await fs.readdir(root).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of names) if (/^[0-9a-f]{64}$/.test(name) && !keep.has(name)) await fs.unlink(join(root, name));
}
