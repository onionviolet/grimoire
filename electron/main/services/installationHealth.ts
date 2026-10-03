import { constants, promises as fs } from 'fs';
import { join } from 'path';
import { getMetadataPath } from '../utils/paths';
import { isReservedPriorityVpk, metaKeyFor } from './deadlock';
import { checkVpkFile, parseVpkDirectory } from './vpk';
import { findSearchPathsBlock, hasActivePath, hasLanguageSearchPaths, hasModSearchPaths, hasRequiredSearchPaths } from './gameinfoSearchPaths';
import type { HealthIssue, InstallationHealthReport } from '../../../src/types/recovery';

const LOW_DISK_BYTES = 1024 * 1024 * 1024;

/** Reads only. Do not use scanMods or path getters that provision folders here. */
export async function scanInstallationHealth(gamePath: string | null): Promise<InstallationHealthReport> {
  const report: InstallationHealthReport = {
    scannedAt: new Date().toISOString(), pathState: gamePath ? 'invalid' : 'unset', gamePath,
    gameinfo: { readable: false, writable: false, configured: false },
    mods: { checked: 0, enabled: 0, disabled: 0 }, disk: null, issues: [],
  };
  if (!gamePath) return report;
  const add = (code: HealthIssue['code'], severity: HealthIssue['severity'], target: HealthIssue['target'], detail: Partial<HealthIssue> = {}) => {
    report.issues.push({ code, severity, target, ...detail });
  };
  const citadel = join(gamePath, 'game', 'citadel');
  try {
    if (!(await fs.stat(citadel)).isDirectory()) throw new Error('Not a directory');
  } catch {
    add('path-invalid', 'blocking', 'settings');
    return report;
  }
  report.pathState = 'ready';

  let folderNames: string[] = [];
  try {
    folderNames = (await fs.readdir(citadel, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    add('folder-unreadable', 'blocking', 'settings', { location: 'game/citadel' });
  }
  const roots = ['grimoire', 'addons', ...folderNames.filter((name) => /^addons[1-9]$/.test(name)), 'addons/.disabled'];
  const gameinfoPath = join(citadel, 'gameinfo.gi');
  try {
    const content = await fs.readFile(gameinfoPath, 'utf8');
    report.gameinfo.readable = true;
    const block = findSearchPathsBlock(content);
    const missingMounts = !block || !hasRequiredSearchPaths(block.body)
      || folderNames.filter((name) => /^addons[1-9]$/.test(name)).some((name) => !hasActivePath(block.body, `citadel/${name}`))
      || (folderNames.includes('deadworks_addons') && !hasActivePath(block.body, 'citadel/deadworks_addons/vpks'));
    if (missingMounts) add('search-paths-missing', 'blocking', 'config');
    if (block && !hasModSearchPaths(block.body)) add('boot-paths-missing', 'blocking', 'config');
    if (block && !hasLanguageSearchPaths(block.body)) add('language-paths-missing', 'warning', 'config');
    report.gameinfo.configured = !!block && !missingMounts && hasModSearchPaths(block.body) && hasLanguageSearchPaths(block.body);
  } catch (error) {
    add((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'gameinfo-missing' : 'gameinfo-unreadable', 'blocking', 'config');
  }
  if (report.gameinfo.readable) {
    try {
      await fs.access(gameinfoPath, constants.W_OK);
      report.gameinfo.writable = true;
    } catch {
      add('gameinfo-unwritable', 'warning', 'config');
    }
  }

  let metadata: Record<string, { modName?: string }> = {};
  let metadataReadable = true;
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(getMetadataPath(), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || Object.values(parsed).some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('Invalid metadata map');
    }
    metadata = parsed as typeof metadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      metadataReadable = false;
      add('metadata-unreadable', 'warning', 'installed');
    }
  }
  const seen = new Set<string>();
  let inventoryComplete = !report.issues.some((issue) => issue.code === 'folder-unreadable');
  for (const root of roots) {
    let entries;
    try {
      entries = await fs.readdir(join(citadel, root), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        inventoryComplete = false;
        add('folder-unreadable', 'blocking', 'installed', { location: `game/citadel/${root}` });
      }
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('_dir.vpk')) continue;
      const filePath = join(citadel, root, entry.name);
      const key = metaKeyFor(filePath);
      const reserved = root === 'grimoire' && isReservedPriorityVpk(entry.name);
      const rawName = metadata[key]?.modName;
      const detail = { fileName: entry.name, modName: typeof rawName === 'string' && rawName.trim() ? rawName : entry.name, location: `game/citadel/${root}/${entry.name}` };
      // Managed Locker artifacts are checked too, but never reported as orphan user metadata.
      report.mods.checked++;
      if (root === 'addons/.disabled') report.mods.disabled++; else report.mods.enabled++;
      const check = checkVpkFile(filePath);
      if (!check.valid) add('vpk-invalid', root === 'addons/.disabled' ? 'warning' : 'blocking', 'installed', { ...detail, format: check.format });
      else if (parseVpkDirectory(filePath) === null) add('vpk-tree-invalid', root === 'addons/.disabled' ? 'warning' : 'blocking', 'installed', detail);
      if (reserved) continue;
      if (seen.has(key)) add('metadata-ambiguous', 'warning', 'installed', detail);
      seen.add(key);
      if (metadataReadable && !metadata[key]) add('metadata-missing-entry', 'warning', 'installed', detail);
    }
  }
  if (metadataReadable && inventoryComplete) {
    for (const [key, row] of Object.entries(metadata)) {
      if (key.startsWith('locker:') || seen.has(key) || !key.toLowerCase().endsWith('_dir.vpk')) continue;
      // Scope to keys produced by metaKeyFor; foreign metadata cannot be resolved safely.
      if (!/^(?:(?:grimoire|addons[1-9])\/)?[^/\\]+_dir\.vpk$/i.test(key)) continue;
      const candidates = key.includes('/') ? [join(citadel, key)] : [join(citadel, 'addons', key), join(citadel, 'addons', '.disabled', key)];
      let confirmedAbsent = true;
      for (const candidate of candidates) {
        try {
          await fs.stat(candidate);
          confirmedAbsent = false;
        } catch (error) {
          if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) confirmedAbsent = false;
        }
      }
      if (!confirmedAbsent) continue;
      add('metadata-missing-file', 'warning', 'installed', { fileName: key, modName: typeof row.modName === 'string' ? row.modName : key });
    }
  }
  try {
    const disk = await fs.statfs(gamePath);
    report.disk = { freeBytes: disk.bavail * disk.bsize, totalBytes: disk.blocks * disk.bsize };
    if (report.disk.freeBytes < LOW_DISK_BYTES) add('disk-low', 'warning', 'settings');
  } catch {
    add('disk-unavailable', 'warning', 'settings');
  }
  return report;
}
