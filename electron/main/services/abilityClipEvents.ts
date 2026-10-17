import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { readVpkEntryBytes } from './vpk';
import { runVpkmergeStdout } from './modMerger';
import type { EmbeddedClipEvent, EmbeddedClipEventMetadata } from '../../../src/types/abilityEvents';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

export interface EmbeddedClipExpectedMetadata { fps: number; frameCount: number }

/** The generic KV3 reader selects DATA. Retag only a validated private copy of
 * the existing model's ANIM or ASEQ block, keeping payloads and offsets intact. */
function resourceBlocks(source: Buffer): Array<{ at: number; tag: string }> | null {
    if (source.length < 16 || source.length > 128 * 1024 * 1024 || source.readUInt16LE(4) !== 12) return null;
    const declaredSize = source.readUInt32LE(0);
    if (declaredSize < 16 || declaredSize > source.length) return null;
    const table = 8 + source.readUInt32LE(8), count = source.readUInt32LE(12);
    if (count < 1 || count > 128 || table < 16 || table + count * 12 > declaredSize) return null;
    const blocks: Array<{ at: number; tag: string }> = [];
    for (let index = 0; index < count; index++) {
        const at = table + index * 12, tag = source.toString('ascii', at, at + 4);
        const start = at + 4 + source.readUInt32LE(at + 4), size = source.readUInt32LE(at + 8);
        if (start < table + count * 12 || start + size > source.length) return null;
        blocks.push({ at, tag });
    }
    return blocks;
}

export function embeddedClipEventResource(source: Buffer, selected: 'ANIM' | 'ASEQ'): Buffer | null {
    const blocks = resourceBlocks(source);
    if (!blocks) return null;
    const matches = blocks.filter(block => block.tag === selected).length;
    if (matches !== 1) return null;
    const output = Buffer.from(source);
    for (const { at, tag } of blocks) {
        if (tag === 'DATA') output.write('ODAT', at, 'ascii');
        if (tag === selected) output.write('DATA', at, 'ascii');
    }
    return output;
}

/** Matches the pinned morphic exporter: exact ASEQ names resolve through the
 * first fetch reference into ANIM, then unreferenced names are exported directly.
 * See animation.rs at onionviolet/vpkmerge 798f3a7d28f3ef314d8f6ebf51ced0d9fe049445.
 * Sound and particle semantics remain unresolved raw metadata. */
export function embeddedClipEventsFromKv3(
    modelEntry: string,
    clipName: string,
    animValue: unknown,
    sequenceValue?: unknown,
    expected?: EmbeddedClipExpectedMetadata
): EmbeddedClipEventMetadata {
    const provenance: EmbeddedClipEventMetadata['provenance'] = { modelEntry, clipName, format: 'ANIM/ASEQ' };
    const result = (status: EmbeddedClipEventMetadata['status'], reason: string): EmbeddedClipEventMetadata => ({ status, reason, provenance, events: [] });
    const animations = record(animValue).m_animArray;
    if (!Array.isArray(animations) || animations.length > 4096) return result('unsupported', 'invalid-animation-array');
    if (animations.length === 0) return { ...result('unavailable', 'no-embedded-clips'), hasEmbeddedClips: false };
    const candidates: RecordValue[] = [];
    const processed = new Set<string>();
    if (sequenceValue !== undefined) {
        const sequences = record(sequenceValue);
        const names = array(sequences.m_localSequenceNameArray), descriptors = array(sequences.m_localS1SeqDescArray);
        if (names.length > 4096 || descriptors.length > 4096) return result('unsupported', 'sequence-limit');
        // Duplicate source names have no auditable one-to-one event donor.
        const lookup = new Map<string, RecordValue[]>();
        for (const value of animations) {
            const animation = record(value);
            if (typeof animation.m_name === 'string') lookup.set(animation.m_name, [...(lookup.get(animation.m_name) ?? []), animation]);
        }
        for (const value of descriptors) {
            const sequence = record(value), refs = array(record(sequence.m_fetch).m_localReferenceArray), index = refs[0];
            if (!Number.isInteger(index) || typeof index !== 'number' || index < 0 || index >= names.length || typeof sequence.m_sName !== 'string') continue;
            const name = names[index];
            if (typeof name !== 'string') continue;
            const matched = lookup.get(name) ?? [];
            if (matched.length === 0) continue;
            processed.add(sequence.m_sName);
            if (sequence.m_sName === clipName) candidates.push(...matched);
        }
    }
    for (const value of animations) {
        const animation = record(value);
        if (animation.m_name === clipName && !processed.has(clipName)) candidates.push(animation);
    }
    if (candidates.length === 0) return result('unavailable', 'clip-not-found');
    if (candidates.length !== 1) return result('unsupported', 'ambiguous-exported-clip');
    const animation = candidates[0];
    provenance.animationName = animation.m_name as string;
    const fps = animation.fps, data = record(animation.m_pData);
    const blockEnd = array(data.m_frameblockArray).reduce<number>((maximum, value) => {
        const block = record(value), start = block.m_nStartFrame, end = block.m_nEndFrame;
        return Number.isInteger(start) && typeof start === 'number' && start >= 0 && Number.isInteger(end) && typeof end === 'number' && end >= 0 ? Math.max(maximum, end) : maximum;
    }, -1);
    const frameCount = Number.isInteger(data.m_nFrames) && typeof data.m_nFrames === 'number' && data.m_nFrames > 0 ? data.m_nFrames : blockEnd + 1;
    if (!finite(fps) || fps <= 0 || frameCount < 1 || frameCount > 100000) return result('unsupported', 'invalid-clip-timing');
    if (expected && (expected.frameCount !== frameCount || !finite(expected.fps) || Math.abs(expected.fps - fps) > Math.max(1, Math.abs(fps)) * 1e-5)) return result('unsupported', 'exported-timing-mismatch');
    const metadata = { fps, frameCount, durationSeconds: (frameCount - 1) / fps, hasEmbeddedClips: true };
    if (!Array.isArray(animation.m_eventArray)) return { ...result('unavailable', 'event-array-absent'), ...metadata };
    if (animation.m_eventArray.length > 512) return { ...result('unsupported', 'event-limit'), ...metadata };
    const events: EmbeddedClipEvent[] = [];
    for (const value of animation.m_eventArray) {
        const event = record(value), frame = event.m_nFrame, end = event.m_nEndFrame;
        if (typeof event.m_sEventName !== 'string' || event.m_sEventName.length < 1 || event.m_sEventName.length > 512 || !Number.isInteger(frame) || typeof frame !== 'number' || frame < 0 || frame >= frameCount) return { ...result('unsupported', 'invalid-event'), ...metadata };
        if (end !== undefined && end !== -1 && (!Number.isInteger(end) || typeof end !== 'number' || end < frame || end >= frameCount)) return { ...result('unsupported', 'invalid-event-window'), ...metadata };
        if ((event.m_flCycle !== undefined && (!finite(event.m_flCycle) || event.m_flCycle < 0 || event.m_flCycle > 1)) || (event.m_flDuration !== undefined && (!finite(event.m_flDuration) || event.m_flDuration < 0))) return { ...result('unsupported', 'invalid-event-timing'), ...metadata };
        const endFrame = typeof end === 'number' && end >= 0 ? end : null;
        events.push({ name: event.m_sEventName, frame, endFrame, cycle: finite(event.m_flCycle) ? event.m_flCycle : null,
            authoredDuration: finite(event.m_flDuration) ? event.m_flDuration : null,
            timeSeconds: frame / fps, durationSeconds: endFrame === null ? null : (endFrame - frame) / fps,
            eventData: event.m_EventData && typeof event.m_EventData === 'object' && !Array.isArray(event.m_EventData) ? event.m_EventData as RecordValue : null,
            options: typeof event.m_sOptions === 'string' ? event.m_sOptions : null });
    }
    return { status: 'available', provenance, ...metadata, events };
}

/** Caller must supply the exact animation donor selected by model export.
 * No hero discovery, filename matching or loose NM clip association occurs here. */
export async function readEmbeddedClipEvents(
    pak: string,
    modelEntry: string,
    clipName: string,
    cacheDir: string,
    expected?: EmbeddedClipExpectedMetadata
): Promise<EmbeddedClipEventMetadata> {
    const unavailable = (reason: string): EmbeddedClipEventMetadata => ({ status: 'unavailable', reason, provenance: { modelEntry, clipName, format: 'ANIM/ASEQ' }, events: [] });
    if (!modelEntry.endsWith('.vmdl_c') || modelEntry.includes('\\') || modelEntry.split('/').some(part => !part || part === '.' || part === '..')) return unavailable('invalid-model-entry');
    let temporary: string | null = null;
    try {
        const source = readVpkEntryBytes(pak, modelEntry);
        if (!source) return unavailable('model-absent');
        const blocks = resourceBlocks(source);
        if (!blocks) return { ...unavailable('invalid-model-resource'), status: 'unsupported' };
        // morphic::model::animation::decode_all returns zero clips whenever either
        // block is absent. A source with some unresolved clips must not fall back.
        if (!blocks.some(block => block.tag === 'ANIM') || !blocks.some(block => block.tag === 'AGRP')) return { ...unavailable('no-embedded-clips'), hasEmbeddedClips: false };
        const anim = embeddedClipEventResource(source, 'ANIM');
        if (!anim) return { ...unavailable('ambiguous-animation-block'), status: 'unsupported' };
        const sequence = embeddedClipEventResource(source, 'ASEQ');
        if (!sequence && blocks.some(block => block.tag === 'ASEQ')) return { ...unavailable('ambiguous-sequence-block'), status: 'unsupported' };
        await fs.mkdir(cacheDir, { recursive: true });
        temporary = join(cacheDir, `${randomUUID()}.animation-event-resource`);
        const path = temporary;
        const decode = async (wrapped: Buffer): Promise<unknown> => {
            await fs.writeFile(path, wrapped);
            const json = await runVpkmergeStdout(['soundevents', path]);
            if (json.length > 8 * 1024 * 1024) throw new Error('Embedded animation KV3 exceeds the event inspection limit.');
            return JSON.parse(json) as unknown;
        };
        const animValue = await decode(anim), sequenceValue = sequence ? await decode(sequence) : undefined;
        return embeddedClipEventsFromKv3(modelEntry, clipName, animValue, sequenceValue, expected);
    } catch {
        // Optional metadata must never invalidate a successfully exported model
        // or leak local source paths from a tool/filesystem exception.
        return { ...unavailable('event-decode-failed'), status: 'unsupported' };
    } finally {
        if (temporary) await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
}
