import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLocalizationOverride, mergeLocalization, planLocalizationMerge, readLocalizationVpkEntry } from './localizationMerge';
import { parseVpkEntryIndex } from './vpk';

const document = (tokens: string, language = 'English') => Buffer.from(`"lang"\r\n{\r\n "Language" "${language}"\r\n "Tokens"\r\n {\r\n${tokens}\r\n }\r\n}\r\n`);
const base = document(' // Keep this stock comment\r\n "Hero" "Current stock"\r\n "NewValveToken" "Keep me"');
const sources = [
    { id: 'a', bytes: document('"hero" "Custom A"\r\n "Added" "New value"') },
    { id: 'b', bytes: document('"Hero" "Custom B"\r\n "Shared" "Both"') },
    { id: 'c', bytes: document('"Shared" "Both"') },
];
const paths: string[] = [];
afterEach(() => { for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe('localization merge', () => {
    it('plans per-token alternatives without treating shared edits as stale', () => {
        const plan = planLocalizationMerge(base, sources);
        expect(plan.language).toBe('English');
        expect(plan.changes).toEqual([
            { key: 'Hero', baseline: 'Current stock', conflict: true, candidates: [{ value: 'Custom A', sourceIds: ['a'] }, { value: 'Custom B', sourceIds: ['b'] }] },
            { key: 'Added', baseline: null, conflict: false, candidates: [{ value: 'New value', sourceIds: ['a'] }] },
            { key: 'Shared', baseline: null, conflict: false, candidates: [{ value: 'Both', sourceIds: ['b', 'c'] }] },
        ]);
    });

    it('retains current stock tokens and comments while applying exact reviewed choices', () => {
        const output = mergeLocalization(base, sources, new Map([['Hero', 'b'], ['Added', 'a'], ['Shared', null]]));
        const text = output.toString('utf8');
        expect(text).toContain('// Keep this stock comment');
        expect(text).toContain('"NewValveToken" "Keep me"');
        expect(text).toContain('"Hero" "Custom B"');
        expect(text).toContain('"Added"\t"New value"');
        expect(text).not.toContain('"Shared"');
        expect(planLocalizationMerge(output, [{ id: 'result', bytes: output }]).changes).toEqual([]);
    });

    it('requires review of unique edits too and rejects unknown choices', () => {
        expect(() => mergeLocalization(base, sources, new Map())).toThrow('Review every');
        expect(() => mergeLocalization(base, sources, new Map([['Hero', 'missing'], ['Added', null], ['Shared', null]]))).toThrow('not a source');
        expect(() => mergeLocalization(base, sources, new Map([['Hero', null], ['Added', null], ['Shared', null], ['Other', null]]))).toThrow('Review every');
        expect(mergeLocalization(base, sources, new Map([['Hero', null], ['Added', null], ['Shared', null]]))).toEqual(base);
    });

    it.each(['utf8', 'utf16le', 'utf16be'] as const)('preserves %s BOM, Unicode and escapes', (encoding) => {
        let encoded = Buffer.from(base.toString('utf8'), encoding === 'utf8' ? 'utf8' : 'utf16le');
        if (encoding === 'utf16be') encoded = encoded.swap16();
        const bom = Buffer.from(encoding === 'utf8' ? [0xef, 0xbb, 0xbf] : encoding === 'utf16le' ? [0xff, 0xfe] : [0xfe, 0xff]);
        const input = Buffer.concat([bom, encoded]);
        const mods = [{ id: 'a', bytes: document('"Hero" "Hello \\"friend\\"\\n世界\\tC:\\\\mods"') }];
        const output = mergeLocalization(input, mods, new Map([['Hero', 'a']]));
        expect(output.subarray(0, bom.length)).toEqual(bom);
        expect(planLocalizationMerge(output, mods).changes).toEqual([]);
    });

    it.each([
        '"lang" { "Language" "English" "Tokens" { "A" "one" "a" "two" } }',
        '"lang" { "Language" "English" "Tokens" { "A" { "B" "nested" } } }',
        '"lang" { "Language" "English" "Tokens" { "A" "one" [$WIN32] } }',
        '#base "other.txt" "lang" { "Language" "English" "Tokens" {} }',
        '"lang" { "Language" "English" "Tokens" { "A" "one" }',
        '"lang" { "Language" "English" "Tokens" {} } "second" {}',
        '"lang" { "Language" "English" "Tokens" {} "Tokens" {} }',
        '"lang" { "Language" "English" "Tokens" { "A" "\\q" } }',
    ])('rejects unsupported or ambiguous KV1: %s', (text) => {
        expect(() => planLocalizationMerge(Buffer.from(text), [{ id: 'a', bytes: base }])).toThrow();
    });

    it('rejects malformed encoding, oversized files, mixed languages and duplicate source IDs', () => {
        expect(() => planLocalizationMerge(Buffer.from([0xff]), sources)).toThrow();
        expect(() => planLocalizationMerge(Buffer.alloc(8 * 1024 * 1024 + 1), sources)).toThrow('8 MiB');
        expect(() => planLocalizationMerge(base, [{ id: 'a', bytes: document('', 'French') }])).toThrow('languages differ');
        expect(() => planLocalizationMerge(base, [sources[0], sources[0]])).toThrow('unique');
    });

    it('accepts block comments without swallowing comment markers inside strings', () => {
        const bytes = document('/* outside */ "URL" "https://example.test/*path*/"');
        expect(planLocalizationMerge(bytes, [{ id: 'same', bytes }]).changes).toEqual([]);
    });
});

describe('localization VPK artifacts', () => {
    it('round-trips a native override and verifies the entry CRC', () => {
        const dir = mkdtempSync(join(tmpdir(), 'grimoire-loc-test-'));
        paths.push(dir);
        const vpk = join(dir, 'pak01_dir.vpk');
        const data = buildLocalizationOverride(new Map([['Resource/Localization/citadel_english.txt', base]]));
        writeFileSync(vpk, data);
        expect(parseVpkEntryIndex(vpk)?.map(entry => entry.path)).toEqual(['resource/localization/citadel_english.txt']);
        expect(readLocalizationVpkEntry(vpk, 'resource/localization/citadel_english.txt')).toEqual(base);
        const damaged = Buffer.from(data);
        damaged[damaged.length - 1] ^= 1;
        writeFileSync(vpk, damaged);
        expect(() => readLocalizationVpkEntry(vpk, 'resource/localization/citadel_english.txt')).toThrow('CRC');
    });

    it('rejects traversal, unrelated assets, duplicate paths and missing entries', () => {
        for (const path of ['resource/localization/../other.txt', 'cfg/autoexec.cfg', '/resource/localization/a.txt']) {
            expect(() => buildLocalizationOverride(new Map([[path, base]]))).toThrow('resource/localization');
        }
        expect(() => buildLocalizationOverride(new Map([['resource/localization/A.txt', base], ['resource/localization/a.txt', base]]))).toThrow('Duplicate');
        expect(() => readLocalizationVpkEntry('missing.vpk', 'resource/localization/a.txt')).toThrow('missing');
        expect(() => buildLocalizationOverride(new Map())).toThrow('limits');
    });
});
