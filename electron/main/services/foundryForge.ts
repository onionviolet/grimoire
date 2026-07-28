import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { FoundryForgeEdit, FoundryForgeRequest } from '../../../src/types/foundry';
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
        return { vpkPath: output, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
    } catch (error) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw error;
    } finally {
        await Promise.all(built.map((part) => part.cleanup()));
    }
}
