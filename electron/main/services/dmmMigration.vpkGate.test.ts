/**
 * The VPK identity gate on the DMM import path.
 *
 * Lane A gated every Grimoire install path on the magic bytes, but not
 * `migrateDmmInstall`, which adopts files as installed mods just as much as the
 * others do. DMM records a file by name, so a ZIP or a 7-Zip archive sitting
 * there as `*_dir.vpk` would have been imported as a mod the engine cannot load
 * (exactly the six inert files found in a real library on 2026-07-29).
 *
 * Covered here:
 *  - a renamed ZIP and a renamed 7z are both rejected, each named by the type it
 *    actually is
 *  - a real VPK is still adopted
 *  - one bad file does not abort the run: the valid entries still import
 *  - an archive wrapping exactly one VPK imports the inner VPK instead, leaving
 *    DMM's original where it is
 *
 * Same electron-free harness as dmmMigration.guards.test.ts: only app.getPath()
 * is mocked; the real service runs against a temp sandbox.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { migrateDmmInstall } from './dmmMigration';
import { checkVpkFile } from './vpk';

const h = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));

/** Real VPK v2 bytes (magic 0x55aa1234 + version + a one-byte empty tree) with a
 *  trailing marker so each fixture has distinct content and hash. */
function vpkBytes(marker: string): Buffer {
  const header = Buffer.alloc(28);
  header.writeUInt32LE(0x55aa1234, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(1, 8);
  return Buffer.concat([header, Buffer.from([0]), Buffer.from(marker)]);
}

/** A ZIP holding the given name -> bytes pairs. */
function zipBytes(entries: Record<string, Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [name, data] of Object.entries(entries)) zip.addFile(name, data);
  return zip.toBuffer();
}

/** The 7-Zip signature, so a 7z impostor is detected without producing a real
 *  archive. It holds nothing extractable, which is the "reject it" case. */
const SEVEN_ZIP_BYTES = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]);

interface StateModSpec {
  id: number;
  name: string;
  enabled: boolean;
  vpks: string[];
}

function writeState(statePath: string, mods: StateModSpec[]): void {
  const enabledMods: Record<string, unknown> = {};
  const stateMods: unknown[] = [];
  mods.forEach((m, i) => {
    enabledMods[String(m.id)] = { remoteId: String(m.id), enabled: m.enabled };
    stateMods.push({
      remoteId: String(m.id),
      name: m.name,
      category: 'Skins',
      installOrder: i,
      installedVpks: m.vpks,
    });
  });
  const state = {
    activeProfileId: 'default',
    localMods: [],
    profiles: {
      default: {
        id: 'default', name: 'Default', isDefault: true, folderName: null,
        enabledMods, mods: stateMods,
      },
    },
  };
  writeFileSync(statePath, JSON.stringify({ 'local-config': JSON.stringify({ state, version: 15 }) }));
}

describe('migrateDmmInstall: VPK identity gate', () => {
  let report: Awaited<ReturnType<typeof migrateDmmInstall>>;
  let dirs: { addons: string; disabled: string; separate: string; userData: string };
  let zipImpostorPath: string;
  let sevenZipImpostorPath: string;
  let wrapperPath: string;
  const innerVpk = vpkBytes('INNER-VPK-444');

  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), 'dmm-gate-'));
    const dl = join(root, 'dl');
    const addons = join(dl, 'game', 'citadel', 'addons');
    const disabled = join(addons, '.disabled');
    const separate = join(root, 'dmm-profile');
    const userData = join(root, 'userdata');
    for (const d of [addons, disabled, separate, userData]) mkdirSync(d, { recursive: true });
    writeFileSync(join(dl, 'game', 'citadel', 'gameinfo.gi'), 'GameInfo {}\n');
    h.userData = userData;
    dirs = { addons, disabled, separate, userData };

    // 111: a genuine VPK already in a live slot -> adopted in place.
    const goodSlot = join(addons, 'pak50_dir.vpk');
    writeFileSync(goodSlot, vpkBytes('REAL-MOD-111'));

    // 222: a ZIP renamed to _dir.vpk, holding no VPK at all -> rejected.
    zipImpostorPath = join(addons, 'pak51_dir.vpk');
    writeFileSync(zipImpostorPath, zipBytes({ 'readme.txt': Buffer.from('not a mod') }));

    // 333: a 7-Zip archive renamed to _dir.vpk -> rejected, named as 7-Zip.
    sevenZipImpostorPath = join(disabled, 'seven_zip_thing_dir.vpk');
    writeFileSync(sevenZipImpostorPath, SEVEN_ZIP_BYTES);

    // 444: an archive wrapping exactly ONE real VPK -> the inner VPK is imported.
    wrapperPath = join(separate, 'wrapped_bundle_dir.vpk');
    writeFileSync(wrapperPath, zipBytes({ 'skin_444_dir.vpk': innerVpk }));

    // State written after the files, so every claim is mtime-corroborated and
    // the staleness guard is not what is under test here.
    const statePath = join(root, 'state.json');
    writeState(statePath, [
      { id: 111, name: 'Real Mod', enabled: true, vpks: [goodSlot] },
      { id: 222, name: 'Zip Impostor', enabled: true, vpks: [zipImpostorPath] },
      { id: 333, name: 'Seven Zip Thing', enabled: false, vpks: [sevenZipImpostorPath] },
      { id: 444, name: 'Wrapped Bundle', enabled: false, vpks: [wrapperPath] },
    ]);

    report = await migrateDmmInstall({ deadlockPath: dl, dmmStatePath: statePath });
  }, 60_000);

  it('rejects a renamed ZIP and names it as a ZIP archive', () => {
    const skip = report.skipped.find((s) => s.submissionId === 222);
    expect(skip).toBeDefined();
    expect(skip!.reason).toContain('ZIP archive');
    expect(skip!.reason).toContain('not a VPK');
  });

  it('rejects a renamed 7z and names it as a 7-Zip archive', () => {
    const skip = report.skipped.find((s) => s.submissionId === 333);
    expect(skip).toBeDefined();
    expect(skip!.reason).toContain('7-Zip archive');
    expect(skip!.reason).toContain('not a VPK');
  });

  it('accepts a real VPK and completes the run for the remaining valid entries', () => {
    expect(report.adopted.map((a) => a.submissionId).sort()).toEqual([111, 444]);
    const real = report.adopted.find((a) => a.submissionId === 111)!;
    expect(real.installedAs).toBe('pak50_dir.vpk');
    const meta = JSON.parse(readFileSync(join(dirs.userData, 'mod-metadata.json'), 'utf-8'));
    expect(meta['pak50_dir.vpk'].gameBananaId).toBe(111);
  });

  it('imports the inner VPK when the file is an archive wrapping exactly one', () => {
    const adopted = report.adopted.find((a) => a.submissionId === 444);
    expect(adopted).toBeDefined();
    const copies = readdirSync(dirs.disabled).filter((n) => n !== 'seven_zip_thing_dir.vpk');
    expect(copies.length).toBe(1);
    const importedPath = join(dirs.disabled, copies[0]);
    // What landed is the INNER VPK, not the wrapping archive.
    expect(checkVpkFile(importedPath).valid).toBe(true);
    expect(readFileSync(importedPath).equals(innerVpk)).toBe(true);
    // DMM's original archive is untouched: the import stays non-destructive.
    expect(existsSync(wrapperPath)).toBe(true);
    expect(checkVpkFile(wrapperPath)).toMatchObject({ valid: false, format: 'zip' });
  });

  it('leaves rejected files on disk and stamps no identity on them', () => {
    expect(existsSync(zipImpostorPath)).toBe(true);
    expect(existsSync(sevenZipImpostorPath)).toBe(true);
    const meta = JSON.parse(readFileSync(join(dirs.userData, 'mod-metadata.json'), 'utf-8'));
    expect(meta['pak51_dir.vpk']).toBeUndefined();
    expect(meta['seven_zip_thing_dir.vpk']).toBeUndefined();
  });

  it('reports the gate at report level', () => {
    expect(report.warnings.some((w) => w.includes('not VPKs'))).toBe(true);
    expect(report.warnings.some((w) => w.includes('wrapping a single VPK'))).toBe(true);
  });
});
