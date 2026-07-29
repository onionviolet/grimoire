/**
 * Lane A: the VPK identity gate.
 *
 * Every install path used to test the filename extension and never the magic
 * bytes, so on 2026-07-29 six archives renamed to `*_dir.vpk` (two 7-Zip, four
 * ZIP) were found sitting in a real library, each wrapping a VPK that was never
 * unpacked. The game cannot load an archive, so those mods had never worked.
 *
 * These tests cover the four cases from the lane plan:
 *  - a ZIP and a 7z renamed to `_dir.vpk` are both rejected
 *  - a real v1 and a real v2 VPK are both accepted
 *  - an archive wrapping exactly one VPK installs the inner file
 *  - the reconcile reports an impostor without removing it
 *
 * extract.ts / vpk.ts / vpkImpostors.ts are electron-free (fs + adm-zip +
 * bundled 7za), so this runs against the real implementations with no mocking.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { checkVpkFile, identifyVpkBytes, describeVpkRejection } from './vpk';
import { extractArchive, resolveInstallableVpk, type RejectedVpk } from './extract';
import {
    inspectVpkImpostor,
    reconcileInstalledVpks,
    repairVpkImpostor,
    IMPOSTOR_BACKUP_SUFFIX,
} from './vpkImpostors';

/** A real VPK header of the given directory version plus an empty tree. */
function vpkBytes(version: 1 | 2, marker = ''): Buffer {
    // v1 header is 12 bytes, v2 is 28. Both start magic/version/treeSize.
    const headerSize = version === 2 ? 28 : 12;
    const header = Buffer.alloc(headerSize);
    header.writeUInt32LE(0x55aa1234, 0);
    header.writeUInt32LE(version, 4);
    header.writeUInt32LE(1, 8); // tree size: a single terminator byte
    return Buffer.concat([header, Buffer.from([0]), Buffer.from(marker)]);
}

/** A ZIP whose entries are the given name -> bytes pairs. */
function zipBytes(entries: Record<string, Buffer>): Buffer {
    const zip = new AdmZip();
    for (const [name, data] of Object.entries(entries)) zip.addFile(name, data);
    return zip.toBuffer();
}

/** The 7-Zip signature, so a 7z impostor is detected without shelling out. */
const SEVEN_ZIP_HEADER = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]);

function scratchDir(): string {
    return mkdtempSync(join(tmpdir(), 'vpk-identity-'));
}

describe('identifyVpkBytes (magic + version)', () => {
    it('rejects a ZIP renamed to _dir.vpk and names the real type', () => {
        const check = identifyVpkBytes(zipBytes({ 'inner_dir.vpk': vpkBytes(2) }).subarray(0, 16));
        expect(check.valid).toBe(false);
        expect(check.format).toBe('zip');
        // The header the live drive read off the four ZIP impostors.
        expect(check.magicHex).toBe('0x04034b50');
        expect(describeVpkRejection('pak62_dir.vpk', check)).toContain('ZIP archive');
    });

    it('rejects a 7-Zip renamed to _dir.vpk and names the real type', () => {
        const check = identifyVpkBytes(SEVEN_ZIP_HEADER);
        expect(check.valid).toBe(false);
        expect(check.format).toBe('7z');
        // The header the live drive actually read off the six impostors.
        expect(check.magicHex).toBe('0xafbc7a37');
        expect(describeVpkRejection('pak62_dir.vpk', check)).toContain('7-Zip archive');
    });

    it('accepts a real v1 VPK', () => {
        const check = identifyVpkBytes(vpkBytes(1));
        expect(check.valid).toBe(true);
        expect(check.version).toBe(1);
    });

    it('accepts a real v2 VPK', () => {
        const check = identifyVpkBytes(vpkBytes(2));
        expect(check.valid).toBe(true);
        expect(check.version).toBe(2);
    });

    it('rejects a VPK header carrying an unsupported version', () => {
        const bytes = vpkBytes(2);
        bytes.writeUInt32LE(9, 4);
        const check = identifyVpkBytes(bytes);
        expect(check.valid).toBe(false);
        expect(check.format).toBe('vpk');
        expect(check.reason).toContain('9');
    });

    it('rejects an empty file rather than reading past the end', () => {
        expect(identifyVpkBytes(Buffer.alloc(0))).toMatchObject({ valid: false, format: 'empty' });
    });
});

describe('checkVpkFile (on disk)', () => {
    it('reads a real VPK and both impostor shapes off disk', () => {
        const dir = scratchDir();
        const good = join(dir, 'pak01_dir.vpk');
        const zipImpostor = join(dir, 'pak02_dir.vpk');
        const sevenZipImpostor = join(dir, 'pak03_dir.vpk');
        writeFileSync(good, vpkBytes(2));
        writeFileSync(zipImpostor, zipBytes({ 'inner_dir.vpk': vpkBytes(2) }));
        writeFileSync(sevenZipImpostor, SEVEN_ZIP_HEADER);

        expect(checkVpkFile(good).valid).toBe(true);
        expect(checkVpkFile(zipImpostor)).toMatchObject({ valid: false, format: 'zip' });
        expect(checkVpkFile(sevenZipImpostor)).toMatchObject({ valid: false, format: '7z' });
    });
});

describe('extractArchive (identity gate on extraction results)', () => {
    it('drops an archive entry that only looks like a VPK, and reports the type', async () => {
        const root = scratchDir();
        const dest = join(root, 'out');
        mkdirSync(dest, { recursive: true });

        const zip = new AdmZip();
        zip.addFile('real_dir.vpk', vpkBytes(2, 'REAL'));
        zip.addFile('notes_dir.vpk', Buffer.from('this is plain text, not a vpk at all'));
        const archive = join(root, 'mixed.zip');
        zip.writeZip(archive);

        const rejected: RejectedVpk[] = [];
        const extracted = await extractArchive(archive, dest, { rejected });

        expect(extracted.map((e) => e.fileName)).toEqual(['real_dir.vpk']);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].fileName).toBe('notes_dir.vpk');
        expect(rejected[0].format).toBe('unknown');
    });

    it('installs the inner VPK when an archive entry wraps exactly one', async () => {
        const root = scratchDir();
        const dest = join(root, 'out');
        mkdirSync(dest, { recursive: true });

        // The exact shape found in the live library: a ZIP renamed *_dir.vpk,
        // itself packed inside the archive the user actually imported.
        const outer = new AdmZip();
        outer.addFile('pak62_dir.vpk', zipBytes({ 'skin_dir.vpk': vpkBytes(2, 'INNER') }));
        const archive = join(root, 'wrapped.zip');
        outer.writeZip(archive);

        const extracted = await extractArchive(archive, dest);

        expect(extracted).toHaveLength(1);
        expect(checkVpkFile(extracted[0].path).valid).toBe(true);
        expect(readFileSync(extracted[0].path).subarray(29).toString('utf8')).toBe('INNER');
        // The original name is preserved for the installed-slot naming.
        expect(extracted[0].fileName).toBe('pak62_dir.vpk');
    });

    it('refuses to guess when the wrapper holds several VPKs', async () => {
        const root = scratchDir();
        const dest = join(root, 'out');
        mkdirSync(dest, { recursive: true });

        const outer = new AdmZip();
        outer.addFile(
            'pak62_dir.vpk',
            zipBytes({ 'a_dir.vpk': vpkBytes(2, 'A'), 'b_dir.vpk': vpkBytes(2, 'B') })
        );
        const archive = join(root, 'ambiguous.zip');
        outer.writeZip(archive);

        expect(await extractArchive(archive, dest)).toHaveLength(0);
    });
});

describe('resolveInstallableVpk (bare-file adoption paths)', () => {
    it('passes a real VPK straight through', async () => {
        const dir = scratchDir();
        const good = join(dir, 'pak01_dir.vpk');
        writeFileSync(good, vpkBytes(1));
        expect(await resolveInstallableVpk(good, dir)).toEqual({ path: good });
    });

    it('unwraps a ZIP renamed to _dir.vpk that wraps one VPK', async () => {
        const dir = scratchDir();
        const work = join(dir, 'work');
        mkdirSync(work, { recursive: true });
        const impostor = join(dir, 'pak62_dir.vpk');
        writeFileSync(impostor, zipBytes({ 'skin_dir.vpk': vpkBytes(2, 'INNER') }));

        const resolved = await resolveInstallableVpk(impostor, work);
        expect(resolved.path).not.toBe(impostor);
        expect(resolved.unwrappedFrom).toBe('ZIP archive');
        expect(checkVpkFile(resolved.path).valid).toBe(true);
    });

    it('rejects a 7-Zip impostor by name when it cannot be unwrapped', async () => {
        const dir = scratchDir();
        const work = join(dir, 'work');
        mkdirSync(work, { recursive: true });
        const impostor = join(dir, 'pak63_dir.vpk');
        // A truncated 7z: detected as 7-Zip, but nothing can be recovered.
        writeFileSync(impostor, SEVEN_ZIP_HEADER);

        await expect(resolveInstallableVpk(impostor, work)).rejects.toThrow(/7-Zip archive/);
    });

    it('rejects a file that is not an archive and not a VPK', async () => {
        const dir = scratchDir();
        const bogus = join(dir, 'pak64_dir.vpk');
        writeFileSync(bogus, Buffer.from('nothing recognizable here'));
        await expect(resolveInstallableVpk(bogus, dir)).rejects.toThrow(/not a VPK/);
    });
});

describe('reconcileInstalledVpks (already-installed impostors)', () => {
    it('reports an impostor with the detected type and does not remove it', async () => {
        const dir = scratchDir();
        const healthy = join(dir, 'pak01_dir.vpk');
        const impostor = join(dir, 'pak62_dir.vpk');
        writeFileSync(healthy, vpkBytes(2));
        writeFileSync(impostor, zipBytes({ 'skin_dir.vpk': vpkBytes(2, 'INNER') }));

        const reports = await reconcileInstalledVpks([
            { id: 'mod-healthy', name: 'A real skin', path: healthy },
            { id: 'mod-impostor', name: 'Renamed archive', path: impostor },
        ]);

        expect(reports).toHaveLength(1);
        expect(reports[0]).toMatchObject({
            modId: 'mod-impostor',
            fileName: 'pak62_dir.vpk',
            format: 'zip',
            label: 'ZIP archive',
            repairable: true,
            innerVpkName: 'skin_dir.vpk',
        });
        expect(reports[0].reason).toContain('ZIP archive');
        // The user's addons folder is theirs: nothing is deleted or moved.
        expect(existsSync(impostor)).toBe(true);
        expect(existsSync(healthy)).toBe(true);
    });

    it('flags an ambiguous wrapper as not repairable, still without removing it', async () => {
        const dir = scratchDir();
        const impostor = join(dir, 'pak63_dir.vpk');
        writeFileSync(
            impostor,
            zipBytes({ 'a_dir.vpk': vpkBytes(2, 'A'), 'b_dir.vpk': vpkBytes(2, 'B') })
        );

        const report = await inspectVpkImpostor({ id: 'm', name: 'Two inside', path: impostor });
        expect(report).toMatchObject({ format: 'zip', repairable: false });
        expect(report?.innerVpkName).toBeUndefined();
        expect(existsSync(impostor)).toBe(true);
    });

    it('returns nothing for a healthy library', async () => {
        const dir = scratchDir();
        const good = join(dir, 'pak01_dir.vpk');
        writeFileSync(good, vpkBytes(1));
        expect(await reconcileInstalledVpks([{ id: 'm', name: 'Fine', path: good }])).toEqual([]);
    });
});

describe('repairVpkImpostor (explicit user action)', () => {
    it('replaces the impostor with its inner VPK and keeps the original', async () => {
        const dir = scratchDir();
        const impostor = join(dir, 'pak62_dir.vpk');
        writeFileSync(impostor, zipBytes({ 'skin_dir.vpk': vpkBytes(2, 'INNER') }));

        const result = await repairVpkImpostor(impostor);

        expect(checkVpkFile(impostor).valid).toBe(true);
        expect(readFileSync(impostor).subarray(29).toString('utf8')).toBe('INNER');
        expect(result.innerVpkName).toBe('skin_dir.vpk');
        expect(result.backupPath).toBe(`${impostor}${IMPOSTOR_BACKUP_SUFFIX}`);
        // Nothing is destroyed: the original archive is still on disk.
        expect(existsSync(result.backupPath)).toBe(true);
    });

    it('refuses an ambiguous wrapper and leaves the slot untouched', async () => {
        const dir = scratchDir();
        const impostor = join(dir, 'pak63_dir.vpk');
        const original = zipBytes({ 'a_dir.vpk': vpkBytes(2, 'A'), 'b_dir.vpk': vpkBytes(2, 'B') });
        writeFileSync(impostor, original);

        await expect(repairVpkImpostor(impostor)).rejects.toThrow(/exactly one/);
        expect(readFileSync(impostor).equals(original)).toBe(true);
        expect(existsSync(`${impostor}${IMPOSTOR_BACKUP_SUFFIX}`)).toBe(false);
    });
});
