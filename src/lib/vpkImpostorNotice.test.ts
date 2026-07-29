import { describe, it, expect } from 'vitest';
import enCatalog from '../locales/en/translation.json';
import type { VpkImpostorReport } from '../types/mod';
import {
  IMPOSTOR_BACKUP_SUFFIX,
  canRepairRow,
  impostorHeadline,
  impostorRowMessage,
  impostorSubhead,
  markRepairFailed,
  markRepaired,
  markRepairing,
  mergeImpostorRows,
  repairToastMessage,
  summarizeImpostors,
  toImpostorRows,
  type ImpostorRow,
} from './vpkImpostorNotice';

/**
 * The banner's state and wording, tested as pure functions. Vitest runs in a
 * node environment here (no DOM, no testing-library), so nothing below renders
 * a component: these cover the derivation the component reads.
 */

const zipReport: VpkImpostorReport = {
  modId: 'mod-zip',
  modName: 'Renamed archive',
  fileName: 'pak62_dir.vpk',
  filePath: '/addons/pak62_dir.vpk',
  format: 'zip',
  label: 'ZIP archive',
  magicHex: '0x04034b50',
  reason: 'pak62_dir.vpk is a ZIP archive, not a VPK, so Deadlock never loaded it.',
  repairable: true,
  innerVpkName: 'skin_dir.vpk',
};

const sevenZipReport: VpkImpostorReport = {
  modId: 'mod-7z',
  modName: 'Renamed 7z',
  fileName: 'pak63_dir.vpk',
  filePath: '/addons/pak63_dir.vpk',
  format: '7z',
  label: '7-Zip archive',
  magicHex: '0xafbc7a37',
  reason: 'pak63_dir.vpk is a 7-Zip archive, not a VPK, so Deadlock never loaded it.',
  repairable: false,
};

describe('toImpostorRows', () => {
  it('carries the detected type, reason and repairability through, pending by default', () => {
    const rows = toImpostorRows([zipReport, sevenZipReport]);
    expect(rows.map((r) => r.modId)).toEqual(['mod-zip', 'mod-7z']);
    expect(rows[0]).toMatchObject({
      label: 'ZIP archive',
      repairable: true,
      innerVpkName: 'skin_dir.vpk',
      status: 'pending',
    });
    expect(rows[1]).toMatchObject({ label: '7-Zip archive', repairable: false, status: 'pending' });
  });

  it('collapses a repeated report for the same mod into one row', () => {
    const rows = toImpostorRows([zipReport, { ...zipReport, label: 'ZIP archive (rescanned)' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('ZIP archive (rescanned)');
  });
});

describe('mergeImpostorRows', () => {
  it('keeps a row the user already repaired when a fresh reconcile arrives', () => {
    const repaired = markRepaired(toImpostorRows([zipReport, sevenZipReport]), 'mod-zip', {
      backupPath: `/addons/pak62_dir.vpk${IMPOSTOR_BACKUP_SUFFIX}`,
      innerVpkName: 'skin_dir.vpk',
    });

    const merged = mergeImpostorRows(repaired, [zipReport, sevenZipReport]);
    expect(merged.find((r) => r.modId === 'mod-zip')?.status).toBe('repaired');
    expect(merged.find((r) => r.modId === 'mod-7z')?.status).toBe('pending');
  });

  it('drops rows the reconcile no longer reports and adds new ones', () => {
    const before = toImpostorRows([zipReport]);
    const merged = mergeImpostorRows(before, [sevenZipReport]);
    expect(merged.map((r) => r.modId)).toEqual(['mod-7z']);
  });
});

describe('summarizeImpostors', () => {
  it('splits outstanding rows by whether repair is possible', () => {
    const summary = summarizeImpostors(toImpostorRows([zipReport, sevenZipReport]));
    expect(summary).toMatchObject({
      total: 2,
      outstanding: 2,
      repairable: 1,
      unrepairable: 1,
      repaired: 0,
      failed: 0,
      allResolved: false,
    });
  });

  it('is resolved only once every row is repaired', () => {
    let rows = toImpostorRows([zipReport]);
    expect(summarizeImpostors(rows).allResolved).toBe(false);
    rows = markRepaired(rows, 'mod-zip', { backupPath: '/b', innerVpkName: 'skin_dir.vpk' });
    expect(summarizeImpostors(rows)).toMatchObject({ outstanding: 0, repaired: 1, allResolved: true });
  });

  it('is not resolved by an empty list (there is nothing to show)', () => {
    expect(summarizeImpostors([]).allResolved).toBe(false);
  });

  it('counts a failed repair as still outstanding', () => {
    const rows = markRepairFailed(toImpostorRows([zipReport]), 'mod-zip', 'contains 2 VPKs');
    expect(summarizeImpostors(rows)).toMatchObject({ outstanding: 1, failed: 1, allResolved: false });
  });
});

describe('headline and subhead', () => {
  it('counts only outstanding files in the headline', () => {
    const rows = markRepaired(toImpostorRows([zipReport, sevenZipReport]), 'mod-zip', {
      backupPath: '/b',
      innerVpkName: 'skin_dir.vpk',
    });
    expect(impostorHeadline(summarizeImpostors(rows))).toEqual({
      key: 'vpkImpostors.headline',
      params: { count: 1 },
    });
  });

  it('picks the mixed subhead when some rows can be repaired and some cannot', () => {
    const summary = summarizeImpostors(toImpostorRows([zipReport, sevenZipReport]));
    expect(impostorSubhead(summary)).toEqual({
      key: 'vpkImpostors.subheadMixed',
      params: { repairable: 1, blocked: 1 },
    });
  });

  it('picks the repairable-only subhead', () => {
    expect(impostorSubhead(summarizeImpostors(toImpostorRows([zipReport])))).toEqual({
      key: 'vpkImpostors.subheadRepairable',
      params: { count: 1 },
    });
  });

  it('picks the unrepairable-only subhead', () => {
    expect(impostorSubhead(summarizeImpostors(toImpostorRows([sevenZipReport])))).toEqual({
      key: 'vpkImpostors.subheadUnrepairable',
      params: { count: 1 },
    });
  });
});

describe('impostorRowMessage', () => {
  it('names the backup file a repair would create', () => {
    const [row] = toImpostorRows([zipReport]);
    expect(impostorRowMessage(row)).toEqual({
      key: 'vpkImpostors.row.repairable',
      params: {
        label: 'ZIP archive',
        innerVpkName: 'skin_dir.vpk',
        backupName: `pak62_dir.vpk${IMPOSTOR_BACKUP_SUFFIX}`,
      },
    });
  });

  it('states the detected type when repair is impossible', () => {
    const [row] = toImpostorRows([sevenZipReport]);
    expect(impostorRowMessage(row)).toEqual({
      key: 'vpkImpostors.row.unrepairable',
      params: { label: '7-Zip archive', magicHex: '0xafbc7a37' },
    });
  });

  it('drops the header clause when no magic bytes were read', () => {
    const [row] = toImpostorRows([{ ...sevenZipReport, magicHex: undefined }]);
    expect(impostorRowMessage(row)).toEqual({
      key: 'vpkImpostors.row.unrepairableNoHeader',
      params: { label: '7-Zip archive' },
    });
  });

  it('reports where the original went after a repair', () => {
    const rows = markRepaired(toImpostorRows([zipReport]), 'mod-zip', {
      backupPath: `/addons/pak62_dir.vpk${IMPOSTOR_BACKUP_SUFFIX}`,
      innerVpkName: 'skin_dir.vpk',
    });
    expect(impostorRowMessage(rows[0])).toEqual({
      key: 'vpkImpostors.row.repaired',
      params: {
        innerVpkName: 'skin_dir.vpk',
        backupPath: `/addons/pak62_dir.vpk${IMPOSTOR_BACKUP_SUFFIX}`,
      },
    });
  });

  it('surfaces the failure text verbatim', () => {
    const rows = markRepairFailed(toImpostorRows([zipReport]), 'mod-zip', 'contains 2 VPKs');
    expect(impostorRowMessage(rows[0])).toEqual({
      key: 'vpkImpostors.row.failed',
      params: { error: 'contains 2 VPKs', fileName: 'pak62_dir.vpk' },
    });
  });

  it('shows progress while a repair runs', () => {
    const rows = markRepairing(toImpostorRows([zipReport]), 'mod-zip');
    expect(impostorRowMessage(rows[0]).key).toBe('vpkImpostors.row.repairing');
  });
});

describe('canRepairRow', () => {
  it('offers repair on a pending repairable row and again after a failure', () => {
    const rows = toImpostorRows([zipReport]);
    expect(canRepairRow(rows[0])).toBe(true);
    expect(canRepairRow(markRepairFailed(rows, 'mod-zip', 'boom')[0])).toBe(true);
  });

  it('never offers repair for an unrepairable row, or while one is running, or once done', () => {
    const [blocked] = toImpostorRows([sevenZipReport]);
    expect(canRepairRow(blocked)).toBe(false);

    const rows = toImpostorRows([zipReport]);
    expect(canRepairRow(markRepairing(rows, 'mod-zip')[0])).toBe(false);
    expect(
      canRepairRow(markRepaired(rows, 'mod-zip', { backupPath: '/b', innerVpkName: 'x' })[0])
    ).toBe(false);
  });
});

describe('repairToastMessage', () => {
  it('reports the inner VPK and where the archive was moved', () => {
    expect(repairToastMessage({ backupPath: '/addons/x.vpk.archive-backup', innerVpkName: 'skin_dir.vpk' })).toEqual({
      key: 'vpkImpostors.repairedToast',
      params: { innerVpkName: 'skin_dir.vpk', backupPath: '/addons/x.vpk.archive-backup' },
    });
  });
});

describe('every derived key exists in the English catalog', () => {
  // These keys are built at runtime, so `i18n:check` (which reads static t()
  // calls) cannot see them. This is the gate that keeps them real.
  const catalog = enCatalog as unknown as Record<string, unknown>;

  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => {
      if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, catalog);

  /** A `count` param means i18next resolves the plural forms, not the bare key. */
  const resolves = (key: string, params?: Record<string, unknown>): boolean => {
    if (params && 'count' in params) {
      return typeof lookup(`${key}_one`) === 'string' && typeof lookup(`${key}_other`) === 'string';
    }
    return typeof lookup(key) === 'string';
  };

  const everyStatus: ImpostorRow['status'][] = ['pending', 'repairing', 'repaired', 'failed'];

  it('resolves the headline and all three subheads', () => {
    const cases = [
      summarizeImpostors(toImpostorRows([zipReport])),
      summarizeImpostors(toImpostorRows([sevenZipReport])),
      summarizeImpostors(toImpostorRows([zipReport, sevenZipReport])),
    ];
    for (const summary of cases) {
      const headline = impostorHeadline(summary);
      const subhead = impostorSubhead(summary);
      expect([headline.key, resolves(headline.key, headline.params)]).toEqual([headline.key, true]);
      expect([subhead.key, resolves(subhead.key, subhead.params)]).toEqual([subhead.key, true]);
    }
  });

  it('resolves a row message in every status, repairable or not', () => {
    for (const report of [zipReport, sevenZipReport, { ...sevenZipReport, magicHex: undefined }]) {
      for (const status of everyStatus) {
        const row: ImpostorRow = { ...toImpostorRows([report])[0], status };
        const message = impostorRowMessage(row);
        expect([message.key, resolves(message.key, message.params)]).toEqual([message.key, true]);
      }
    }
  });

  it('resolves the static banner strings', () => {
    for (const key of [
      'vpkImpostors.title',
      'vpkImpostors.repair',
      'vpkImpostors.repairing',
      'vpkImpostors.retryRepair',
      'vpkImpostors.neverDeletes',
      'vpkImpostors.notRemoved',
      'vpkImpostors.showDetails',
      'vpkImpostors.hideDetails',
      'vpkImpostors.dismissTitle',
      'vpkImpostors.repairedToast',
      'vpkImpostors.repairFailedToast',
    ]) {
      expect([key, resolves(key)]).toEqual([key, true]);
    }
  });
});
