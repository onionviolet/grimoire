import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { FoundryForgeEdit, FoundryForgeRequest, VpkExportResult } from '../../../src/types/foundry';
import type { FoundryBuildInfo, FoundryBuildPart } from '../../../src/types/mod';
import { buildHeroSoundSwapVpk, cleanupHeroSoundSwapBuild } from './foundryCatalog';
import { buildTextureReplacementVpk, cleanupTextureReplacementBuild } from './foundryTextureReplace';
import { runVpkmerge, verifyVpkOutput } from './modMerger';
import { parseVpkDirectory } from './vpk';

const normalize = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
const soundEntry = (path: string) => normalize(path).replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');

export function reviewFoundryForge(edits: readonly FoundryForgeEdit[]) {
    const writers = new Map<string, Array<{ id: string; precedence: number; index: number }>>();
    edits.forEach((edit, index) => {
        const entries = edit.kind === 'sound'
            ? (edit.request.assignments ?? []).map(({ clipPath }) => soundEntry(clipPath))
            : [normalize(edit.request.entryPath)];
        for (const entry of new Set(entries.filter(Boolean))) {
            writers.set(entry, [...(writers.get(entry) ?? []), { id: edit.id, precedence: edit.precedence, index }]);
        }
    });
    const writeSet = [...writers.keys()].sort();
    const collisionWinners = [...writers.entries()]
        .filter(([, entries]) => entries.length > 1)
        .map(([file, entries]) => ({
            file,
            editId: [...entries].sort((a, b) => a.precedence - b.precedence || a.index - b.index).at(-1)!.id,
        }))
        .sort((a, b) => a.file.localeCompare(b.file));
    return { writeSet, collisionWinners };
}

const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

/**
 * Describe an installed build from the request main already validated, never
 * from anything the renderer labelled it. `writeSet` is the re-derived one, so
 * the recorded provenance and the VPK's real contents cannot drift: the caller
 * passes the same review the build was verified against.
 *
 * The whole request is retained as `reforge` so the build can be rebuilt
 * without re-authoring. Its source paths are the user's own files, so a rebuild
 * has to check they still exist rather than assuming this record is enough.
 */
export function describeFoundryBuild(
    request: FoundryForgeRequest,
    review: ReturnType<typeof reviewFoundryForge> = reviewFoundryForge(request.edits),
): FoundryBuildInfo {
    const parts: FoundryBuildPart[] = request.edits.map((edit) => {
        if (edit.kind === 'sound') {
            const assignments = edit.request.assignments ?? [];
            return {
                kind: 'sound',
                title: edit.request.name?.trim() || edit.request.event || 'Sound change',
                entries: [...new Set(assignments.map(({ clipPath }) => soundEntry(clipPath)).filter(Boolean))],
                heroName: edit.request.heroName?.trim() || undefined,
                event: edit.request.event,
                sourceFileName: edit.request.audioPath ? baseName(edit.request.audioPath) : undefined,
            };
        }
        return {
            kind: 'texture',
            title: edit.request.name?.trim() || baseName(edit.request.entryPath),
            entries: [normalize(edit.request.entryPath)].filter(Boolean),
            category: edit.request.category,
            heroName: edit.request.heroName?.trim() || undefined,
            sourceFileName: edit.request.imagePath ? baseName(edit.request.imagePath) : undefined,
        };
    });
    return { writeSet: review.writeSet, parts, reforge: request };
}

function sameReview(request: FoundryForgeRequest, review: ReturnType<typeof reviewFoundryForge>): boolean {
    return JSON.stringify(request.confirmation.writeSet.map(normalize).sort()) === JSON.stringify(review.writeSet)
        && JSON.stringify(request.confirmation.collisionWinners
            .map((winner) => ({ ...winner, file: normalize(winner.file) }))
            .sort((a, b) => a.file.localeCompare(b.file)))
            === JSON.stringify(review.collisionWinners);
}

/** Build every reviewed edit in isolated temp directories, then make exactly
 * one merged VPK. Nothing is installed here; callers may safely cancel export. */
export async function buildFoundryForgeVpk(deadlockPath: string, request: FoundryForgeRequest): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    if (!request.name.trim()) throw new Error('A name is required for the Foundry VPK.');
    if (!request.edits.length) throw new Error('Select at least one Foundry edit.');
    if (new Set(request.edits.map((edit) => edit.id)).size !== request.edits.length) throw new Error('A Foundry edit was selected more than once.');
    const review = reviewFoundryForge(request.edits);
    if (!review.writeSet.length || !sameReview(request, review)) throw new Error('The Foundry build review is stale. Review the final write-set again before forging.');
    const dir = await fs.mkdtemp(join(tmpdir(), `grimoire-foundry-forge-${randomUUID()}-`));
    const output = join(dir, 'foundry_dir.vpk');
    const built: Array<{ path: string; cleanup: () => Promise<void> }> = [];
    try {
        for (const edit of request.edits) {
            if (edit.kind === 'sound') {
                const part = await buildHeroSoundSwapVpk(deadlockPath, { ...edit.request, loop: edit.request.loop ?? 'auto' });
                built.push({ path: part.vpkPath, cleanup: () => cleanupHeroSoundSwapBuild(part.vpkPath) });
            } else if (edit.kind === 'texture') {
                const part = await buildTextureReplacementVpk(deadlockPath, edit.request.entryPath, edit.request.imagePath);
                built.push({ path: part.vpkPath, cleanup: () => cleanupTextureReplacementBuild(part.vpkPath) });
            }
        }
        // vpkmerge's last writer wins. Sorting ascending therefore makes the
        // exact winner shown in the review write last, with stage order as tie-break.
        const ordered = request.edits.map((edit, index) => ({ edit, index, path: built[index].path }))
            .sort((a, b) => a.edit.precedence - b.edit.precedence || a.index - b.index);
        if (ordered.length === 1) await fs.copyFile(ordered[0].path, output);
        else await runVpkmerge([output, ...ordered.map((part) => part.path)]);
        await verifyVpkOutput(output);
        const actual = parseVpkDirectory(output);
        const actualWriteSet = actual ? [...new Set(actual.map(normalize))].sort() : null;
        if (!actualWriteSet || JSON.stringify(actualWriteSet) !== JSON.stringify(review.writeSet)) {
            throw new Error('The forged VPK did not match the confirmed write-set; no file was exported.');
        }
        return { vpkPath: output, cleanup: () => fs.rm(dir, { recursive: true, force: true }).catch(() => {}) };
    } catch (error) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw error;
    } finally {
        // Part cleanup is best effort on purpose. A failure to remove one part's
        // scratch directory must not reject a build that already succeeded, or
        // the merged directory above would be returned to nobody and leak.
        await Promise.all(built.map((part) => part.cleanup().catch(() => {})));
    }
}

/**
 * Build, then export, then always remove the build temp: the atomic-cancel
 * contract in one place so the IPC handler cannot drift from it.
 *
 * Cancelling the save dialog is a normal `{ exported: false }` result, not an
 * error, and it must leave zero residue: no temp directory, no installed mod
 * touched, no load order changed. A build that throws partway is the same
 * promise, which is why the cleanup lives in `finally` rather than on the
 * success branch. Staged edits live in the renderer and are never cleared from
 * here, so a cancelled forge is fully retryable.
 */
export async function forgeAndExportFoundryVpk(
    request: FoundryForgeRequest,
    build: () => Promise<{ vpkPath: string; cleanup: () => Promise<void> }>,
    exportVpk: (vpkPath: string, suggestedName: string) => Promise<VpkExportResult>,
): Promise<VpkExportResult> {
    const built = await build();
    try {
        const safe = request.name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || 'Foundry mod';
        return await exportVpk(built.vpkPath, `${safe}_dir.vpk`);
    } finally {
        // Never let a cleanup failure rewrite the user-visible outcome of an
        // export that already landed (or of a cancel that changed nothing).
        await built.cleanup().catch(() => {});
    }
}
