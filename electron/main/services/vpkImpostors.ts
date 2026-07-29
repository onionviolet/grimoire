import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { tmpdir } from 'os';
import { checkVpkFile, isUnpackableArchiveFormat, type VpkFileCheck, type VpkFileFormat } from './vpk';
import { extractArchive, listArchiveContents, type ArchiveFormat } from './extract';

/**
 * Impostor reconcile: find already-installed "mods" whose file is not a VPK.
 *
 * Until the identity gate landed, every install path tested the filename
 * extension and never the magic bytes, so archives renamed to `*_dir.vpk`
 * could be adopted as mods. The game cannot load them, so those mods never
 * worked; worse, they read as unreadable VPKs everywhere the app inspects
 * write sets. This module reports them with the detected type and, when the
 * archive wraps exactly one VPK, can repair the slot in place.
 *
 * It NEVER deletes anything on its own. A repair moves the original archive
 * aside under a backup name and leaves it there: the user's addons folder is
 * theirs.
 */

/** Suffix appended to the original file when a repair moves it aside. */
export const IMPOSTOR_BACKUP_SUFFIX = '.archive-backup';

/** The minimum an installed mod must supply to be reconciled. */
export interface VpkImpostorCandidate {
    /** Mod id, echoed back so the renderer can act on the row. */
    id: string;
    /** Display name, for the report. */
    name: string;
    /** Absolute path of the installed file. */
    path: string;
    /** Installed file name; defaults to the basename of `path`. */
    fileName?: string;
}

export interface VpkImpostorReport {
    modId: string;
    modName: string;
    fileName: string;
    filePath: string;
    /** What the magic bytes say the file actually is. */
    format: VpkFileFormat;
    /** Human-readable format name, e.g. "7-Zip archive". */
    label: string;
    /** First four bytes, e.g. `0xafbc7a37`. */
    magicHex?: string;
    /** Why it was flagged, naming the detected type. */
    reason: string;
    /** True when the archive holds exactly one VPK we can install in its place. */
    repairable: boolean;
    /** Name of that single inner VPK, when `repairable`. */
    innerVpkName?: string;
}

/**
 * Inspect one installed file. Returns null when it is a real VPK (the normal
 * case, and the only disk read for it is a 16-byte header).
 */
export async function inspectVpkImpostor(
    candidate: VpkImpostorCandidate
): Promise<VpkImpostorReport | null> {
    const check = checkVpkFile(candidate.path);
    if (check.valid) return null;

    const fileName = candidate.fileName ?? basename(candidate.path);
    const repair = isUnpackableArchiveFormat(check.format)
        ? await findSingleInnerVpkName(candidate.path, check.format)
        : null;

    return {
        modId: candidate.id,
        modName: candidate.name,
        fileName,
        filePath: candidate.path,
        format: check.format,
        label: check.label,
        magicHex: check.magicHex,
        reason: impostorReason(fileName, check),
        repairable: repair !== null,
        innerVpkName: repair ?? undefined,
    };
}

/** One sentence naming the detected type, for the reconcile report. */
function impostorReason(fileName: string, check: VpkFileCheck): string {
    if (isUnpackableArchiveFormat(check.format)) {
        return `${fileName} is a ${check.label}, not a VPK, so Deadlock never loaded it.`;
    }
    if (check.format === 'empty') {
        return `${fileName} is empty, not a VPK.`;
    }
    if (check.format === 'vpk') {
        return `${fileName} has a VPK header Grimoire cannot read: ${check.reason ?? 'unknown problem.'}`;
    }
    return `${fileName} is not a VPK${check.magicHex ? ` (header ${check.magicHex})` : ''}, so Deadlock never loaded it.`;
}

/**
 * The name of the single VPK inside an archive, or null when it holds zero or
 * several (ambiguous: repair would have to guess which one the user meant).
 */
async function findSingleInnerVpkName(
    filePath: string,
    format: ArchiveFormat
): Promise<string | null> {
    try {
        const entries = await listArchiveContents(filePath, format);
        const vpks = entries.filter((entry) => extname(entry).toLowerCase() === '.vpk');
        return vpks.length === 1 ? basename(vpks[0]) : null;
    } catch {
        return null;
    }
}

/**
 * Reconcile a whole installed library. Returns one report per impostor, in the
 * order the candidates were given, and an empty array for a healthy library.
 */
export async function reconcileInstalledVpks(
    candidates: VpkImpostorCandidate[]
): Promise<VpkImpostorReport[]> {
    const reports: VpkImpostorReport[] = [];
    for (const candidate of candidates) {
        const report = await inspectVpkImpostor(candidate);
        if (report) reports.push(report);
    }
    return reports;
}

export interface VpkImpostorRepairResult {
    /** Where the original archive was moved. Nothing is ever deleted. */
    backupPath: string;
    /** The inner VPK now occupying the slot. */
    innerVpkName: string;
}

/**
 * Extract-and-repair: replace an impostor with the single VPK it wraps, moving
 * the original archive aside under `IMPOSTOR_BACKUP_SUFFIX`. Throws when the
 * file is not repairable, leaving the slot exactly as it was.
 */
export async function repairVpkImpostor(filePath: string): Promise<VpkImpostorRepairResult> {
    const check = checkVpkFile(filePath);
    if (check.valid) {
        throw new Error(`${basename(filePath)} is already a VPK; nothing to repair.`);
    }
    if (!isUnpackableArchiveFormat(check.format)) {
        throw new Error(`${basename(filePath)} is a ${check.label}. Grimoire cannot recover a VPK from it.`);
    }

    const scratch = await fs.mkdtemp(join(tmpdir(), 'grimoire-impostor-'));
    try {
        // depth: 1 stops the unwrap recursion; we want the raw contents here so
        // an archive of archives is reported as ambiguous rather than guessed at.
        const inner = await extractArchive(filePath, scratch, { format: check.format, depth: 1 });
        if (inner.length !== 1) {
            throw new Error(
                `${basename(filePath)} contains ${inner.length} VPKs. Grimoire only repairs an archive that wraps exactly one.`
            );
        }

        const backupPath = `${filePath}${IMPOSTOR_BACKUP_SUFFIX}`;
        await fs.rename(filePath, backupPath);
        try {
            await fs.copyFile(inner[0].path, filePath);
        } catch (err) {
            // Put the user's file back rather than leaving an empty slot.
            await fs.rename(backupPath, filePath).catch(() => {});
            throw err;
        }

        return { backupPath, innerVpkName: basename(inner[0].fileName) };
    } finally {
        await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
    }
}
