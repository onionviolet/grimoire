import { TextDecoder } from 'node:util';
import { parseVpkEntryIndex, readVpkEntryBytes } from './vpk';
import { vpkCrc32, writeNativeVpk } from './nativeVpk';
import type { LocalizationTokenChange } from '../../../src/types/localizationMerge';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOKENS = 100_000;
interface Atom { value: string; start: number; end: number }
interface Token extends Atom { key: string }
interface Document {
    text: string;
    encoding: 'utf8' | 'utf16le' | 'utf16be';
    bom: boolean;
    language: string;
    tokens: Map<string, Token>;
    close: number;
}
export interface LocalizationSource { id: string; bytes: Buffer }
export type LocalizationChange = LocalizationTokenChange;
export interface LocalizationPlan { language: string; changes: LocalizationChange[] }

/** Strict KV1 subset: fail closed on directives, conditions, duplicate keys and
 * nested token objects rather than silently changing their meaning. */
function parse(bytes: Buffer): Document {
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Localization file must fit within 8 MiB');
    const prefix = bytes.subarray(0, 2).toString('hex');
    const encoding = prefix === 'fffe' ? 'utf16le' : prefix === 'feff' ? 'utf16be' : 'utf8';
    const bom = encoding !== 'utf8' || bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = new TextDecoder(encoding === 'utf8' ? 'utf-8' : encoding === 'utf16le' ? 'utf-16le' : 'utf-16be', { fatal: true }).decode(bytes);
    for (const char of text) {
        const code = char.charCodeAt(0);
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) throw new Error('Unsupported localization control character');
    }
    let position = 0;
    const skip = () => {
        while (position < text.length) {
            if (/\s/.test(text[position])) { position++; continue; }
            if (text.startsWith('//', position)) {
                const end = text.indexOf('\n', position);
                position = end < 0 ? text.length : end + 1;
                continue;
            }
            if (text.startsWith('/*', position)) {
                const end = text.indexOf('*/', position + 2);
                if (end < 0) throw new Error('Unclosed localization comment');
                position = end + 2;
                continue;
            }
            break;
        }
    };
    const brace = (expected: string) => {
        skip();
        if (text[position++] !== expected) throw new Error('Unsupported localization structure');
    };
    const atom = (): Atom => {
        skip();
        const start = position;
        if (text[position++] !== '"') throw new Error('Localization keys and values must be quoted');
        let value = '';
        while (position < text.length) {
            const char = text[position++];
            if (char === '"') return { value, start, end: position };
            if (char === '\\') {
                const escaped = text[position++];
                const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
                if (escaped === undefined || !Object.hasOwn(escapes, escaped)) throw new Error('Unsupported localization escape');
                value += escapes[escaped];
            } else value += char;
        }
        throw new Error('Unclosed localization string');
    };
    if (atom().value.toLowerCase() !== 'lang') throw new Error('Expected a localization lang block');
    brace('{');
    const fields = new Set<string>();
    const tokens = new Map<string, Token>();
    let language = '';
    let close = -1;
    while (true) {
        skip();
        if (text[position] === '}') { position++; break; }
        const field = atom().value.toLowerCase();
        if (fields.has(field)) throw new Error('Duplicate localization field');
        fields.add(field);
        if (field !== 'tokens') {
            const value = atom().value;
            if (field === 'language') language = value;
            continue;
        }
        brace('{');
        while (true) {
            skip();
            if (text[position] === '}') { close = position++; break; }
            const key = atom().value;
            if (!key || tokens.has(key.toLowerCase())) throw new Error('Empty or duplicate localization token');
            const value = atom();
            tokens.set(key.toLowerCase(), { ...value, key });
            if (tokens.size > MAX_TOKENS) throw new Error('Too many localization tokens');
        }
    }
    skip();
    if (position !== text.length || close < 0 || !language) throw new Error('Incomplete or unsupported localization document');
    return { text, encoding, bom, language, tokens, close };
}

function prepare(baseline: Buffer, sources: LocalizationSource[]) {
    if (!sources.length || sources.length > 100 || new Set(sources.map(source => source.id)).size !== sources.length || sources.some(source => !source.id)) throw new Error('Expected unique localization sources');
    if (sources.reduce((sum, source) => sum + source.bytes.length, baseline.length) > 64 * 1024 * 1024) throw new Error('Localization merge inputs exceed 64 MiB');
    const base = parse(baseline);
    const changes = new Map<string, LocalizationChange>();
    for (const source of sources) {
        const document = parse(source.bytes);
        if (document.language.toLowerCase() !== base.language.toLowerCase()) throw new Error('Localization languages differ');
        for (const [identity, token] of document.tokens) {
            const stock = base.tokens.get(identity);
            if (stock?.value === token.value) continue;
            const change = changes.get(identity) ?? { key: stock?.key ?? token.key, baseline: stock?.value ?? null, candidates: [], conflict: false };
            const candidate = change.candidates.find(candidate => candidate.value === token.value);
            if (candidate) candidate.sourceIds.push(source.id);
            else change.candidates.push({ value: token.value, sourceIds: [source.id] });
            change.conflict = change.candidates.length > 1;
            changes.set(identity, change);
        }
    }
    return { base, changes: [...changes.values()] };
}

/** Every difference is an edit candidate. Without a historical baseline there
 * is no reliable way to distinguish an old stock value from an author's edit. */
export function planLocalizationMerge(baseline: Buffer, sources: LocalizationSource[]): LocalizationPlan {
    const { base, changes } = prepare(baseline, sources);
    return { language: base.language, changes };
}

const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;

/** Choices map exact reviewed token keys to a source ID, or null to retain
 * current stock text. Every differing token requires a choice, including a
 * single-source edit, since it may contain outdated stock text. */
export function mergeLocalization(baseline: Buffer, sources: LocalizationSource[], choices: ReadonlyMap<string, string | null>): Buffer {
    const { base, changes } = prepare(baseline, sources);
    if (choices.size !== changes.length || changes.some(change => !choices.has(change.key))) throw new Error('Review every localization change before merging');
    const patches: Array<{ start: number; end: number; text: string }> = [];
    const additions: string[] = [];
    const newline = base.text.includes('\r\n') ? '\r\n' : '\n';
    for (const change of changes) {
        const choice = choices.get(change.key);
        if (choice === null) continue;
        const candidate = change.candidates.find(candidate => choice !== undefined && candidate.sourceIds.includes(choice));
        if (!candidate) throw new Error('Localization choice is not a source for this token');
        const token = base.tokens.get(change.key.toLowerCase());
        if (token) patches.push({ start: token.start, end: token.end, text: quote(candidate.value) });
        else additions.push(`\t\t${quote(change.key)}\t${quote(candidate.value)}${newline}`);
    }
    if (additions.length) patches.push({ start: base.close, end: base.close, text: `${newline}${additions.join('')}` });
    let text = base.text;
    for (const patch of patches.sort((a, b) => b.start - a.start)) text = text.slice(0, patch.start) + patch.text + text.slice(patch.end);
    const bytes = Buffer.from(text, base.encoding === 'utf8' ? 'utf8' : 'utf16le');
    if (base.encoding === 'utf16be') bytes.swap16();
    const prefix = base.bom ? Buffer.from(base.encoding === 'utf8' ? [0xef, 0xbb, 0xbf] : base.encoding === 'utf16le' ? [0xff, 0xfe] : [0xfe, 0xff]) : Buffer.alloc(0);
    const output = Buffer.concat([prefix, bytes]);
    parse(output);
    return output;
}

function localizationPath(path: string): string {
    const normalized = path.replace(/\\/g, '/').toLowerCase();
    if (!/^resource\/localization\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.txt$/.test(normalized)) throw new Error('Expected a resource/localization text entry');
    return normalized;
}

export function readLocalizationVpkEntry(vpkPath: string, path: string): Buffer {
    const normalized = localizationPath(path);
    const entries = parseVpkEntryIndex(vpkPath)?.filter(entry => entry.path.toLowerCase() === normalized);
    if (entries?.length !== 1 || entries[0].size > MAX_BYTES) throw new Error('Localization entry is missing, ambiguous or too large');
    const bytes = readVpkEntryBytes(vpkPath, normalized);
    if (!bytes || bytes.length !== entries[0].size || vpkCrc32(bytes) !== entries[0].crc) throw new Error('Localization entry CRC check failed');
    parse(bytes);
    return bytes;
}

/** Builds an inert artifact only. Installing it must use the normal reviewed
 * mod-install path and mutation lock; source mods remain untouched. */
export function buildLocalizationOverride(entries: ReadonlyMap<string, Buffer>): Buffer {
    if (!entries.size || entries.size > 100 || [...entries.values()].reduce((sum, bytes) => sum + bytes.length, 0) > 64 * 1024 * 1024) throw new Error('Localization override exceeds its limits');
    const normalized = new Map<string, Buffer>();
    for (const [path, bytes] of entries) {
        const key = localizationPath(path);
        if (normalized.has(key)) throw new Error('Duplicate localization output path');
        parse(bytes);
        normalized.set(key, bytes);
    }
    return writeNativeVpk(normalized);
}
