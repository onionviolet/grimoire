import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { readVpkEntryBytes } from './vpk';
import { runVpkmergeStdout } from './modMerger';
import { modelEntryForHero, soundCodenameForHeroName } from '../../../src/lib/heroIdentity';
import type { FxAttachment } from '../../../src/components/locker/fxDescriptor';
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
/** MDAT uses the same authored KV3 codec as DATA. Retag a private copy so the
 * existing read-only generic decoder can expose mesh attachments, without
 * editing the game resource or rebuilding its KV3. */
export function modelAttachmentResource(source: Buffer): Buffer | null {
    if (source.length < 16 || source.length > 128 * 1024 * 1024) return null;
    const table = 8 + source.readUInt32LE(8), count = source.readUInt32LE(12);
    if (count > 128 || table < 16 || table + count * 12 > source.length) return null;
    const output = Buffer.from(source);
    let found = false;
    for (let index = 0; index < count; index++) {
        const at = table + index * 12, tag = source.toString('ascii', at, at + 4);
        const start = at + 4 + source.readUInt32LE(at + 4), size = source.readUInt32LE(at + 8);
        if (start < table + count * 12 || start + size > source.length) return null;
        if (tag === 'DATA') output.write('ODAT', at, 'ascii');
        if (tag === 'MDAT' && !found) { output.write('DATA', at, 'ascii'); found = true; }
    }
    return found ? output : null;
}
export function attachmentsFromKv3(value: unknown): FxAttachment[] {
    return array(record(value).m_attachments).slice(0, 128).flatMap(value => {
        const outer = record(value), attachment = record(outer.value ?? value);
        if (typeof attachment.m_name !== 'string') return [];
        const count = attachment.m_nInfluences;
        if (typeof count !== 'number' || count < 1 || count > 8) return [];
        const names = array(attachment.m_influenceNames), offsets = array(attachment.m_vInfluenceOffsets), weights = array(attachment.m_influenceWeights), roots = array(attachment.m_bInfluenceRootTransform);
        const influences = names.slice(0, count).flatMap((bone, index) => {
            const offset = offsets[index], weight = weights[index];
            if (typeof bone !== 'string' || !Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isFinite) || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) return [];
            return [{ bone, offset: offset as [number, number, number], weight, rootTransform: roots[index] === true }];
        });
        return influences.length === count ? [{ name: attachment.m_name, influences }] : [];
    });
}
export async function heroParticleAttachments(pak: string, heroName: string, cacheDir: string): Promise<FxAttachment[]> {
    let entry = modelEntryForHero(heroName);
    if (!entry) {
        const code = soundCodenameForHeroName(heroName);
        if (!code) return [];
        const json = JSON.parse(await runVpkmergeStdout(['model', 'live-materials', '--vpk', pak, '--hero', code, '--json'])) as unknown;
        const entries = [...new Set(array(json).map(value => record(value).model_entry).filter((entry): entry is string => typeof entry === 'string'))];
        if (entries.length !== 1) return [];
        entry = entries[0];
    }
    const source = readVpkEntryBytes(pak, entry);
    if (!source) return [];
    const wrapped = modelAttachmentResource(source);
    if (!wrapped) return [];
    await fs.mkdir(cacheDir, { recursive: true });
    const temporary = join(cacheDir, `${randomUUID()}.attachment-resource`);
    try {
        await fs.writeFile(temporary, wrapped);
        return attachmentsFromKv3(JSON.parse(await runVpkmergeStdout(['soundevents', temporary])));
    } finally { await fs.rm(temporary, { force: true }); }
}
