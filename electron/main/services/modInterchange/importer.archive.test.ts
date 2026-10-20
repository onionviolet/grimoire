import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { importInterchange } from './importer';
import { newInterchangeDocument } from '../../../../src/lib/modInterchange';
import { checkVpkFile } from '../vpk';

const h = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => h.userData, getVersion: () => '0.0.0-test' } }));
vi.mock('../launch', () => ({ isDeadlockRunning: async () => false, readStash: async () => null }));

describe('interchange archive in an enabled addon root', () => {
  it('installs the inner VPK and parks the original archive outside the live root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'interchange-archive-'));
    const deadlock = join(root, 'Deadlock');
    const citadel = join(deadlock, 'game', 'citadel');
    const addons = join(citadel, 'addons');
    const disabled = join(addons, '.disabled');
    h.userData = join(root, 'grimoire');
    for (const dir of [addons, disabled, h.userData]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(citadel, 'gameinfo.gi'), 'GameInfo {}\n');

    const inner = Buffer.alloc(29);
    inner.writeUInt32LE(0x55aa1234, 0);
    inner.writeUInt32LE(2, 4);
    inner.writeUInt32LE(1, 8);
    const archive = new AdmZip();
    archive.addFile('actual_dir.vpk', inner);
    const wrapper = join(addons, 'pak01_dir.vpk');
    const archiveBytes = archive.toBuffer();
    writeFileSync(wrapper, archiveBytes);

    const document = newInterchangeDocument({ manager: 'other' });
    document.mods.push({
      key: 'local:archive', name: 'Archive mod', enabled: true, order: 0,
      origin: { provider: 'local', localId: 'archive' },
      files: [{ name: 'pak01_dir.vpk', path: wrapper }],
    });

    const result = await importInterchange(document, { deadlockPath: deadlock });
    expect(result.results[0].status).toBe('imported');
    expect(existsSync(wrapper) && !checkVpkFile(wrapper).valid).toBe(false);
    const live = readdirSync(addons).filter(name => /^pak\d+_dir\.vpk$/i.test(name));
    expect(live).toHaveLength(1);
    expect(checkVpkFile(join(addons, live[0])).valid).toBe(true);
    const parked = readdirSync(disabled).filter(name => name.endsWith('.zip'));
    expect(parked).toHaveLength(1);
    expect(readFileSync(join(disabled, parked[0]))).toEqual(archiveBytes);
  });
});
