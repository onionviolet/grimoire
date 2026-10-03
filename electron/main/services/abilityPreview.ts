import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { modelCodenamesForHero, modelEntryForHero, soundCodenameForHeroName } from '../../../src/lib/heroIdentity';
import { HERO_ABILITY_SLOTS } from './heroAbilitySlots';
import { getHeroSounds, ensureVoiceclip, foundryBuildFingerprintKey } from './foundryCatalog';
import { inspectionCache, retainInspectionCache, pruneInspectionCaches } from './assetInspection';
import { runVpkmergeStdout } from './modMerger';
import { getCitadelPath } from './deadlock';
import { getActiveHeroColor } from './heroColors';
import type { AbilitySlot } from '../../../src/types/mod';
import type { HeroAbilityPreview, HeroAbilityPlayback, HeroAbilityPreviewOptions } from '../../../src/types/abilityPreview';
import { exportHeroAbilityPose, type ModelClipInfo } from './heroPoseModels';
import { previewAppliedHeroSound } from './heroSounds';

/** A whole authored token may identify one clip. Shared tokens and multiple
 * cast phases are unresolved: selecting the first match would invent a join. */
export function resolveAbilityClip(clips: ModelClipInfo[], token: string, otherTokens: string[]): string | null {
    if (otherTokens.filter(value => value === token).length !== 1) return null;
    const normalized = token.toLowerCase().replace(/^ability_/, '');
    const matches = clips.filter(clip => clip.durationSeconds > 0.001 && clip.frameCount > 1
        && /(?:^|_)(?:ability|cast)(?:_|$)/.test(clip.name.toLowerCase())
        && (`_${clip.name.toLowerCase()}_`).includes(`_${normalized}_`));
    return matches.length === 1 ? matches[0].name : null;
}
function selectors(heroName: string): string[][] {
    const entry = modelEntryForHero(heroName);
    return entry ? [['--entry', entry]] : modelCodenamesForHero(heroName).map(code => ['--hero', code]);
}
async function listClips(deadlockPath: string, heroName: string): Promise<ModelClipInfo[]> {
    const pak = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
    for (const selector of selectors(heroName)) {
        try {
            const parsed: unknown = JSON.parse(await runVpkmergeStdout(['model', 'clips', '--vpk', pak, ...selector, '--json']));
            if (!Array.isArray(parsed)) continue;
            const clips = parsed.filter((clip): clip is ModelClipInfo => clip && typeof clip.name === 'string'
                && Number.isFinite(clip.durationSeconds) && Number.isFinite(clip.frameCount));
            if (clips.length) return clips;
        } catch { /* Other model aliases can be valid; unavailable is explicit. */ }
    }
    return [];
}
export async function listHeroAbilityPreviews(deadlockPath: string, heroName: string): Promise<HeroAbilityPreview[]> {
    const code = soundCodenameForHeroName(heroName);
    if (!code || !HERO_ABILITY_SLOTS[code]) return [];
    const [clips, sounds] = await Promise.all([listClips(deadlockPath, heroName), getHeroSounds(deadlockPath, { hero: code, category: 'ability' })]);
    const slots = HERO_ABILITY_SLOTS[code];
    const tokens = Object.values(slots).map(value => value.token);
    return ([1, 2, 3, 4] as AbilitySlot[]).flatMap(slot => {
        const meta = slots[slot];
        if (!meta) return [];
        const paths = [...new Set(sounds.filter(sound => sound.slot === slot).flatMap(sound => sound.vsnd))];
        return [{ slot, label: meta.display || meta.token, token: meta.token, clip: resolveAbilityClip(clips, meta.token, tokens),
            soundPath: paths.length === 1 ? paths[0] : null,
            // Particle filenames do not provide an authoritative slot-to-cast
            // join. Broad inspection is available separately, never guessed.
            particlePath: null }];
    });
}
const pending = new Map<string, Promise<HeroAbilityPlayback>>();
export async function prepareHeroAbilityPreview(deadlockPath: string, heroName: string, slot: AbilitySlot, options: HeroAbilityPreviewOptions = {}): Promise<HeroAbilityPlayback> {
    const ability = (await listHeroAbilityPreviews(deadlockPath, heroName)).find(ability => ability.slot === slot);
    if (!ability) throw new Error('No known ability slot for this hero.');
    const cache = await inspectionCache(deadlockPath, `ability:${heroName}:${slot}:${ability.clip}:${JSON.stringify(options)}`);
    const current = pending.get(cache.dir);
    if (current) return current;
    const release = retainInspectionCache(cache.dir);
    const work = (async (): Promise<HeroAbilityPlayback> => {
        let modelUrl: string | null = null;
        let skinApplied = false, skinFallback = false;
        if (ability.clip) {
            const path = join(cache.dir, 'ability.glb');
            const temporary = join(cache.dir, `${randomUUID()}.glb`);
            try {
                const source = await exportHeroAbilityPose(deadlockPath, heroName, ability.clip, temporary, options.skinSources, options.fallbackSkinMetaKey);
                const stat = await fs.stat(temporary);
                if (stat.size > 128 * 1024 * 1024 || stat.size < 20) throw new Error('Ability preview exceeds the size limit.');
                const bytes = await fs.readFile(temporary);
                if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid ability GLB export.');
                if (cache.key !== await foundryBuildFingerprintKey(deadlockPath)) throw new Error('The game files changed during ability export.');
                await fs.rename(temporary, path);
                modelUrl = cache.url + `ability.glb?v=${randomUUID()}`;
                skinApplied = source.skinApplied; skinFallback = source.skinFallback;
            } finally { await fs.rm(temporary, { force: true }); }
            if (!modelUrl) throw new Error('The selected ability animation could not be exported.');
        }
        const applied = ability.soundPath ? await previewAppliedHeroSound(deadlockPath, heroName, slot, ability.soundPath) : null;
        const soundUrl = ability.soundPath ? applied?.selected ? applied.url : await ensureVoiceclip(deadlockPath, ability.soundPath) : null;
        if (cache.key !== await foundryBuildFingerprintKey(deadlockPath)) throw new Error('The game files changed during ability export. Refresh the catalog.');
        return { ability, modelUrl, soundUrl, soundSource: soundUrl ? applied?.selected ? 'applied' : 'base' : 'unavailable',
            soundParams: applied?.params, skinApplied, skinFallback, effect: null, recolor: getActiveHeroColor(heroName) };
    })();
    pending.set(cache.dir, work);
    try { return await work; } finally { pending.delete(cache.dir); release(); await pruneInspectionCaches(cache.dir).catch(() => {}); }
}
