import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeNativeVpk } from './nativeVpk';
import { readLocalizationVpkEntry } from './localizationMerge';

const mocks = vi.hoisted(() => ({ scan: vi.fn(), citadel: vi.fn() }));
vi.mock('./mods', () => ({ scanModsReadOnly: mocks.scan }));
vi.mock('./deadlock', () => ({ getCitadelPath: mocks.citadel }));
const { buildLocalizationMods, reviewLocalizationMods } = await import('./localizationMods');
const path = 'resource/localization/citadel_english.txt';
const doc = (value: string) => Buffer.from(`"lang" { "Language" "English" "Tokens" { "Hero" "${value}" "StockOnly" "preserved" } }`);
let directory: string;
let modA: string;
let modB: string;
const vpk = (value: string) => writeNativeVpk(new Map([[path, doc(value)]]));

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'grimoire-loc-mods-test-'));
    modA = join(directory, 'a_dir.vpk');
    modB = join(directory, 'b_dir.vpk');
    writeFileSync(modA, vpk('A'));
    writeFileSync(modB, vpk('B'));
    writeFileSync(join(directory, 'pak01_dir.vpk'), vpk('Current'));
    mocks.citadel.mockReturnValue(directory);
    mocks.scan.mockResolvedValue([{ id: 'a', path: modA }, { id: 'b', path: modB }]);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('standalone localization export', () => {
    it('reviews installed IDs and exports the selected token without touching sources', async () => {
        const review = await reviewLocalizationMods('game', ['a', 'b']);
        expect(review.files).toHaveLength(1);
        expect(review.files[0].changes[0].candidates).toEqual([{ value: 'A', sourceIds: ['a'] }, { value: 'B', sourceIds: ['b'] }]);
        const output = await buildLocalizationMods('game', ['a', 'b'], review.reviewToken, [{ path, key: 'Hero', sourceModId: 'b' }]);
        const exported = join(directory, 'export_dir.vpk');
        writeFileSync(exported, output);
        expect(readLocalizationVpkEntry(exported, path)).toEqual(doc('B'));
        expect(readLocalizationVpkEntry(modA, path)).toEqual(doc('A'));
        expect(readLocalizationVpkEntry(modB, path)).toEqual(doc('B'));
    });

    it('prefers current loose stock and binds its bytes to the review', async () => {
        mkdirSync(join(directory, 'resource/localization'), { recursive: true });
        writeFileSync(join(directory, path), doc('Loose'));
        const review = await reviewLocalizationMods('game', ['a', 'b']);
        expect(review.files[0].changes[0].baseline).toBe('Loose');
        writeFileSync(join(directory, path), doc('Updated stock'));
        await expect(buildLocalizationMods('game', ['a', 'b'], review.reviewToken, [{ path, key: 'Hero', sourceModId: null }])).rejects.toThrow('changed');
    });

    it('rejects a modified mod after review', async () => {
        const review = await reviewLocalizationMods('game', ['a', 'b']);
        writeFileSync(modA, vpk('Changed'));
        await expect(buildLocalizationMods('game', ['a', 'b'], review.reviewToken, [{ path, key: 'Hero', sourceModId: 'a' }])).rejects.toThrow('changed');
    });

    it('rejects unknown mods, duplicate choices, missing choices and unreviewed files', async () => {
        await expect(reviewLocalizationMods('game', ['a', 'missing'])).rejects.toThrow('no longer');
        await expect(reviewLocalizationMods('game', ['a', 'a'])).rejects.toThrow('unique');
        const { reviewToken } = await reviewLocalizationMods('game', ['a', 'b']);
        const choice = { path, key: 'Hero', sourceModId: 'a' };
        await expect(buildLocalizationMods('game', ['a', 'b'], reviewToken, [choice, choice])).rejects.toThrow('Duplicate');
        await expect(buildLocalizationMods('game', ['a', 'b'], reviewToken, [])).rejects.toThrow('Review every');
        await expect(buildLocalizationMods('game', ['a', 'b'], reviewToken, [choice, { ...choice, path: 'resource/localization/other.txt' }])).rejects.toThrow('unreviewed');
    });

    it('rejects missing current stock rather than using a mod as the baseline', async () => {
        writeFileSync(join(directory, 'pak01_dir.vpk'), writeNativeVpk(new Map([['other.txt', Buffer.from('not stock')]])));
        await expect(reviewLocalizationMods('game', ['a', 'b'])).rejects.toThrow('missing');
    });
});
