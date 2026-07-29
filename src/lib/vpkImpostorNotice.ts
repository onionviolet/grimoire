import type { VpkImpostorReport } from '../types/mod';

/**
 * Pure state model behind the VPK impostor notice.
 *
 * Lane A's reconcile finds installed files that are not VPKs (archives renamed
 * to `*_dir.vpk` before the identity gate existed). This module turns those
 * reports into rows the banner renders, and owns every message the banner
 * shows as a translation key plus params, so the wording is testable without a
 * DOM (Vitest runs in a node environment here).
 *
 * Two facts the copy must never blur:
 *  - A repair extracts the inner VPK and moves the original archive aside to
 *    `<file>.archive-backup`. It never deletes anything.
 *  - Where repair is impossible, Grimoire reports the detected type and stops.
 *    The addons folder is the user's; nothing is removed on their behalf.
 */

/** Suffix the main process appends when a repair moves the original aside. */
export const IMPOSTOR_BACKUP_SUFFIX = '.archive-backup';

export type ImpostorRowStatus = 'pending' | 'repairing' | 'repaired' | 'failed';

export interface ImpostorRow {
  modId: string;
  modName: string;
  fileName: string;
  filePath: string;
  /** Human-readable detected type, e.g. "7-Zip archive". */
  label: string;
  magicHex?: string;
  reason: string;
  repairable: boolean;
  innerVpkName?: string;
  status: ImpostorRowStatus;
  /** Failure text from a repair attempt, when `status` is 'failed'. */
  error?: string;
  /** Where the original archive was moved, when `status` is 'repaired'. */
  backupPath?: string;
}

/** A translation key with its interpolation values. */
export interface ImpostorMessage {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Reports to rows. Later reports for the same mod id replace earlier ones (a
 * forced reconcile re-reports the same library), and order is preserved.
 */
export function toImpostorRows(reports: VpkImpostorReport[]): ImpostorRow[] {
  const byId = new Map<string, ImpostorRow>();
  for (const report of reports) {
    byId.set(report.modId, {
      modId: report.modId,
      modName: report.modName,
      fileName: report.fileName,
      filePath: report.filePath,
      label: report.label,
      magicHex: report.magicHex,
      reason: report.reason,
      repairable: report.repairable,
      innerVpkName: report.innerVpkName,
      status: 'pending',
    });
  }
  return [...byId.values()];
}

/**
 * Merge a fresh batch into rows already on screen, keeping the status of rows
 * the user has already acted on. A row that no longer appears in the new batch
 * is dropped: the reconcile no longer considers it an impostor.
 */
export function mergeImpostorRows(existing: ImpostorRow[], reports: VpkImpostorReport[]): ImpostorRow[] {
  const previous = new Map(existing.map((row) => [row.modId, row]));
  return toImpostorRows(reports).map((row) => {
    const before = previous.get(row.modId);
    if (!before || before.status === 'pending') return row;
    return { ...row, status: before.status, error: before.error, backupPath: before.backupPath };
  });
}

export interface ImpostorSummary {
  /** Rows the reconcile flagged, including ones already repaired this session. */
  total: number;
  /** Not yet repaired. */
  outstanding: number;
  /** Outstanding rows that wrap exactly one VPK. */
  repairable: number;
  /** Outstanding rows that cannot be repaired. */
  unrepairable: number;
  repaired: number;
  failed: number;
  /** Nothing left to act on: hide the banner. */
  allResolved: boolean;
}

export function summarizeImpostors(rows: ImpostorRow[]): ImpostorSummary {
  const repaired = rows.filter((r) => r.status === 'repaired').length;
  const outstandingRows = rows.filter((r) => r.status !== 'repaired');
  return {
    total: rows.length,
    outstanding: outstandingRows.length,
    repairable: outstandingRows.filter((r) => r.repairable).length,
    unrepairable: outstandingRows.filter((r) => !r.repairable).length,
    repaired,
    failed: rows.filter((r) => r.status === 'failed').length,
    allResolved: rows.length > 0 && outstandingRows.length === 0,
  };
}

/** The banner headline: how many files are not VPKs. */
export function impostorHeadline(summary: ImpostorSummary): ImpostorMessage {
  return { key: 'vpkImpostors.headline', params: { count: summary.outstanding } };
}

/**
 * The banner subhead. It states what can be repaired, and never implies that
 * Grimoire will remove anything.
 */
export function impostorSubhead(summary: ImpostorSummary): ImpostorMessage {
  if (summary.repairable > 0 && summary.unrepairable > 0) {
    return {
      key: 'vpkImpostors.subheadMixed',
      params: { repairable: summary.repairable, blocked: summary.unrepairable },
    };
  }
  if (summary.repairable > 0) {
    return { key: 'vpkImpostors.subheadRepairable', params: { count: summary.repairable } };
  }
  return { key: 'vpkImpostors.subheadUnrepairable', params: { count: summary.unrepairable } };
}

/** The per-row explanation, keyed by what can be done about that row. */
export function impostorRowMessage(row: ImpostorRow): ImpostorMessage {
  switch (row.status) {
    case 'repaired':
      return {
        key: 'vpkImpostors.row.repaired',
        params: {
          innerVpkName: row.innerVpkName ?? row.fileName,
          backupPath: row.backupPath ?? `${row.filePath}${IMPOSTOR_BACKUP_SUFFIX}`,
        },
      };
    case 'failed':
      return {
        key: 'vpkImpostors.row.failed',
        params: { error: row.error ?? '', fileName: row.fileName },
      };
    case 'repairing':
      return { key: 'vpkImpostors.row.repairing', params: { fileName: row.fileName } };
    default:
      return row.repairable
        ? {
            key: 'vpkImpostors.row.repairable',
            params: {
              label: row.label,
              innerVpkName: row.innerVpkName ?? '',
              backupName: `${row.fileName}${IMPOSTOR_BACKUP_SUFFIX}`,
            },
          }
        : row.magicHex
          ? {
              key: 'vpkImpostors.row.unrepairable',
              params: { label: row.label, magicHex: row.magicHex },
            }
          : { key: 'vpkImpostors.row.unrepairableNoHeader', params: { label: row.label } };
  }
}

/** Only a pending, repairable row offers the repair button. */
export function canRepairRow(row: ImpostorRow): boolean {
  return row.repairable && (row.status === 'pending' || row.status === 'failed');
}

function updateRow(
  rows: ImpostorRow[],
  modId: string,
  change: (row: ImpostorRow) => ImpostorRow
): ImpostorRow[] {
  return rows.map((row) => (row.modId === modId ? change(row) : row));
}

export function markRepairing(rows: ImpostorRow[], modId: string): ImpostorRow[] {
  return updateRow(rows, modId, (row) => ({
    ...row,
    status: 'repairing',
    error: undefined,
  }));
}

export function markRepaired(
  rows: ImpostorRow[],
  modId: string,
  result: { backupPath: string; innerVpkName: string }
): ImpostorRow[] {
  return updateRow(rows, modId, (row) => ({
    ...row,
    status: 'repaired',
    error: undefined,
    backupPath: result.backupPath,
    innerVpkName: result.innerVpkName,
  }));
}

export function markRepairFailed(rows: ImpostorRow[], modId: string, error: string): ImpostorRow[] {
  return updateRow(rows, modId, (row) => ({ ...row, status: 'failed', error }));
}

/** Toast text for a finished repair. */
export function repairToastMessage(result: {
  backupPath: string;
  innerVpkName: string;
}): ImpostorMessage {
  return {
    key: 'vpkImpostors.repairedToast',
    params: { innerVpkName: result.innerVpkName, backupPath: result.backupPath },
  };
}
