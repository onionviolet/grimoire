import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getCitadelPath } from './deadlock';
import { scanModsReadOnly } from './mods';
import { parseVpkEntryIndex } from './vpk';
import { buildLocalizationOverride, mergeLocalization, planLocalizationMerge, readLocalizationVpkEntry } from './localizationMerge';
import type { LocalizationSource } from './localizationMerge';
import type { LocalizationModsReview, LocalizationTokenChoice } from '../../../src/types/localizationMerge';

async function capture(gamePath: string, modIds: string[]) {
    if (!Array.isArray(modIds) || modIds.length < 2 || modIds.length > 100 || modIds.some(id => typeof id !== 'string') || new Set(modIds).size !== modIds.length) throw new Error('Select between two and 100 unique localization mods');
    const installed = await scanModsReadOnly(gamePath);
    const groups = new Map<string, LocalizationSource[]>();
    let totalBytes = 0;
    const account = (bytes: Buffer) => {
        totalBytes += bytes.length;
        if (totalBytes > 64 * 1024 * 1024) throw new Error('Localization review inputs exceed 64 MiB');
        return bytes;
    };
    for (const id of modIds) {
        const mod = installed.find(mod => mod.id === id);
        if (!mod) throw new Error('Selected localization mod is no longer available');
        const entries = parseVpkEntryIndex(mod.path);
        if (!entries) throw new Error('Selected localization mod is unreadable');
        for (const entry of entries) {
            const path = entry.path.toLowerCase();
            if (!path.startsWith('resource/localization/') || !path.endsWith('.txt')) continue;
            if (!groups.has(path)) groups.set(path, []);
            const group = groups.get(path)!;
            if (group.some(source => source.id === id)) throw new Error('Ambiguous localization entry');
            group.push({ id, bytes: account(readLocalizationVpkEntry(mod.path, path)) });
            if (groups.size > 100) throw new Error('Localization review supports up to 100 files');
        }
    }
    const citadel = getCitadelPath(gamePath);
    const captured = [];
    let changeCount = 0;
    const hash = createHash('sha256');
    hash.update(JSON.stringify(modIds));
    for (const [path, sources] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
        // A current loose localization file takes precedence over the stock pak.
        let baseline: Buffer;
        try {
            const loose = join(citadel, path);
            if ((await fs.stat(loose)).size > 8 * 1024 * 1024) throw new Error('Stock localization file exceeds 8 MiB');
            baseline = account(await fs.readFile(loose));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            baseline = account(readLocalizationVpkEntry(join(citadel, 'pak01_dir.vpk'), path));
        }
        const plan = planLocalizationMerge(baseline, sources);
        changeCount += plan.changes.length;
        if (changeCount > 100_000) throw new Error('Localization review supports up to 100,000 changed tokens');
        hash.update(JSON.stringify([path, createHash('sha256').update(baseline).digest('hex'), sources.map(source => [source.id, createHash('sha256').update(source.bytes).digest('hex')])]));
        captured.push({ path, baseline, sources, plan });
    }
    if (!captured.length || !captured.some(file => file.plan.changes.length)) throw new Error('Selected mods contain no localization changes');
    return { captured, reviewToken: hash.digest('hex') };
}

export async function reviewLocalizationMods(gamePath: string, modIds: string[]): Promise<LocalizationModsReview> {
    const { captured, reviewToken } = await capture(gamePath, modIds);
    return { reviewToken, files: captured.map(({ path, plan }) => ({ path, ...plan })) };
}

/** Standalone export from a fresh immutable capture. Never installs a mod,
 * changes priority, disables a source or mutates a generic merge manifest. */
export async function buildLocalizationMods(gamePath: string, modIds: string[], reviewToken: string, choices: LocalizationTokenChoice[]): Promise<Buffer> {
    if (typeof reviewToken !== 'string' || !Array.isArray(choices) || choices.length > 100_000) throw new Error('Invalid localization review');
    const { captured, reviewToken: current } = await capture(gamePath, modIds);
    if (current !== reviewToken) throw new Error('Localization sources or stock text changed. Review again before exporting');
    const remaining = new Map<string, Map<string, string | null>>();
    for (const choice of choices) {
        if (!choice || typeof choice.path !== 'string' || typeof choice.key !== 'string' || choice.sourceModId !== null && typeof choice.sourceModId !== 'string') throw new Error('Invalid localization choice');
        if (!remaining.has(choice.path)) remaining.set(choice.path, new Map());
        const tokens = remaining.get(choice.path)!;
        if (tokens.has(choice.key)) throw new Error('Duplicate localization choice');
        tokens.set(choice.key, choice.sourceModId);
    }
    const output = new Map<string, Buffer>();
    for (const file of captured) {
        const selected = remaining.get(file.path) ?? new Map();
        const bytes = mergeLocalization(file.baseline, file.sources, selected);
        if (file.plan.changes.length) output.set(file.path, bytes);
        remaining.delete(file.path);
    }
    if (remaining.size) throw new Error('Localization choices refer to an unreviewed file');
    return buildLocalizationOverride(output);
}
