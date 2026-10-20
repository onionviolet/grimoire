import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
const h = vi.hoisted(() => ({ run: vi.fn(), stdout: vi.fn(), index: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmerge: h.run, runVpkmergeStdout: h.stdout }));
vi.mock('./vpk', () => ({ parseVpkEntryIndex: h.index }));
const { descriptorFromKv3, exportNativeParticleBundle } = await import('./particleBundle');
const { allSpriteLayers, unsupportedParticleClasses } = await import('../../../src/components/locker/fxDescriptor');
const parent = 'particles/abilities/wraith/hand.vpcf_c', child = 'particles/abilities/wraith/spark.vpcf_c', texture = 'materials/particles/glow.vtex_c';
const raw = (children: unknown[] = []) => ({ _class: 'CParticleSystemDefinition', m_nMaxParticles: 16, m_flConstantRadius: 8,
    m_ConstantColor: [255, 64, 32, 255], m_controlPointConfigurations: [{ m_drivers: [{ m_iControlPoint: 2, m_iAttachType: 'PATTACH_POINT_FOLLOW', m_attachmentName: 'ability_cast' }] }],
    m_Emitters: [{ _class: 'C_OP_ContinuousEmitter', m_flEmitRate: { m_nType: 'PF_TYPE_LITERAL', m_flLiteralValue: 2 } }],
    m_Initializers: [{ _class: 'C_INIT_RandomColor', m_ColorMin: [255, 0, 0], m_ColorMax: [0, 255, 0] }],
    m_Operators: [{ _class: 'C_OP_PositionLock', m_nControlPointNumber: 2 }, { _class: 'C_OP_ColorInterpolate', m_ColorFade: [0, 0, 255] }],
    m_Renderers: [{ _class: 'C_OP_RenderSprites', m_nBlendMode: 'PARTICLE_BLEND_ADD', m_hTexture: texture.replace('_c', '') }], m_Children: children });
let dir: string;
beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'particle-bundle-test-'));
    h.index.mockReturnValue([{ path: parent }, { path: child }, { path: texture }]);
    h.stdout.mockImplementation(async (args: string[]) => JSON.stringify(args[1] === parent ? raw([{ m_ChildRef: child }]) : { ...raw(), m_controlPointConfigurations: [] }));
    h.run.mockImplementation(async (args: string[]) => {
        await fs.writeFile(join(args[args.indexOf('--thumbs') + 1], 'glow.png'), 'inert png fixture');
        await fs.writeFile(join(args[args.indexOf('--thumbs') + 1], 'manifest.json'), JSON.stringify([{ entry: texture, file: 'glow.png' }]));
    });
});
afterEach(async () => { vi.clearAllMocks(); await fs.rm(dir, { recursive: true, force: true }); });
describe('native KV3 particle adapter', () => {
    it('preserves authored color/operators/CP and collapses numeric literals', () => {
        const descriptor = descriptorFromKv3(parent, raw());
        expect(allSpriteLayers(descriptor)[0]).toMatchObject({ emitRate: 2, colorMin: [1, 0, 0], colorMax: [0, 1, 0], attachment: 'ability_cast' });
        // The adapter still carries the authored driver list; layers no longer
        // expose a controlPoint field (upstream fxDescriptor derives attachment only).
        expect(descriptor.controlPoints).toEqual([{ cp: 2, attachType: 'PATTACH_POINT_FOLLOW', attachment: 'ability_cast', entity: null }]);
        expect(descriptor.operators.find(node => node.class === 'C_OP_PositionLock')?.params).toMatchObject({ m_nControlPointNumber: 2 });
        expect(unsupportedParticleClasses(descriptor)).toEqual([]);
    });
    it('walks exact child paths and decodes unchanged textures with read-only flags', async () => {
        const descriptor = await exportNativeParticleBundle('pak', parent, join(dir, 'effect.json'), dir);
        expect(descriptor.children).toHaveLength(1);
        // The child declares no drivers of its own; upstream's allSpriteLayers does not
        // inherit the parent's control points, so only the root layer carries the attachment.
        expect(descriptor.children[0].controlPoints).toEqual([]);
        expect(allSpriteLayers(descriptor).map(layer => layer.attachment)).toEqual(['ability_cast', null]);
        expect(h.stdout.mock.calls.map(call => call[0])).toEqual([['soundevents', parent, '--from-vpk', 'pak'], ['soundevents', child, '--from-vpk', 'pak']]);
        expect(h.run).toHaveBeenCalledWith(['catalog', 'texture', '--vpk', 'pak', '--path', texture, '--thumbs', dir, '--thumb-size', '256']);
        expect(await fs.readFile(join(dir, 'materials_particles_glow_vtex_c.png'), 'utf8')).toBe('inert png fixture');
    });
    it('refuses cycles and absent references instead of presenting partial decoded FX', async () => {
        h.stdout.mockResolvedValue(JSON.stringify(raw([{ m_ChildRef: parent }])));
        await expect(exportNativeParticleBundle('pak', parent, join(dir, 'effect.json'), dir)).rejects.toThrow('cycle');
        h.stdout.mockResolvedValue(JSON.stringify(raw([{ m_ChildRef: 'particles/missing.vpcf' }])));
        await expect(exportNativeParticleBundle('pak', parent, join(dir, 'effect.json'), dir)).rejects.toThrow('Missing');
        expect(h.run).not.toHaveBeenCalled();
    });
    it('keeps unsupported authored classes visible and rejects non-particle roots', () => {
        const root = { ...raw(), m_Operators: [{ _class: 'C_OP_Unsupported', m_nControlPointNumber: 1 }] };
        expect(unsupportedParticleClasses(descriptorFromKv3(parent, root))).toEqual(['C_OP_Unsupported']);
        expect(() => descriptorFromKv3(parent, { event: { volume: 1 } })).toThrow('not a particle');
    });
});
