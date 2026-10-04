import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const h = vi.hoisted(() => ({ root: '' }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => h.root }));
beforeEach(() => { h.root = mkdtempSync(join(realpathSync(tmpdir()), 'grimoire-job-test-')); });
afterEach(() => { rmSync(h.root, { recursive: true, force: true }); });
describe('durable download jobs', () => {
  it('pauses interrupted jobs on reload and retains completed jobs independently', async () => {
    const jobs = await import('./downloadJobs');
    const args = { modId: 1, fileId: 2, fileName: 'mod.zip' };
    const a = jobs.saveDownloadJob('/game', args), b = jobs.saveDownloadJob('/game', { ...args, fileId: 3 });
    jobs.updateDownloadJob(a, 'completed'); jobs.updateDownloadJob(b, 'downloading');
    expect(JSON.parse(readFileSync(join(h.root, 'download-jobs.json'), 'utf8'))).toHaveLength(2);
    vi.resetModules();
    const restored = await import('./downloadJobs');
    expect(restored.getDownloadJobs().map(job => job.state)).toEqual(['completed', 'paused']);
    restored.updateDownloadJob(b, 'failed', 'offline');
    expect(restored.getDownloadJobs().find(job => job.id === a)?.state).toBe('completed');
  });
  it('uses one stable job identity for repeated direct URL requests', async () => {
    const jobs = await import('./downloadJobs');
    const url = 'https://gamebanana.com/dl/42';
    const a = jobs.saveDownloadJob('/game', { modId: -1, fileId: -1, fileName: 'mod.zip' }, url);
    const b = jobs.saveDownloadJob('/game', { modId: -2, fileId: -1, fileName: 'mod.zip' }, url);
    expect(a).toBe(b); expect(jobs.getDownloadJobs()).toHaveLength(1);
  });
});
