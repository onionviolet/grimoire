import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '0.0.0-test' } }));
vi.mock('./profiles', () => ({ addProfile: vi.fn(), generateProfileId: vi.fn(), loadProfiles: vi.fn() }));
vi.mock('./mods', () => ({ scanMods: vi.fn() }));
vi.mock('./metadata', () => ({ getModMetadata: vi.fn() }));
vi.mock('./lockerVpk', () => ({ isLockerManaged: vi.fn() }));
vi.mock('./gamebanana', () => ({ fetchModDetails: vi.fn() }));

import { parsePortableProfile } from './portableProfile';
import { isGameBananaImageUrl } from '../utils/gamebananaImage';
import { PORTABLE_PROFILE_FORMAT, PORTABLE_PROFILE_SCHEMA_VERSION } from '../../../src/types/portableProfile';

const GB_THUMB = 'https://images.gamebanana.com/img/ss/mods/530-90_abc.jpg';

describe('isGameBananaImageUrl', () => {
    it('accepts only https URLs on images.gamebanana.com', () => {
        expect(isGameBananaImageUrl(GB_THUMB)).toBe(true);
        expect(isGameBananaImageUrl('http://images.gamebanana.com/img/ss/mods/a.jpg')).toBe(false);
        expect(isGameBananaImageUrl('https://images.gamebanana.com.evil.example/a.jpg')).toBe(false);
        expect(isGameBananaImageUrl('https://tracker.example/pixel.gif')).toBe(false);
        expect(isGameBananaImageUrl('data:image/png;base64,AAAA')).toBe(false);
        expect(isGameBananaImageUrl('not a url')).toBe(false);
        expect(isGameBananaImageUrl(undefined)).toBe(false);
    });
});

describe('parsePortableProfile thumbnails', () => {
    it('keeps GameBanana thumbnails and drops ones from any other host', () => {
        const mod = (thumbnailUrl: string) => ({
            source: 'gamebanana',
            ref: { submissionId: 1, fileId: 2 },
            enabled: true,
            priority: 1,
            hint: { name: 'Skin', thumbnailUrl },
        });
        const profile = parsePortableProfile(JSON.stringify({
            format: PORTABLE_PROFILE_FORMAT,
            schemaVersion: PORTABLE_PROFILE_SCHEMA_VERSION,
            game: { id: 'deadlock' },
            profile: { name: 'Shared' },
            mods: [mod(GB_THUMB), mod('https://tracker.example/pixel.gif')],
        }));

        expect(profile.mods[0].hint).toEqual({ name: 'Skin', thumbnailUrl: GB_THUMB });
        expect(profile.mods[1].hint).toEqual({ name: 'Skin' });
    });
});
