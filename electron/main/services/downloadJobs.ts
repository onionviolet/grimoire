import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { isAbsolute, join } from 'path';
import { getUserDataPath } from '../utils/paths';
import { validateDownloadUrl } from './security';
import type { DownloadJob, DownloadJobState } from '../../../src/types/downloadJobs';
import type { DownloadModArgs } from '../../../src/types/electron';

const file = () => join(getUserDataPath(), 'download-jobs.json');
let jobs: DownloadJob[] | undefined;
let loadedPath: string | undefined;
export function getDownloadJobs(): DownloadJob[] {
  if (loadedPath !== file()) { loadedPath = file(); jobs = undefined; }
  if (!jobs) {
    const parsed: unknown = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : [];
    if (!Array.isArray(parsed) || parsed.length > 500) throw new Error('Invalid saved download queue');
    jobs = parsed.map((job: DownloadJob) => {
      if (!job || !/^[a-f0-9]{64}$/.test(job.id) || !isAbsolute(job.gamePath) || !job.args || !Number.isSafeInteger(job.args.modId) || !Number.isSafeInteger(job.args.fileId)
          || typeof job.args.fileName !== 'string' || job.args.fileName.length > 1024 || !['queued', 'downloading', 'retrying', 'paused', 'failed', 'cancelled', 'completed'].includes(job.state)) throw new Error('Invalid saved download job');
      if (job.directUrl) validateDownloadUrl(job.directUrl);
      return { ...job, state: ['queued', 'downloading', 'retrying'].includes(job.state) ? 'paused' : job.state };
    });
  }
  return jobs.map(job => ({ ...job, args: { ...job.args } }));
}
function persist(next: DownloadJob[]): void {
  mkdirSync(getUserDataPath(), { recursive: true });
  const temp = `${file()}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(next)); renameSync(temp, file()); jobs = next;
}
export function saveDownloadJob(gamePath: string, args: DownloadModArgs, directUrl?: string): string {
  const id = createHash('sha256').update(JSON.stringify(directUrl ? { gamePath, directUrl } : { gamePath, modId: args.modId, fileId: args.fileId })).digest('hex');
  const next = getDownloadJobs().filter(job => job.id !== id);
  if (next.filter(job => !['completed', 'cancelled'].includes(job.state)).length >= 400) throw new Error('The saved download queue is full');
  next.push({ id, gamePath, args, directUrl, state: 'queued', updatedAt: new Date().toISOString() });
  const active = next.filter(job => !['completed', 'cancelled'].includes(job.state));
  persist([...next.filter(job => ['completed', 'cancelled'].includes(job.state)).slice(-100), ...active]);
  return id;
}
export function updateDownloadJob(id: string, state: DownloadJobState, error?: string): void {
  persist(getDownloadJobs().map(job => job.id === id ? { ...job, state, error, updatedAt: new Date().toISOString() } : job));
}
