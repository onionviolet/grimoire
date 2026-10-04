import { promises as fs } from 'fs';
import { join } from 'path';
import { parseDocument } from 'yaml';
import { vpkCrc32 as chatLaneCrc32, writeNativeVpk as writeChatLaneVpk } from './nativeVpk';
export { vpkCrc32 as chatLaneCrc32, writeNativeVpk as writeChatLaneVpk } from './nativeVpk';

// Port of RedMser/ChatLane's MIT converter, pinned in resources/chatlane/PROVENANCE.md.
// Preserve KV types and insertion order: changing Int64 to Int32 changes game resources.
export type ChatLaneNode = {
    type: 'String' | 'Boolean' | 'Int32' | 'Int64' | 'FloatingPoint64' | 'Collection' | 'Array';
    key?: string | null;
    value: string | boolean | number | ChatLaneProperty[];
};
export type ChatLaneProperty = { key: string; node: ChatLaneNode };
const MAX_YAML_BYTES = 1024 * 1024;
const MAX_VPK_BYTES = 32 * 1024 * 1024;


function properties(node: ChatLaneNode): ChatLaneProperty[] { return node.value as ChatLaneProperty[]; }
function scalar(type: ChatLaneNode['type'], value: string | boolean | number): ChatLaneNode { return { type, value }; }
function collection(value: ChatLaneProperty[], type: 'Collection' | 'Array' = 'Collection'): ChatLaneNode {
    return { type, key: '', value };
}
function put(items: ChatLaneProperty[], key: string, node: ChatLaneNode): void {
    const existing = items.find((item) => item.key === key);
    if (existing) existing.node = node;
    else items.push({ key, node });
}
function map(value: unknown, field: string): Map<string, unknown> {
    if (!(value instanceof Map) || [...value.keys()].some((key) => typeof key !== 'string')) {
        throw new Error(`${field} must be a YAML mapping with string keys.`);
    }
    return value as Map<string, unknown>;
}
function text(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${field} must be a non-empty string without NUL characters.`);
    return value;
}

/** Unknown YAML fields stay in the embedded original; only ChatLane's known fields compile. */
export function applyChatLaneYaml(yaml: string, base: ChatLaneProperty[]): ChatLaneProperty[] {
    if (!yaml.trim()) throw new Error('Chat Wheel YAML cannot be empty.');
    if (Buffer.byteLength(yaml) > MAX_YAML_BYTES) throw new Error('Chat Wheel YAML exceeds the 1 MiB limit.');
    const document = parseDocument(yaml, { uniqueKeys: true });
    if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('\n'));
    const config = map(document.toJS({ mapAsMap: true, maxAliasCount: 100 }), 'Chat Wheel configuration');
    text(config.get('name'), 'name');
    const root = structuredClone(base);
    for (const [field, target] of [['override_bindable', 'm_bBindable'], ['override_ping_wheel_bindable', 'm_bPingWheelBindable']]) {
        const overrides = config.has(field) ? map(config.get(field), field) : new Map<string, unknown>();
        for (const [command, value] of overrides) {
            if (typeof value !== 'boolean') throw new Error(`${field}.${command} must be true or false.`);
            const entry = root.find((item) => item.key === command && item.node.type === 'Collection');
            // Original ChatLane warns and ignores unknown command names.
            if (entry) put(properties(entry.node), target, scalar('Boolean', value));
        }
    }
    const menus = config.get('custom_menus') ?? [];
    if (!Array.isArray(menus)) throw new Error('custom_menus must be a list.');
    if (menus.length > 100) throw new Error('Chat Wheel supports at most 100 custom menus.');
    menus.forEach((value, index) => {
        const prefix = `custom_menus[${index}]`;
        const menu = map(value, prefix);
        const name = text(menu.get('name'), `${prefix}.name`);
        const items = menu.get('items');
        if (!Array.isArray(items) || items.length > 1000) throw new Error(`${prefix}.items must be a list with at most 1000 commands.`);
        const children = items.map((item, slot) => ({ key: String(slot), node: scalar('String', text(item, `${prefix}.items[${slot}]`)) }));
        const data: ChatLaneProperty[] = [
            { key: 'm_strLabelToken', node: scalar('String', name) },
            { key: 'm_strMessageToken', node: scalar('String', name) },
            { key: 'm_ePingMarkerInfo', node: scalar('String', 'k_EPingMarkerInfo_OnlyPlaySound') },
            { key: 'm_ePingConcept', node: scalar('String', 'CITADEL_PING_DEFEND_LANE') },
            { key: 'm_unPingWheelOptionID', node: scalar('Int32', index + 70) },
            { key: 'm_bIsSubnavMessage', node: scalar('Boolean', false) },
            { key: 'm_eSliceType', node: scalar('String', 'CITADEL_PING_WHEEL_SUBNAV_ONE_SLICE') },
            { key: 'm_vecSubnavMessageNames', node: collection(children, 'Array') },
            { key: 'm_bBindable', node: scalar('Boolean', true) },
        ];
        const icon = menu.get('icon');
        if (icon !== undefined && icon !== null && icon !== '') {
            put(data, 'm_strIcon', scalar('String', `file://{images}/hud/ping/ping_icon_${text(icon, `${prefix}.icon`)}.svg`));
        }
        root.push({ key: `Custom ${index + 1}`, node: collection(data) });
    });
    return root;
}

/** ChatLane's uncompressed binary KV3 v3, including its ordered string table. */
export function writeChatLaneKv3(root: ChatLaneProperty[]): Buffer {
    const strings: string[] = [];
    const indexes = new Map<string, number>();
    let objects = 1;
    let arrays = 0;
    const add = (value: string) => {
        if (value && !indexes.has(value)) { indexes.set(value, strings.length); strings.push(value); }
    };
    const load = (items: ChatLaneProperty[]) => {
        for (const { key, node } of items) {
            add(key);
            if (node.type === 'Collection' || node.type === 'Array') {
                if (node.type === 'Collection') objects++;
                else arrays++;
                // ChatLane includes collection keys, including an empty key, in its table.
                const objectKey = node.key ?? '';
                if (!indexes.has(objectKey)) { indexes.set(objectKey, strings.length); strings.push(objectKey); }
                load(properties(node));
            } else if (node.type === 'String') add(node.value as string);
        }
    };
    load(root);
    const ints: Buffer[] = [];
    const doubles: Buffer[] = [];
    const types: number[] = [];
    const int = (value: number) => { const bytes = Buffer.alloc(4); bytes.writeInt32LE(value); ints.push(bytes); };
    const string = (value: string) => int(value === '' ? -1 : indexes.get(value)!);
    const write = (node: ChatLaneNode) => {
        const type = node.type;
        types.push(({ String: 6, Boolean: node.value ? 13 : 14, Int32: 11, Int64: 3, FloatingPoint64: 5, Collection: 9, Array: 8 })[type]);
        if (type === 'String') string(node.value as string);
        else if (type === 'Int32') int(node.value as number);
        else if (type === 'Int64' || type === 'FloatingPoint64') {
            const bytes = Buffer.alloc(8);
            if (type === 'Int64') bytes.writeBigInt64LE(BigInt(node.value as number));
            else bytes.writeDoubleLE(node.value as number);
            doubles.push(bytes);
        } else if (type === 'Collection' || type === 'Array') {
            const items = properties(node);
            int(items.length);
            for (const { key, node: child } of items) { if (type === 'Collection') string(key); write(child); }
        }
    };
    int(strings.length);
    write(collection(root));
    const intBytes = Buffer.concat(ints);
    const stringBytes = Buffer.concat(strings.map((value) => Buffer.from(`${value}\0`, 'utf8')));
    const typeBytes = Buffer.from(types);
    const trailer = Buffer.from([0, 0xdd, 0xee, 0xff]);
    const body = Buffer.concat([intBytes, Buffer.alloc((8 - intBytes.length % 8) % 8), ...doubles, stringBytes, typeBytes, trailer]);
    const header = Buffer.alloc(64);
    header.writeUInt32LE(0x4b563303);
    Buffer.from('7c161274e9069846aff2e63eb59037e7', 'hex').copy(header, 4);
    header.writeUInt32LE(intBytes.length / 4, 32);
    header.writeUInt32LE(doubles.length, 36);
    // Unlike the original C# writer's UTF-16 length, this counts UTF-8 bytes.
    header.writeUInt32LE(stringBytes.length + typeBytes.length, 40);
    header.writeUInt16LE(objects, 44);
    header.writeUInt16LE(arrays, 46);
    header.writeUInt32LE(body.length, 48);
    header.writeUInt32LE(body.length, 52);
    return Buffer.concat([header, body]);
}

export function writeChatLaneResource(root: ChatLaneProperty[], red2Template: Buffer): Buffer {
    const data = writeChatLaneKv3(root);
    const red2 = Buffer.from(red2Template);
    if (red2.length !== 934 || red2.readUInt32LE(0) !== 0x4b563304) throw new Error('Invalid ChatLane RED2 template.');
    // System.IO.Hashing.Crc32.Hash stores the CRC in little endian order in ChatLane's RED2.
    red2.writeUInt32LE(chatLaneCrc32(data), 112);
    const header = Buffer.alloc(52);
    header.writeUInt32LE(header.length + red2.length + data.length);
    header.writeUInt16LE(12, 4);
    header.writeUInt32LE(8, 8);
    header.writeUInt32LE(2, 12);
    header.write('RED2', 16, 'ascii');
    header.writeUInt32LE(32, 20);
    header.writeUInt32LE(red2.length, 24);
    header.write('DATA', 28, 'ascii');
    header.writeUInt32LE(header.length + red2.length - 32, 32);
    header.writeUInt32LE(data.length, 36);
    return Buffer.concat([header, red2, data]);
}

/** Self-contained VPK v1 with standard CRCs and no external archive chunks. */

/** Bounded v1/v2 reader for ChatLane's root YAML, including preload and chunk data. */
export async function readChatLaneConfig(vpkPath: string): Promise<string> {
    const handle = await fs.open(vpkPath, 'r');
    try {
        const size = (await handle.stat()).size;
        const header = Buffer.alloc(28);
        await handle.read(header, 0, 28, 0);
        const version = header.readUInt32LE(4);
        if (size < 12 || header.readUInt32LE(0) !== 0x55aa1234 || ![1, 2].includes(version)) throw new Error('Invalid Chat Wheel VPK header.');
        const headerSize = version === 2 ? 28 : 12;
        const treeSize = header.readUInt32LE(8);
        if (treeSize > MAX_VPK_BYTES || treeSize + headerSize > size) throw new Error('Invalid Chat Wheel VPK directory size.');
        const tree = Buffer.alloc(treeSize);
        if ((await handle.read(tree, 0, treeSize, headerSize)).bytesRead !== treeSize) throw new Error('Truncated Chat Wheel VPK directory.');
        let cursor = 0;
        const nul = () => {
            const end = tree.indexOf(0, cursor);
            if (end < 0) throw new Error('Invalid Chat Wheel VPK directory string.');
            const value = tree.toString('utf8', cursor, end);
            cursor = end + 1;
            return value;
        };
        for (let extension = nul(); extension; extension = nul()) {
            for (let directory = nul(); directory; directory = nul()) {
                for (let name = nul(); name; name = nul()) {
                    if (cursor + 18 > tree.length || tree.readUInt16LE(cursor + 16) !== 0xffff) throw new Error('Invalid Chat Wheel VPK entry.');
                    const crc = tree.readUInt32LE(cursor);
                    const preload = tree.readUInt16LE(cursor + 4);
                    const archive = tree.readUInt16LE(cursor + 6);
                    const offset = tree.readUInt32LE(cursor + 8);
                    const length = tree.readUInt32LE(cursor + 12);
                    cursor += 18;
                    if (cursor + preload > tree.length) throw new Error('Truncated Chat Wheel VPK preload.');
                    const path = `${directory === ' ' ? '' : `${directory}/`}${name}${extension === ' ' ? '' : `.${extension}`}`;
                    const prefix = tree.subarray(cursor, cursor + preload);
                    cursor += preload;
                    if (path.toLowerCase() !== 'chatlane.yml') continue;
                    if (preload + length > MAX_YAML_BYTES) throw new Error('Embedded Chat Wheel YAML exceeds the 1 MiB limit.');
                    const data = Buffer.alloc(length);
                    if (length) {
                        const chunkPath = vpkPath.replace(/_dir\.vpk$/i, `_${String(archive).padStart(3, '0')}.vpk`);
                        if (archive !== 0x7fff && chunkPath === vpkPath) throw new Error('Chat Wheel VPK chunk requires a _dir.vpk filename.');
                        const source = archive === 0x7fff ? handle : await fs.open(chunkPath, 'r');
                        try {
                            const start = offset + (archive === 0x7fff ? headerSize + treeSize : 0);
                            if (start + length > (await source.stat()).size || (await source.read(data, 0, length, start)).bytesRead !== length) throw new Error('Truncated Chat Wheel YAML payload.');
                        } finally { if (source !== handle) await source.close(); }
                    }
                    const bytes = Buffer.concat([prefix, data]);
                    if (chatLaneCrc32(bytes) !== crc) throw new Error('Embedded Chat Wheel YAML failed its CRC check.');
                    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
                }
            }
        }
        throw new Error('The specified VPK was not created with ChatLane: chatlane.yml is missing.');
    } finally { await handle.close(); }
}

export async function compileChatLaneVpk(yaml: string, resourceDirectory: string): Promise<Buffer> {
    const [baseJson, red2] = await Promise.all([
        fs.readFile(join(resourceDirectory, 'base-commands.json'), 'utf8'),
        fs.readFile(join(resourceDirectory, 'red2.bin')),
    ]);
    const root = applyChatLaneYaml(yaml, JSON.parse(baseJson) as ChatLaneProperty[]);
    return writeChatLaneVpk(new Map([
        ['scripts/ping_wheel_messages.vdata_c', writeChatLaneResource(root, red2)],
        ['chatlane.yml', Buffer.from(yaml, 'utf8')],
        ['README', Buffer.from('Generated by Grimoire using its native MIT ChatLane converter.\nSee https://github.com/RedMser/ChatLane for the game format and limitations.\n')],
    ]));
}
