import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { runVpkmerge, runVpkmergeStdout } from './modMerger';
import { parseVpkEntryIndex } from './vpk';
import { fxTexturePngName, type FxDescriptor, type FxNode, type FxControlPoint } from '../../../src/components/locker/fxDescriptor';
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function normalize(value: unknown): unknown {
    const input = record(value), type = text(input.m_nType);
    if (type?.startsWith('PF_TYPE_')) {
        if (type === 'PF_TYPE_LITERAL') return input.m_flLiteralValue;
        return { pf: type, literal: input.m_flLiteralValue, min: input.m_flRandomMin, max: input.m_flRandomMax, cp: input.m_nControlPoint };
    }
    if (type === 'PVEC_TYPE_LITERAL') return input.m_vLiteralValue;
    return value;
}
function nodes(value: unknown): FxNode[] {
    if (array(value).length > 256) throw new Error('Particle node list exceeds the preview limit.');
    return array(value).map(value => {
        const node = record(value);
        if (typeof node._class !== 'string') throw new Error('Particle node has no authored class.');
        return { class: node._class, params: Object.fromEntries(Object.entries(node).filter(([key]) => key !== '_class').map(([key, value]) => [key, normalize(value)])) };
    });
}
export function assetReferences(value: unknown, extension: string): string[] {
    const results = new Set<string>();
    const walk = (value: unknown, depth: number) => {
        if (depth > 20) return;
        if (typeof value === 'string' && (value.endsWith(extension) || value.endsWith(`${extension}_c`))) results.add(value.endsWith('_c') ? value : `${value}_c`);
        else if (Array.isArray(value)) value.forEach(value => walk(value, depth + 1));
        else if (value && typeof value === 'object') Object.values(value).forEach(value => walk(value, depth + 1));
    };
    walk(value, 0);
    return [...results];
}
/** Exact authored KV3 projection. The soundevents CLI shares the engine's
 * generic DATA decoder and accepts any resource; no edits/encode flags are used. */
export function descriptorFromKv3(path: string, value: unknown): FxDescriptor {
    const root = record(value);
    if (root._class !== 'CParticleSystemDefinition' && !Array.isArray(root.m_Renderers)) throw new Error('Decoded resource is not a particle system.');
    const configurations = array(root.m_controlPointConfigurations).map(record);
    const drivers: FxControlPoint[] = configurations.flatMap(config => array(config.m_drivers).map(value => {
        const driver = record(value);
        return { cp: typeof driver.m_iControlPoint === 'number' ? driver.m_iControlPoint : null,
            attachType: text(driver.m_iAttachType), attachment: text(driver.m_attachmentName), entity: text(driver.m_entityName) };
    }));
    const preview = record(configurations[0]?.m_previewState);
    return { name: path, class: text(root._class) ?? undefined,
        maxParticles: typeof root.m_nMaxParticles === 'number' ? root.m_nMaxParticles : undefined,
        constantRadius: normalize(root.m_flConstantRadius) as FxDescriptor['constantRadius'],
        constantColor: normalize(root.m_ConstantColor) as FxDescriptor['constantColor'],
        controlPoints: drivers, preview: { model: text(preview.m_previewModel), sequence: text(preview.m_previewSequence) },
        emitters: nodes(root.m_Emitters), initializers: nodes(root.m_Initializers), operators: nodes(root.m_Operators),
        renderers: nodes(root.m_Renderers).map(node => ({ ...node,
            mode: node.class === 'C_OP_RenderSprites' ? 'sprite' : 'unsupported',
            blendMode: text(node.params.m_nBlendMode), textures: assetReferences(node.params, '.vtex') })), children: [] };
}
const MAX_SYSTEMS = 32;
/** Bounded authored child walk + raw texture decoding, all within cache output. */
export async function exportNativeParticleBundle(pak: string, entry: string, out: string, textureDir: string): Promise<FxDescriptor> {
    const catalog = parseVpkEntryIndex(pak);
    if (!catalog) throw new Error('Could not read the particle source catalog.');
    const paths = new Set(catalog.map(entry => entry.path));
    const visited = new Set<string>(), texturePaths = new Set<string>();
    let systems = 0;
    const decode = async (path: string, depth: number): Promise<FxDescriptor> => {
        if (!paths.has(path) || !path.endsWith('.vpcf_c') || path.split('/').some(part => !part || part === '..' || part === '.') || path.includes('\\')) throw new Error(`Missing or unsafe authored particle reference: ${path}`);
        if (depth > 6 || ++systems > MAX_SYSTEMS || visited.has(path)) throw new Error('Particle child graph exceeds the preview limit or contains a cycle.');
        visited.add(path);
        const json = await runVpkmergeStdout(['soundevents', path, '--from-vpk', pak]);
        if (json.length > 4 * 1024 * 1024) throw new Error('Particle KV3 exceeds the inspection limit.');
        const raw = JSON.parse(json), descriptor = descriptorFromKv3(path, raw);
        for (const renderer of descriptor.renderers) {
            for (const texture of renderer.textures) texturePaths.add(texture);
            for (const material of assetReferences(renderer.params, '.vmat')) {
                if (!paths.has(material)) throw new Error(`Particle material is absent: ${material}`);
                const data = JSON.parse(await runVpkmergeStdout(['soundevents', material, '--from-vpk', pak]));
                const textures = assetReferences(data, '.vtex');
                renderer.textures.push(...textures); textures.forEach(texture => texturePaths.add(texture));
            }
        }
        for (const child of array(record(raw).m_Children)) {
            const reference = text(record(child).m_ChildRef);
            if (!reference) throw new Error('Particle child has no authored resource reference.');
            const path = reference.endsWith('_c') ? reference : `${reference}_c`;
            // Repeated DAG branches reuse the same authored system; cycles are
            // refused rather than rendering a misleading incomplete effect.
            descriptor.children.push(await decode(path, depth + 1));
        }
        visited.delete(path);
        return descriptor;
    };
    const descriptor = await decode(entry, 0);
    if (texturePaths.size > 64) throw new Error('Particle texture graph exceeds the preview limit.');
    await fs.mkdir(textureDir, { recursive: true });
    for (const path of texturePaths) {
        if (!paths.has(path)) throw new Error(`Particle texture is absent: ${path}`);
        await runVpkmerge(['catalog', 'texture', '--vpk', pak, '--path', path, '--thumbs', textureDir, '--thumb-size', '256']);
        const manifest = JSON.parse(await fs.readFile(join(textureDir, 'manifest.json'), 'utf8')) as Array<{ entry: string; file: string }>;
        const item = manifest.find(item => item.entry === path);
        if (!item || item.file !== basename(item.file) || !item.file.endsWith('.png')) throw new Error(`Particle texture could not be decoded: ${path}`);
        const target = join(textureDir, fxTexturePngName(path));
        if (join(textureDir, item.file) !== target) await fs.copyFile(join(textureDir, item.file), target);
    }
    const serialized = JSON.stringify(descriptor);
    if (serialized.length > 4 * 1024 * 1024) throw new Error('Particle descriptor graph exceeds the preview limit.');
    await fs.writeFile(out, serialized);
    return descriptor;
}
