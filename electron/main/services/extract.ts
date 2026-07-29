import { existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync, rmdirSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { randomBytes } from 'crypto';
import AdmZip from 'adm-zip';
import { spawn } from 'child_process';
import { createExtractorFromData } from 'node-unrar-js';
import { path7za as bundled7zaPath } from '7zip-bin';
import {
    checkVpkFile,
    describeVpkRejection,
    isUnpackableArchiveFormat,
    type VpkFileFormat,
} from './vpk';

/**
 * Resolve a node_modules binary path to its asar.unpacked location when packaged.
 * electron-builder rewrites __dirname inside the asar, so bundled binaries
 * (which must be executable on disk) live at app.asar.unpacked instead.
 */
function resolveUnpackedPath(p: string): string {
    return p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

/**
 * Find 7z executable paths, preferring the bundled binary over system installs.
 */
export function find7zPath(): string[] {
    const candidates: string[] = [];

    // 1. Bundled 7za (ships with the app, no user install required)
    const bundled = resolveUnpackedPath(bundled7zaPath);
    if (existsSync(bundled)) {
        candidates.push(bundled);
    }

    // 2. Common Windows install paths (faster for huge archives)
    const windowsPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    ];
    for (const p of windowsPaths) {
        if (existsSync(p)) {
            candidates.push(p);
        }
    }

    // 3. PATH fallback
    candidates.push('7z', '7za');

    return candidates;
}

/**
 * Check if a file is an archive that needs extraction
 */
export function isArchive(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ext === '.zip' || ext === '.7z' || ext === '.rar';
}

/**
 * Check the archive for the GameBanana 1-Click opt-out markers.
 * Mod authors can disable mod-manager integration by including an empty
 * `.disable_gb1click` (all managers) or `.disable_gb1click_grimoire` (just us)
 * file anywhere in the archive — see https://gamebanana.com/wikis/1999.
 */
export async function checkOneClickOptOut(
    archivePath: string
): Promise<{ disabled: boolean; reason?: string }> {
    let entries: string[];
    try {
        entries = await listArchiveContents(archivePath);
    } catch {
        // If we can't list, let extraction handle the error path.
        return { disabled: false };
    }

    for (const entry of entries) {
        const name = basename(entry).toLowerCase();
        if (name === '.disable_gb1click_grimoire') {
            return { disabled: true, reason: 'The mod author disabled Grimoire 1-Click for this mod.' };
        }
        if (name === '.disable_gb1click') {
            return { disabled: true, reason: 'The mod author disabled all 1-Click installers for this mod.' };
        }
    }
    return { disabled: false };
}

/**
 * Scan an archive's listing for files with extensions that are unusual for a
 * Deadlock mod (executables, scripts, installers). Deadlock mods are pure VPK
 * content packs — there's no legitimate reason to ship a .exe or .dll. The
 * extract pipeline already filters by extension so these files can't reach
 * the game folder, but per the GameBanana 1-Click spec we still surface them
 * to the user before installing.
 */
const SUSPICIOUS_EXTENSIONS = new Set([
    '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.scr',
    '.ps1', '.psm1', '.vbs', '.js', '.jar', '.lnk', '.reg', '.hta', '.wsf',
]);

export async function scanSuspiciousFiles(archivePath: string): Promise<string[]> {
    let entries: string[];
    try {
        entries = await listArchiveContents(archivePath);
    } catch {
        return [];
    }

    const flagged: string[] = [];
    for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        if (SUSPICIOUS_EXTENSIONS.has(ext)) {
            flagged.push(entry);
        }
    }
    return flagged;
}

export interface ExtractedVpk {
    /** Absolute path of the extracted VPK in the destination directory. */
    path: string;
    /** The VPK's original basename inside the archive, used to derive its
     *  installed name. Differs from basename(path) only when a duplicate
     *  basename was suffixed to keep both variants on disk. */
    fileName: string;
    /** Immediate parent folder inside the archive, when present. Multi-variant
     *  mods use these folders as the per-variant label. */
    archiveFolder?: string;
}

/**
 * The immediate parent folder of an archive entry, or undefined when the entry
 * sits at the archive root. Multi-variant mods use these folders (e.g.
 * `Beard/pak83_dir.vpk`, `NoBeard/pak83_dir.vpk`) as the only label that
 * distinguishes otherwise identically-named VPKs.
 */
function archiveParentFolder(entryName: string): string | undefined {
    const parts = entryName.split(/[\\/]/).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

/**
 * A destination filename guaranteed not to collide with one already taken this
 * extraction. Sibling variant folders routinely ship an identically-named
 * pakNN_dir.vpk; flattening them to the same basename made the second silently
 * overwrite the first (data loss) and left the install referencing a file that
 * no longer existed on disk. Suffixing duplicates keeps every variant.
 */
function uniqueDestName(fileName: string, taken: Set<string>): string {
    if (!taken.has(fileName.toLowerCase())) {
        taken.add(fileName.toLowerCase());
        return fileName;
    }
    const ext = fileName.toLowerCase().endsWith('_dir.vpk') ? fileName.slice(-8) : extname(fileName);
    const stem = fileName.slice(0, fileName.length - ext.length);
    let n = 2;
    let candidate = `${stem}_${n}${ext}`;
    while (taken.has(candidate.toLowerCase())) {
        n++;
        candidate = `${stem}_${n}${ext}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
}

/** Archive containers this module can unpack. */
export type ArchiveFormat = 'zip' | '7z' | 'rar';

/** A file that carried a `.vpk` name but is not a VPK. */
export interface RejectedVpk {
    /** The name it had inside the archive (or on disk). */
    fileName: string;
    /** What the magic bytes say it actually is. */
    format: VpkFileFormat;
    /** Human-readable format name, e.g. "7-Zip archive". */
    label: string;
    /** One sentence naming the real type, safe to show the user. */
    reason: string;
}

export interface ExtractArchiveOptions {
    /** Force a container format instead of sniffing/using the extension. */
    format?: ArchiveFormat;
    /** Receives every extracted file that failed the VPK identity gate. */
    rejected?: RejectedVpk[];
    /** Internal: bounds the archive-in-archive unwrap to one level. */
    depth?: number;
}

/**
 * Container format from the file's magic bytes, or null when it is not an
 * archive we unpack. Magic beats the extension here for the same reason lane A
 * exists: a mislabelled file is exactly the case we are trying to survive.
 */
export function detectArchiveFormat(filePath: string): ArchiveFormat | null {
    const check = checkVpkFile(filePath);
    return isUnpackableArchiveFormat(check.format) ? check.format : null;
}

function archiveFormatFromExtension(filePath: string): ArchiveFormat | null {
    switch (extname(filePath).toLowerCase()) {
        case '.zip': return 'zip';
        case '.7z': return '7z';
        case '.rar': return 'rar';
        default: return null;
    }
}

/**
 * Extract an archive to a destination directory.
 *
 * Returns the list of extracted files that are REAL VPKs. Anything named
 * `*.vpk` inside the archive that turns out to be something else is either
 * unwrapped (when it is itself an archive wrapping exactly one VPK, which is
 * the case that shipped six inert mods into a real library) or left out of the
 * install set and reported through `options.rejected`.
 *
 * The gate decides what gets INSTALLED; it never decides what gets to exist.
 * Rejected entries stay on disk in `destDir` (a staging dir owned by the
 * caller) so an optional addon, a nested bundle or a readme the gate could not
 * identify is still there for the caller to look at.
 */
export async function extractArchive(
    archivePath: string,
    destDir: string,
    options: ExtractArchiveOptions = {}
): Promise<ExtractedVpk[]> {
    const format =
        options.format ?? detectArchiveFormat(archivePath) ?? archiveFormatFromExtension(archivePath);

    let raw: ExtractedVpk[];
    switch (format) {
        case 'zip':
            raw = extractZip(archivePath, destDir);
            break;
        case '7z':
            raw = await extract7z(archivePath, destDir);
            break;
        case 'rar':
            raw = await extractRar(archivePath, destDir);
            break;
        default:
            throw new Error(`Unknown archive format: ${extname(archivePath) || archivePath}`);
    }

    return validateExtractedVpks(raw, destDir, options);
}

/**
 * Apply the VPK identity gate to a freshly extracted set. Valid VPKs pass
 * through untouched; an entry that is really an archive is unwrapped when it
 * contains exactly one VPK; everything else is recorded and left where it is.
 *
 * Nothing is deleted here. The gate is a detector, and a detector that is
 * unsure about a file has no business destroying it: an entry it cannot
 * identify is far more likely to be an optional addon or a multi-VPK bundle
 * than garbage.
 */
async function validateExtractedVpks(
    entries: ExtractedVpk[],
    destDir: string,
    options: ExtractArchiveOptions
): Promise<ExtractedVpk[]> {
    const depth = options.depth ?? 0;
    const taken = new Set(entries.map((e) => basename(e.path).toLowerCase()));
    const kept: ExtractedVpk[] = [];

    for (const entry of entries) {
        const check = checkVpkFile(entry.path);
        if (check.valid) {
            kept.push(entry);
            continue;
        }

        if (depth < 1 && isUnpackableArchiveFormat(check.format)) {
            const inner = await unwrapInnerVpks(entry.path, destDir, check.format, taken);
            if (inner.length === 1) {
                console.warn(
                    `[extractArchive] ${entry.fileName} was a ${check.label}; installed the single VPK it contained instead.`
                );
                // The wrapper stays in the staging dir; only the VPK we pulled
                // out of it goes into the install set. The wrapper's name is
                // kept so the installed slot is named after the file the user
                // recognises.
                kept.push({ ...entry, path: inner[0].path });
                continue;
            }
            if (inner.length > 1) {
                // Several VPKs inside one wrapper: the old code dropped the
                // whole thing as ambiguous, which made the mod disappear from
                // the install entirely. Hand all of them to the caller instead
                // and let the multi-VPK picker ask which to keep. The wrapper
                // name becomes the variant label, the same role a variant
                // folder plays for a normally packed archive.
                console.warn(
                    `[extractArchive] ${entry.fileName} was a ${check.label} holding ${inner.length} VPKs; offering all of them.`
                );
                const label = archiveStem(entry.fileName);
                for (const vpk of inner) {
                    kept.push({
                        path: vpk.path,
                        fileName: vpk.fileName,
                        archiveFolder: vpk.archiveFolder ?? label,
                    });
                }
                continue;
            }
        }

        console.warn(
            `[extractArchive] Not installing ${entry.fileName}: ${check.reason ?? 'not a VPK'} (left in ${destDir})`
        );
        options.rejected?.push({
            fileName: entry.fileName,
            format: check.format,
            label: check.label,
            reason: describeVpkRejection(entry.fileName, check),
        });
    }

    return kept;
}

/** An archive's name without its extension, used as a variant label. */
function archiveStem(fileName: string): string {
    const base = basename(fileName);
    const ext = base.toLowerCase().endsWith('_dir.vpk') ? base.slice(-8) : extname(base);
    return base.slice(0, base.length - ext.length) || base;
}

/**
 * When `filePath` is really an archive, extract every VPK it contains into
 * `destDir` and return them. An empty array means it held no VPKs at all, or
 * could not be read. Callers decide what to do with more than one: the archive
 * paths offer them all through the picker, the bare-file paths refuse to guess.
 */
async function unwrapInnerVpks(
    filePath: string,
    destDir: string,
    format: ArchiveFormat,
    taken: Set<string>
): Promise<ExtractedVpk[]> {
    const scratch = createTempDir('grimoire-unwrap');
    try {
        const inner = await extractArchive(filePath, scratch, { format, depth: 1 });
        return inner.map((vpk) => {
            const destPath = join(destDir, uniqueDestName(basename(vpk.path), taken));
            copyFileSync(vpk.path, destPath);
            return { ...vpk, path: destPath };
        });
    } catch (error) {
        console.warn(`[extractArchive] Could not unwrap ${basename(filePath)}:`, error);
        return [];
    } finally {
        try { rmDirRecursive(scratch); } catch { /* ignore cleanup errors */ }
    }
}

/**
 * Resolve ONE candidate file into an installable VPK path.
 *
 * - A real VPK resolves to itself.
 * - An archive (whatever its extension says) that wraps exactly one VPK
 *   resolves to that inner VPK, extracted into `workDir`.
 * - Anything else throws an error naming the detected type.
 *
 * This is the single entry point for the adoption paths that handle a bare
 * file rather than an archive listing: custom import, drag-drop, and a direct
 * `.vpk` download.
 */
export async function resolveInstallableVpk(
    filePath: string,
    workDir: string,
    displayName = basename(filePath)
): Promise<{ path: string; unwrappedFrom?: string }> {
    const check = checkVpkFile(filePath);
    if (check.valid) return { path: filePath };

    if (isUnpackableArchiveFormat(check.format)) {
        // Bare-file adoption has no picker to fall back on, so it still refuses
        // to guess between several inner VPKs. Nothing is removed either way.
        const inner = await unwrapInnerVpks(filePath, workDir, check.format, new Set());
        if (inner.length === 1) return { path: inner[0].path, unwrappedFrom: check.label };
        throw new Error(
            `${displayName} is a ${check.label}, not a VPK, and it does not contain exactly one VPK to install instead.`
        );
    }

    throw new Error(describeVpkRejection(displayName, check));
}

/**
 * Extract a ZIP archive
 */
function extractZip(archivePath: string, destDir: string): ExtractedVpk[] {
    const zip = new AdmZip(archivePath);
    const extracted: ExtractedVpk[] = [];
    const taken = new Set<string>();

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        const fileName = basename(entry.entryName);
        if (extname(fileName).toLowerCase() !== '.vpk') continue;

        // Write straight to the chosen name rather than extractEntryTo, which can
        // only flatten to the entry's own basename and so clobbers same-named
        // VPKs from sibling variant folders.
        const destPath = join(destDir, uniqueDestName(fileName, taken));
        writeFileSync(destPath, entry.getData());
        extracted.push({ path: destPath, fileName, archiveFolder: archiveParentFolder(entry.entryName) });
    }

    return extracted;
}

/**
 * Extract a 7z archive using the bundled 7za binary (falls back to system 7z).
 */
async function extract7z(archivePath: string, destDir: string): Promise<ExtractedVpk[]> {
    const tempDir = createTempDir('modmanager-7z');

    try {
        for (const tool of find7zPath()) {
            try {
                await runCommand(tool, ['x', '-y', `-o${tempDir}`, archivePath]);
                const vpks = collectVpks(tempDir);
                return copyVpksToDest(vpks, destDir, tempDir);
            } catch {
                // Try next tool
            }
        }

        throw new Error(
            "Failed to extract 7z archive. The bundled extractor failed and no system 7-Zip was found. Please install 7-Zip from https://7-zip.org and try again."
        );
    } finally {
        try {
            rmDirRecursive(tempDir);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Extract a RAR archive. Uses node-unrar-js (pure JS, no external binary) by
 * default; falls back to the bundled 7za or system unrar if the in-process
 * extractor fails (e.g. RAR5-specific features it can't handle).
 */
async function extractRar(archivePath: string, destDir: string): Promise<ExtractedVpk[]> {
    // Primary path: pure-JS in-process RAR extractor (no install required).
    try {
        const data = readFileSync(archivePath);
        // Create an ArrayBuffer copy (node-unrar-js expects ArrayBuffer, not Buffer)
        const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const extractor = await createExtractorFromData({ data: ab });

        const extracted = extractor.extract({
            files: (header) => !header.flags.directory && extname(header.name).toLowerCase() === '.vpk',
        });

        const extractedVpks: ExtractedVpk[] = [];
        const taken = new Set<string>();
        for (const file of extracted.files) {
            if (!file.extraction) continue;
            const fileName = basename(file.fileHeader.name);
            const destPath = join(destDir, uniqueDestName(fileName, taken));
            writeFileSync(destPath, Buffer.from(file.extraction));
            extractedVpks.push({ path: destPath, fileName, archiveFolder: archiveParentFolder(file.fileHeader.name) });
        }

        if (extractedVpks.length > 0) {
            return extractedVpks;
        }
        // No VPKs found via in-process — fall through to 7za/unrar in case of
        // odd RAR5 solid archives that node-unrar-js can't iterate.
    } catch (err) {
        console.warn('[extractRar] node-unrar-js failed, falling back to system tools:', err);
    }

    // Fallback path: bundled 7za, system 7z, or system unrar.
    const tempDir = createTempDir('modmanager-rar');
    try {
        for (const tool of [...find7zPath(), 'unrar']) {
            try {
                if (tool === 'unrar') {
                    await runCommand(tool, ['x', '-y', archivePath, tempDir]);
                } else {
                    await runCommand(tool, ['x', '-y', `-o${tempDir}`, archivePath]);
                }
                const vpks = collectVpks(tempDir);
                return copyVpksToDest(vpks, destDir, tempDir);
            } catch {
                // Try next tool
            }
        }

        throw new Error(
            "RAR extraction failed. The bundled extractor could not read this archive. Please install 7-Zip from https://7-zip.org and try again."
        );
    } finally {
        try {
            rmDirRecursive(tempDir);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Run a command and wait for it to complete
 * Includes timeout to prevent indefinite hangs (P1 fix #6)
 */
function runCommand(cmd: string, args: string[], timeoutMs = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: 'pipe' });
        let stderr = '';
        let killed = false;

        // Set timeout to prevent indefinite hangs (5 minutes default)
        const timeoutId = setTimeout(() => {
            killed = true;
            proc.kill('SIGTERM');
            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill('SIGKILL');
                }
            }, 5000);
            reject(new Error(`${cmd} timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);

        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            clearTimeout(timeoutId);
            if (killed) return; // Already rejected by timeout
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${cmd} failed with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            if (killed) return;
            reject(new Error(`${cmd} failed to run: ${err.message}`));
        });
    });
}

/**
 * Recursively collect VPK files from a directory
 */
function collectVpks(dir: string): string[] {
    const vpks: string[] = [];

    function walk(currentDir: string): void {
        if (!existsSync(currentDir)) return;

        const entries = readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (extname(entry.name).toLowerCase() === '.vpk') {
                vpks.push(fullPath);
            }
        }
    }

    walk(dir);
    return vpks;
}

/**
 * Copy VPK files to destination directory (flattening structure). `rootDir` is
 * the extraction root, used to recover each VPK's variant folder; same-named
 * VPKs from sibling folders are kept under suffixed names instead of colliding.
 */
function copyVpksToDest(vpks: string[], destDir: string, rootDir: string): ExtractedVpk[] {
    const copied: ExtractedVpk[] = [];
    const taken = new Set<string>();

    for (const vpk of vpks) {
        const fileName = basename(vpk);
        const destPath = join(destDir, uniqueDestName(fileName, taken));
        copyFileSync(vpk, destPath);
        const parent = dirname(vpk);
        copied.push({
            path: destPath,
            fileName,
            archiveFolder: parent === rootDir ? undefined : basename(parent),
        });
    }

    return copied;
}

/**
 * Create a temporary directory with cryptographically secure random name
 * (P0 security fix #3 - prevents race condition attacks)
 */
function createTempDir(prefix: string): string {
    const randomSuffix = randomBytes(16).toString('hex');
    const tmpDir = join(
        process.env.TMPDIR || process.env.TMP || '/tmp',
        `${prefix}-${randomSuffix}`
    );
    mkdirSync(tmpDir, { recursive: true, mode: 0o700 }); // Restrict permissions
    return tmpDir;
}

/**
 * Recursively remove a directory
 */
function rmDirRecursive(dir: string): void {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            rmDirRecursive(fullPath);
        } else {
            unlinkSync(fullPath);
        }
    }

    rmdirSync(dir);
}

/**
 * List contents of an archive (for Mina variants)
 */
export async function listArchiveContents(
    archivePath: string,
    format?: ArchiveFormat
): Promise<string[]> {
    const resolved = format ?? detectArchiveFormat(archivePath) ?? archiveFormatFromExtension(archivePath);
    const ext = resolved ? `.${resolved}` : extname(archivePath).toLowerCase();

    if (ext === '.zip') {
        const zip = new AdmZip(archivePath);
        return zip.getEntries().map((e) => e.entryName);
    }

    // For 7z/rar, use 7z to list - try all candidates
    const candidates = find7zPath();

    const tryCandidate = (index: number): Promise<string[]> => {
        if (index >= candidates.length) {
            return Promise.reject(new Error('Failed to list archive contents. Install 7-Zip and try again.'));
        }

        return new Promise((resolve, reject) => {
            const proc = spawn(candidates[index], ['l', '-ba', archivePath], { stdio: 'pipe' });
            let stdout = '';

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    // Parse 7z output - extract filenames
                    const lines = stdout.split('\n').filter((l) => l.trim());
                    const files = lines
                        .map((line) => {
                            // 7z -ba output format: date time attr size compressed name
                            const parts = line.trim().split(/\s+/);
                            return parts.slice(5).join(' ');
                        })
                        .filter((f) => f);
                    resolve(files);
                } else {
                    // Try next candidate
                    tryCandidate(index + 1).then(resolve).catch(reject);
                }
            });

            proc.on('error', () => {
                // Try next candidate
                tryCandidate(index + 1).then(resolve).catch(reject);
            });
        });
    };

    return tryCandidate(0);
}
