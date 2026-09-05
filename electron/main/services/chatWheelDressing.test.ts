import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextureCategory, TextureEntry, TextureFilters } from '../../../src/types/foundry';

/**
 * The resolver owns no decoding: it asks the Foundry catalog for entries and
 * the Foundry full-image cache for the PNG. Both are mocked at the module
 * boundary, so these tests pin the ranking rule and the never-throws contract
 * without an engine, a pak, or Electron.
 */
const catalog = vi.hoisted(() => ({
    getTextures: vi.fn<(deadlockPath: string, filters?: TextureFilters) => Promise<TextureEntry[]>>(),
    ensureFullImage: vi.fn<(deadlockPath: string, category: TextureCategory, entryPath: string) => Promise<string | null>>(),
}));

vi.mock('./foundryCatalog', () => catalog);

const { pickChatWheelBackplate, resolveChatWheelDressing } = await import('./chatWheelDressing');

const entry = (path: string, category: TextureCategory = 'other'): TextureEntry => ({
    path,
    category,
    hero: null,
    label: path,
});

const GAME = '/games/deadlock';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    catalog.getTextures.mockReset();
    catalog.ensureFullImage.mockReset();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

describe('pickChatWheelBackplate', () => {
    it('returns null when nothing qualifies (wrong root, no wheel in the name, or an icon)', () => {
        const picked = pickChatWheelBackplate([
            entry('models/props/wheel_bg.vtex_c'),
            entry('materials/particle/ping_wheel.vtex_c'),
            entry('panorama/images/hud/ping/ping_icon_help.vtex_c'),
            entry('panorama/images/hud/chat_wheel_icon_psd.vtex_c'),
            entry('panorama/images/hud/chat_wheel_bg.png'),
        ]);
        expect(picked).toBeNull();
    });

    it('prefers chat over ping, then a backplate token, then path order', () => {
        const chatBg = entry('panorama/images/hud/chat_wheel_bg_psd.vtex_c');
        const picked = pickChatWheelBackplate([
            entry('panorama/images/hud/ping/ping_wheel_bg_psd.vtex_c'),
            entry('panorama/images/hud/chat_wheel_arrow_psd.vtex_c'),
            chatBg,
            entry('panorama/images/hud/wheel_ring_psd.vtex_c'),
        ]);
        expect(picked).toBe(chatBg);
    });

    it('breaks a tie by path so the choice is deterministic for a pak', () => {
        const first = entry('panorama/images/hud/a_wheel_bg.vtex_c');
        const second = entry('panorama/images/hud/b_wheel_bg.vtex_c');
        expect(pickChatWheelBackplate([second, first])).toBe(first);
    });

    it('matches case-insensitively', () => {
        const shouty = entry('Panorama/Images/HUD/Chat_Wheel_BG.VTEX_C');
        expect(pickChatWheelBackplate([shouty])).toBe(shouty);
    });
});

describe('resolveChatWheelDressing', () => {
    it('resolves null without a game path and never touches the catalog', async () => {
        await expect(resolveChatWheelDressing(null)).resolves.toBeNull();
        await expect(resolveChatWheelDressing('')).resolves.toBeNull();
        expect(catalog.getTextures).not.toHaveBeenCalled();
        expect(catalog.ensureFullImage).not.toHaveBeenCalled();
    });

    it('resolves null when the catalog yields no qualifying entry, without decoding', async () => {
        catalog.getTextures.mockResolvedValue([entry('panorama/images/hud/ping/ping_icon_help.vtex_c')]);
        await expect(resolveChatWheelDressing(GAME)).resolves.toBeNull();
        expect(catalog.ensureFullImage).not.toHaveBeenCalled();
    });

    it('resolves null instead of throwing when the catalog engine fails', async () => {
        catalog.getTextures.mockRejectedValue(new Error('vpkmerge missing'));
        await expect(resolveChatWheelDressing(GAME)).resolves.toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('resolves null when the decoder has nothing to show', async () => {
        catalog.getTextures.mockResolvedValue([entry('panorama/images/hud/chat_wheel_bg.vtex_c')]);
        catalog.ensureFullImage.mockResolvedValue(null);
        await expect(resolveChatWheelDressing(GAME)).resolves.toBeNull();
    });

    it('resolves null instead of throwing when the decoder throws', async () => {
        catalog.getTextures.mockResolvedValue([entry('panorama/images/hud/chat_wheel_bg.vtex_c')]);
        catalog.ensureFullImage.mockRejectedValue(new Error('decode failed'));
        await expect(resolveChatWheelDressing(GAME)).resolves.toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('returns the decoded URL and entry path, deduping across searches and decoding once', async () => {
        const backplate = entry('panorama/images/hud/chat_wheel_bg.vtex_c', 'other');
        catalog.getTextures.mockResolvedValue([backplate, entry('panorama/images/hud/ping/ping_icon_help.vtex_c')]);
        catalog.ensureFullImage.mockResolvedValue('grimoire-foundry://key/other@full/chat_wheel_bg.png');

        await expect(resolveChatWheelDressing(GAME)).resolves.toEqual({
            backplateUrl: 'grimoire-foundry://key/other@full/chat_wheel_bg.png',
            entryPath: backplate.path,
        });

        // One search per term, each bounded, and exactly one decode of the pick.
        expect(catalog.getTextures.mock.calls.map(([, filters]) => filters?.search)).toEqual(['wheel', 'ping']);
        for (const [, filters] of catalog.getTextures.mock.calls) expect(filters?.limit).toBeGreaterThan(0);
        expect(catalog.ensureFullImage).toHaveBeenCalledTimes(1);
        expect(catalog.ensureFullImage).toHaveBeenCalledWith(GAME, 'other', backplate.path);
    });
});
