import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanInstallationHealth } from './installationHealth';
import { buildSearchPathsBlock } from './gameinfoSearchPaths';

const h = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));

function vpkBytes(): Buffer {
  const header = Buffer.alloc(28);
  header.writeUInt32LE(0x55aa1234, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(1, 8);
  return Buffer.concat([header, Buffer.from([0])]);
}

describe('read-only installation health scan', () => {
  let dir: string;
  let game: string;
  let citadel: string;
  const metadata = (rows: unknown) => writeFileSync(join(h.userData, 'mod-metadata.json'), JSON.stringify(rows));
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'grimoire-health-'));
    h.userData = join(dir, 'userData');
    game = join(dir, 'Deadlock');
    citadel = join(game, 'game', 'citadel');
    mkdirSync(h.userData);
    mkdirSync(citadel, { recursive: true });
    writeFileSync(join(citadel, 'gameinfo.gi'), `GameInfo { FileSystem { ${buildSearchPathsBlock([], false)} } }`);
  });
  afterEach(() => { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });

  it('does not create paths for an unset or invalid installation', async () => {
    expect((await scanInstallationHealth(null)).pathState).toBe('unset');
    const missing = join(dir, 'gone');
    const report = await scanInstallationHealth(missing);
    expect(report.pathState).toBe('invalid');
    expect(report.issues).toEqual([{ code: 'path-invalid', severity: 'blocking', target: 'settings' }]);
    expect(existsSync(missing)).toBe(false);
  });

  it('reads valid configuration without provisioning addon folders', async () => {
    const before = readdirSync(citadel);
    const report = await scanInstallationHealth(game);
    expect(report.gameinfo).toEqual({ readable: true, writable: true, configured: true });
    expect(report.mods.checked).toBe(0);
    expect(report.issues).toEqual([]);
    expect(readdirSync(citadel)).toEqual(before);
  });

  it('names invalid VPKs and gives disabled files warning severity', async () => {
    mkdirSync(join(citadel, 'addons', '.disabled'), { recursive: true });
    writeFileSync(join(citadel, 'addons', 'pak01_dir.vpk'), Buffer.from('PK\x03\x04archive'));
    writeFileSync(join(citadel, 'addons', '.disabled', 'off_dir.vpk'), Buffer.alloc(0));
    metadata({ 'pak01_dir.vpk': { modName: 'Neon Ivy' }, 'off_dir.vpk': { modName: 'Quiet Lash' } });
    const report = await scanInstallationHealth(game);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'vpk-invalid', modName: 'Neon Ivy', format: 'zip', severity: 'blocking' }),
      expect.objectContaining({ code: 'vpk-invalid', modName: 'Quiet Lash', format: 'empty', severity: 'warning' }),
    ]));
    expect(report.mods).toEqual({ checked: 2, enabled: 1, disabled: 1 });
    expect(readFileSync(join(citadel, 'addons', 'pak01_dir.vpk'))).toEqual(Buffer.from('PK\x03\x04archive'));
  });

  it('detects truncated trees even when the magic bytes are valid', async () => {
    mkdirSync(join(citadel, 'addons'));
    writeFileSync(join(citadel, 'addons', 'pak01_dir.vpk'), vpkBytes().subarray(0, 28));
    metadata({ 'pak01_dir.vpk': { modName: 'Truncated Skin' } });
    expect((await scanInstallationHealth(game)).issues).toContainEqual(expect.objectContaining({ code: 'vpk-tree-invalid', modName: 'Truncated Skin' }));
  });

  it('reports stale metadata, preserves corrupt bytes and excludes synthetic Locker keys', async () => {
    metadata({ 'gone_dir.vpk': { modName: 'Missing Skin' }, 'locker:cards': {}, foreign: {} });
    const report = await scanInstallationHealth(game);
    expect(report.issues).toEqual([expect.objectContaining({ code: 'metadata-missing-file', modName: 'Missing Skin' })]);
    const corrupt = '{broken';
    writeFileSync(join(h.userData, 'mod-metadata.json'), corrupt);
    expect((await scanInstallationHealth(game)).issues).toContainEqual(expect.objectContaining({ code: 'metadata-unreadable' }));
    expect(readFileSync(join(h.userData, 'mod-metadata.json'), 'utf8')).toBe(corrupt);
    expect(readdirSync(h.userData)).toEqual(['mod-metadata.json']);
  });

  it('checks priority and overflow VPKs without treating managed artifacts as missing metadata', async () => {
    for (const root of ['grimoire', 'addons1']) mkdirSync(join(citadel, root));
    writeFileSync(join(citadel, 'grimoire', 'pak01_dir.vpk'), vpkBytes());
    writeFileSync(join(citadel, 'addons1', 'pak01_dir.vpk'), vpkBytes());
    metadata({ 'addons1/pak01_dir.vpk': { modName: 'Overflow Skin' } });
    const report = await scanInstallationHealth(game);
    expect(report.mods.checked).toBe(2);
    expect(report.issues).toEqual([expect.objectContaining({ code: 'search-paths-missing' })]);
  });

  it('does not claim metadata is orphaned when a folder cannot be read', async () => {
    metadata({ 'gone_dir.vpk': { modName: 'May Still Exist' } });
    const read = fs.readdir.bind(fs);
    vi.spyOn(fs, 'readdir').mockImplementation(((path: Parameters<typeof fs.readdir>[0], options: Parameters<typeof fs.readdir>[1]) => {
      if (String(path) === join(citadel, 'addons')) return Promise.reject(Object.assign(new Error('Denied'), { code: 'EACCES' }));
      return read(path, options);
    }) as typeof fs.readdir);
    const report = await scanInstallationHealth(game);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'folder-unreadable' }));
    expect(report.issues.some((issue) => issue.code === 'metadata-missing-file')).toBe(false);
  });

  it('reports missing gameinfo and low disk capacity as separate findings', async () => {
    rmSync(join(citadel, 'gameinfo.gi'));
    vi.spyOn(fs, 'statfs').mockResolvedValue({ bsize: 4096, bavail: 1, blocks: 100, bfree: 1, files: 1, ffree: 1, type: 1 });
    const report = await scanInstallationHealth(game);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'gameinfo-missing', severity: 'blocking' }));
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'disk-low', severity: 'warning' }));
  });

  it('distinguishes readable configuration from unavailable write access', async () => {
    vi.spyOn(fs, 'access').mockRejectedValue(Object.assign(new Error('Denied'), { code: 'EACCES' }));
    const report = await scanInstallationHealth(game);
    expect(report.gameinfo).toEqual({ readable: true, writable: false, configured: true });
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'gameinfo-unwritable', severity: 'warning' }));
  });

  it('detects ambiguous enabled and disabled metadata keys', async () => {
    mkdirSync(join(citadel, 'addons', '.disabled'), { recursive: true });
    writeFileSync(join(citadel, 'addons', 'same_dir.vpk'), vpkBytes());
    writeFileSync(join(citadel, 'addons', '.disabled', 'same_dir.vpk'), vpkBytes());
    metadata({ 'same_dir.vpk': { modName: 'Both Copies' } });
    const report = await scanInstallationHealth(game);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'metadata-ambiguous', modName: 'Both Copies' }));
    expect(report.issues.some((issue) => issue.code === 'metadata-missing-file')).toBe(false);
  });
});
