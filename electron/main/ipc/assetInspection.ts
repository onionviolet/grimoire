import { ipcMain } from 'electron';
import { getActiveDeadlockPath, loadSettings } from '../services/settings';
import { inspectAsset, listInspectionAssets } from '../services/assetInspection';
import { listHeroAbilityPreviews, prepareHeroAbilityPreview } from '../services/abilityPreview';
import type { HeroAbilityPreviewOptions } from '../../../src/types/abilityPreview';
import type { AbilitySlot } from '../../../src/types/mod';
function gamePath() {
    const path = getActiveDeadlockPath();
    if (!path) throw new Error('Set your Deadlock path in Settings first.');
    return path;
}
function requirePreview() {
    if (!loadSettings().experimentalAbilityPreview) throw new Error('Enable experimental ability previews in Settings first.');
}
function hero(value: unknown): string {
    if (typeof value !== 'string' || value.length > 100 || !value.trim()) throw new Error('Select a known hero.');
    return value;
}
export function registerAssetInspectionHandlers(): void {
    ipcMain.handle('asset-inspection:list', () => listInspectionAssets(gamePath()));
    ipcMain.handle('asset-inspection:inspect', (_event, path: unknown) => {
        if (typeof path !== 'string' || path.length > 1024) throw new Error('Select an exact catalog path.');
        return inspectAsset(gamePath(), path);
    });
    ipcMain.handle('ability-preview:list', (_event, name: unknown) => { requirePreview(); return listHeroAbilityPreviews(gamePath(), hero(name)); });
    ipcMain.handle('ability-preview:prepare', (_event, name: unknown, slot: unknown, options: unknown) => {
        requirePreview();
        if (![1, 2, 3, 4].includes(slot as number)) throw new Error('Select a known ability slot.');
        const request = (options ?? {}) as HeroAbilityPreviewOptions;
        if (typeof request !== 'object' || Array.isArray(request)
            || request.skinSources !== undefined && (!Array.isArray(request.skinSources) || request.skinSources.length > 32 || request.skinSources.some(source => !source || typeof source.metaKey !== 'string' || source.metaKey.length > 1024 || !source.metaKey.trim() || !Number.isFinite(source.priority)
                || source.previewId !== undefined && (typeof source.previewId !== 'string' || !source.previewId || source.previewId.length > 128)
                || !source.previewId && (!/^(?:(?:addons\d*|grimoire)\/)?[^/\\]+_dir\.vpk$/.test(source.metaKey) || [...source.metaKey].some(char => char.charCodeAt(0) < 32) || source.metaKey.split('/').some(part => part === '.' || part === '..'))))
            || request.fallbackSkinMetaKey !== undefined && (typeof request.fallbackSkinMetaKey !== 'string' || request.fallbackSkinMetaKey.length > 1024)) throw new Error('Invalid ability preview source selection.');
        return prepareHeroAbilityPreview(gamePath(), hero(name), slot as AbilitySlot, request);
    });
}
