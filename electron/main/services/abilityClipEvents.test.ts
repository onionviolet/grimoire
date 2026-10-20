import { describe, expect, it, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
vi.mock('./vpk', () => ({ readVpkEntryBytes: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmergeStdout: vi.fn() }));
const { readVpkEntryBytes } = await import('./vpk');
const { runVpkmergeStdout } = await import('./modMerger');
const { embeddedClipEventResource, embeddedClipEventsFromKv3, readEmbeddedClipEvents } = await import('./abilityClipEvents');

// Synthetic contract fixtures, not a captured ability or a verified game cast.
// Export association: morphic/src/model/animation.rs at onionviolet/vpkmerge
// 798f3a7d28f3ef314d8f6ebf51ced0d9fe049445. Event fields: VRF
// ModelAnimation/AnimationEvent.cs at f19322f829a27adfe8e1ca29b8410cf8aab0f3b6.
const modelEntry = 'models/heroes/pilot/pilot.vmdl_c';
const event = { m_sEventName: 'AE_UNRESOLVED_CAST', m_nFrame: 6, m_nEndFrame: 12, m_flCycle: 0.2, m_flDuration: 0.2, m_EventData: { attachment: 'hand_R', resource: 'unresolved' }, m_sOptions: 'authored option' };
function animation(events: unknown = [event]) { return { m_name: 'cast_authored', fps: 30, m_pData: { m_nFrames: 31 }, m_eventArray: events }; }
function sequence(name = 'ability_cast', index = 0) { return { m_localSequenceNameArray: ['cast_authored'], m_localS1SeqDescArray: [{ m_sName: name, m_fetch: { m_localReferenceArray: [index] } }] }; }
function resource(tags = ['DATA', 'ANIM', 'ASEQ', 'AGRP']): Buffer {
    const size = 16 + tags.length * 12 + tags.length * 8;
    const source = Buffer.alloc(size);
    source.writeUInt32LE(size, 0); source.writeUInt16LE(12, 4); source.writeUInt32LE(8, 8); source.writeUInt32LE(tags.length, 12);
    tags.forEach((tag, index) => {
        const at = 16 + index * 12, start = 16 + tags.length * 12 + index * 8;
        source.write(tag, at); source.writeUInt32LE(start - (at + 4), at + 4); source.writeUInt32LE(8, at + 8);
        source.write(`${tag}body`, start);
    });
    return source;
}

describe('exact embedded clip event metadata', () => {
    beforeEach(() => { vi.resetAllMocks(); });

    it('retags a validated private ANIM copy while preserving the input, offsets and all payload bytes', () => {
        const source = resource(), snapshot = Buffer.from(source);
        const copy = embeddedClipEventResource(source, 'ANIM')!;
        expect(source).toEqual(snapshot);
        expect(copy.toString('ascii', 16, 20)).toBe('ODAT');
        expect(copy.toString('ascii', 28, 32)).toBe('DATA');
        expect(copy.subarray(64)).toEqual(source.subarray(64));
        expect(copy.readUInt32LE(32)).toBe(source.readUInt32LE(32));
    });

    it('rejects truncated, out-of-range and duplicate selected blocks', () => {
        expect(embeddedClipEventResource(Buffer.alloc(8), 'ANIM')).toBeNull();
        const invalid = resource(); invalid.writeUInt32LE(0xffffffff, 32);
        expect(embeddedClipEventResource(invalid, 'ANIM')).toBeNull();
        expect(embeddedClipEventResource(resource(['ANIM', 'ANIM']), 'ANIM')).toBeNull();
        expect(embeddedClipEventResource(resource(['DATA']), 'ANIM')).toBeNull();
    });

    it('resolves an exact ASEQ fetch alias and retains uninterpreted event data', () => {
        const result = embeddedClipEventsFromKv3(modelEntry, 'ability_cast', { m_animArray: [animation()] }, sequence(), { fps: 30, frameCount: 31 });
        expect(result).toMatchObject({ status: 'available', hasEmbeddedClips: true, fps: 30, frameCount: 31, durationSeconds: 1,
            provenance: { modelEntry, clipName: 'ability_cast', animationName: 'cast_authored', format: 'ANIM/ASEQ' },
            events: [{ name: 'AE_UNRESOLVED_CAST', frame: 6, endFrame: 12, cycle: 0.2, authoredDuration: 0.2, timeSeconds: 0.2, durationSeconds: 0.2, eventData: event.m_EventData, options: event.m_sOptions }] });
    });

    it('matches direct clip names exactly and never uses neighboring filenames or tokens', () => {
        const anim = { m_animArray: [animation()] };
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', anim).status).toBe('available');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast', anim).reason).toBe('clip-not-found');
        expect(embeddedClipEventsFromKv3(modelEntry, 'Ability_cast', anim, sequence()).reason).toBe('clip-not-found');
        expect(embeddedClipEventsFromKv3(modelEntry, 'ability_cast', anim, sequence('ability_cast', 3)).reason).toBe('clip-not-found');
    });

    it('distinguishes authored empty events, absent metadata and positively zero embedded clips', () => {
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation([])] })).toMatchObject({ status: 'available', events: [], hasEmbeddedClips: true });
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [{ ...animation(), m_eventArray: undefined }] })).toMatchObject({ status: 'unavailable', reason: 'event-array-absent', hasEmbeddedClips: true });
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [] })).toMatchObject({ status: 'unavailable', reason: 'no-embedded-clips', hasEmbeddedClips: false });
        expect(embeddedClipEventsFromKv3(modelEntry, 'different', { m_animArray: [animation()] })).not.toHaveProperty('hasEmbeddedClips', false);
    });

    it('refuses duplicate exported names and timing that differs from the exported clip', () => {
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation(), animation()] }).reason).toBe('ambiguous-exported-clip');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation()] }, undefined, { fps: 24, frameCount: 31 }).reason).toBe('exported-timing-mismatch');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation()] }, undefined, { fps: 30, frameCount: 32 }).reason).toBe('exported-timing-mismatch');
    });

    it('rejects invalid windows and excessive event arrays without returning a partial schedule', () => {
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation([{ ...event, m_nFrame: -1 }])] }).reason).toBe('invalid-event');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation([{ ...event, m_nEndFrame: 32 }])] }).reason).toBe('invalid-event-window');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation([{ ...event, m_flCycle: NaN }])] }).reason).toBe('invalid-event-timing');
        expect(embeddedClipEventsFromKv3(modelEntry, 'cast_authored', { m_animArray: [animation(Array.from({ length: 513 }, () => event))] }).reason).toBe('event-limit');
    });

    it('reports zero clips only for a validated block absence and avoids running the decoder', async () => {
        vi.mocked(readVpkEntryBytes).mockReturnValue(resource(['DATA', 'MDAT']));
        expect(await readEmbeddedClipEvents('/private/donor.vpk', modelEntry, 'ability_cast', '/unused')).toMatchObject({ status: 'unavailable', reason: 'no-embedded-clips', hasEmbeddedClips: false });
        expect(runVpkmergeStdout).not.toHaveBeenCalled();
        vi.mocked(readVpkEntryBytes).mockReturnValue(Buffer.alloc(32));
        expect(await readEmbeddedClipEvents('/private/donor.vpk', modelEntry, 'ability_cast', '/unused')).toMatchObject({ status: 'unsupported', reason: 'invalid-model-resource' });
    });

    it('decodes only private loose resources, removes its temporary file, and omits donor paths from provenance', async () => {
        const cache = await fs.mkdtemp(join(tmpdir(), 'grimoire-ability-events-test-'));
        vi.mocked(readVpkEntryBytes).mockReturnValue(resource());
        vi.mocked(runVpkmergeStdout).mockResolvedValueOnce(JSON.stringify({ m_animArray: [animation()] })).mockResolvedValueOnce(JSON.stringify(sequence()));
        try {
            const result = await readEmbeddedClipEvents('/private/donor.vpk', modelEntry, 'ability_cast', cache, { fps: 30, frameCount: 31 });
            expect(result.status).toBe('available');
            expect(runVpkmergeStdout).toHaveBeenCalledTimes(2);
            expect(vi.mocked(runVpkmergeStdout).mock.calls.every(([args]) => args.length === 2 && args[0] === 'soundevents' && args[1].startsWith(cache))).toBe(true);
            expect(await fs.readdir(cache)).toEqual([]);
            expect(JSON.stringify(result)).not.toContain('/private/donor.vpk');
            expect(JSON.stringify(result)).not.toContain(cache);
        } finally { await fs.rm(cache, { recursive: true, force: true }); }
    });

    it('keeps metadata read failures nonfatal and removes temporary files on decoder failure', async () => {
        const cache = await fs.mkdtemp(join(tmpdir(), 'grimoire-ability-events-test-'));
        try {
            vi.mocked(readVpkEntryBytes).mockImplementationOnce(() => { throw new Error('/private/donor.vpk read failed'); });
            expect(await readEmbeddedClipEvents('/private/donor.vpk', modelEntry, 'ability_cast', cache)).toMatchObject({ status: 'unsupported', reason: 'event-decode-failed' });
            vi.mocked(readVpkEntryBytes).mockReturnValue(resource());
            vi.mocked(runVpkmergeStdout).mockRejectedValueOnce(new Error('/private/temporary decoder failed'));
            const result = await readEmbeddedClipEvents('/private/donor.vpk', modelEntry, 'ability_cast', cache);
            expect(result).toMatchObject({ status: 'unsupported', reason: 'event-decode-failed', events: [] });
            expect(result).not.toHaveProperty('hasEmbeddedClips', false);
            expect(JSON.stringify(result)).not.toContain('/private/');
            expect(await fs.readdir(cache)).toEqual([]);
        } finally { await fs.rm(cache, { recursive: true, force: true }); }
    });
});
