/** Read-only scanner for content shipped in pak01 but not exposed by the live
 * roster or sound-event catalog.  Kept separate from the UI so its evidence
 * rules stay unit-testable and the scan never gains build-tray privileges. */
import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { getCitadelPath } from './deadlock';
import { extractHeroFromPath, parseVpkEntryIndex } from './vpk';
import {
    foundryBuildFingerprintKey,
    getGlobalSounds,
    getHeroRoster,
    getHeroSounds,
} from './foundryCatalog';
import type { HeroInfo, NonStandardFinding, NonStandardReport } from '../../../src/types/foundry';

function cacheRoot(): string { return join(app.getPath('userData'), 'foundry-nonstandard-cache'); }
function normalize(path: string): string { return path.replace(/\\/g, '/').toLowerCase(); }
function compiledSound(path: string): string {
    const normalized = normalize(path);
    return normalized.endsWith('.vsnd') ? `${normalized}_c` : normalized;
}

export function categoryForNonStandardPath(path: string): NonStandardFinding['category'] {
    const p = normalize(path);
    if (/\.(vsnd|vsnd_c)$/.test(p)) return 'sound';
    if (/(portrait|hero_card|card_image)/.test(p)) return 'portrait';
    if (/\.(vtex_c|png|jpg|jpeg|webp)$/.test(p)) return 'texture';
    if (extractHeroFromPath(p)) return 'hero';
    return 'other';
}

/** Tier C is intentionally narrow.  A match is an exploration hint, never a
 * statement that the game does not use the file. */
export function namingSignal(path: string): string | null {
    const segment = normalize(path).split('/').find((part) =>
        /^(old_|test_|dev_|debug_)/.test(part) ||
        /(?:^|_)(unused|deprecated|wip)(?:_|\.|$)/.test(part) ||
        /(?:^|_)v1(?:_|\.)/.test(part)
    );
    return segment ?? null;
}

/** Pure classification core, exported for fixture tests without a pak. */
export function classifyNonStandardEntries(
    paths: readonly string[],
    roster: readonly HeroInfo[],
    liveSounds: ReadonlySet<string>
): NonStandardFinding[] {
    const rosterByCode = new Map(roster.map((hero) => [hero.codename.toLowerCase(), hero]));
    const findings: NonStandardFinding[] = [];
    for (const path of paths) {
        const hero = extractHeroFromPath(normalize(path));
        const knownHero = hero ? rosterByCode.get(hero) : undefined;
        if (hero && (!knownHero || knownHero.disabled)) {
            findings.push({
                path,
                tier: 'subject-not-live',
                category: categoryForNonStandardPath(path),
                reason: knownHero
                    ? `Hero \`${hero}\` is not in the live roster.`
                    : `Hero \`${hero}\` is not in the roster.`,
            });
            continue;
        }
        if (/\.vsnd_c$/i.test(path) && !liveSounds.has(normalize(path))) {
            findings.push({
                path,
                tier: 'unreferenced-sound',
                category: 'sound',
                reason: 'No live sound event references this clip.',
            });
            continue;
        }
        const signal = namingSignal(path);
        if (signal) {
            findings.push({
                path,
                tier: 'naming-signal',
                category: categoryForNonStandardPath(path),
                reason: `Path segment \`${signal}\` is a naming signal only.`,
            });
        }
    }
    return findings;
}

export async function scanNonStandardFiles(deadlockPath: string): Promise<NonStandardReport> {
    const fingerprint = await foundryBuildFingerprintKey(deadlockPath);
    const file = join(cacheRoot(), `${fingerprint}.json`);
    try { return JSON.parse(await fs.readFile(file, 'utf8')) as NonStandardReport; } catch { /* scan below */ }

    const pak = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
    const paths = parseVpkEntryIndex(pak);
    if (!paths) throw new Error('Could not read the pak01 directory index.');
    const [roster, heroSounds, globalSounds] = await Promise.all([
        getHeroRoster(deadlockPath), getHeroSounds(deadlockPath), getGlobalSounds(deadlockPath),
    ]);
    const liveSounds = new Set([
        ...heroSounds.flatMap((sound) => sound.vsnd),
        ...globalSounds.flatMap((sound) => sound.vsnd),
    ].map(compiledSound));
    const findings = classifyNonStandardEntries(paths.map((entry) => entry.path), roster, liveSounds);
    const report: NonStandardReport = {
        fingerprint,
        generatedAt: new Date().toISOString(),
        findings,
        confirmedCount: findings.filter((finding) => finding.tier !== 'naming-signal').length,
    };
    await fs.mkdir(cacheRoot(), { recursive: true });
    await fs.writeFile(file, JSON.stringify(report), 'utf8');
    return report;
}
