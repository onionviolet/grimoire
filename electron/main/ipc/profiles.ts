import { ipcMain } from 'electron';
import { loadSettings, saveSettings, getActiveDeadlockPath } from '../services/settings';
import {
    loadProfiles,
    createProfile,
    createProfileFromGameBananaIds,
    updateProfile,
    applyProfile,
    previewProfile,
    deleteProfile,
    renameProfile,
    removeProfileCrosshair,
    type Profile,
    type ProfileCrosshairSettings,
    type ApplyProfileResult,
} from '../services/profiles';
import {
    buildPortableProfile,
    parsePortableProfile,
    resolvePortableProfile,
    createProfileFromPortable,
} from '../services/portableProfile';
import { listProfileRecoveryPoints, previewProfileRecovery, restoreProfileRecovery } from '../services/profileRecovery';
import type {
    PortableProfile,
    PortableResolvedMod,
} from '../../../src/types/portableProfile';

// get-profiles
ipcMain.handle('get-profiles', (): Profile[] => {
    return loadProfiles();
});

// create-profile
ipcMain.handle('create-profile', async (_, name: string, crosshairSettings?: ProfileCrosshairSettings): Promise<Profile> => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured');
    }
    const profile = await createProfile(deadlockPath, name, crosshairSettings);

    // Set as active profile
    const settings = loadSettings();
    settings.activeProfileId = profile.id;
    saveSettings(settings);

    return profile;
});

// create-profile-from-gamebanana-ids — used by the collection import flow
// to make a profile containing only the mods that were just imported.
ipcMain.handle(
    'create-profile-from-gamebanana-ids',
    async (
        _,
        args: { name: string; gameBananaIds: number[] }
    ): Promise<Profile> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) {
            throw new Error('No Deadlock path configured');
        }
        return createProfileFromGameBananaIds(deadlockPath, args.name, args.gameBananaIds);
    }
);

// update-profile
ipcMain.handle('update-profile', async (_, profileId: string, crosshairSettings?: ProfileCrosshairSettings): Promise<Profile> => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured');
    }
    return await updateProfile(deadlockPath, profileId, crosshairSettings);
});

// apply-profile
ipcMain.handle('preview-profile', async (_, profileId: string) => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) throw new Error('No Deadlock path configured');
    return previewProfile(deadlockPath, profileId);
});

ipcMain.handle('apply-profile', async (_, profileId: string, reviewToken?: string): Promise<ApplyProfileResult> => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured');
    }

    const result = await applyProfile(deadlockPath, profileId, reviewToken);

    return result;
});

// delete-profile
ipcMain.handle('delete-profile', (_, profileId: string): void => {
    deleteProfile(profileId);
});

// rename-profile
ipcMain.handle('rename-profile', (_, profileId: string, newName: string): Profile => {
    return renameProfile(profileId, newName);
});

// remove-profile-crosshair: drops the crosshair from a profile without
// re-scanning/clobbering its mod list (unlike update-profile).
ipcMain.handle('remove-profile-crosshair', (_, profileId: string): Profile => {
    return removeProfileCrosshair(profileId);
});

// export-portable-profile
ipcMain.handle('export-portable-profile', async (_, profileId: string) => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) {
        throw new Error('No Deadlock path configured');
    }
    return buildPortableProfile(deadlockPath, profileId);
});

// parse-portable-profile — accepts raw JSON or a share code, returns the
// validated profile so the renderer can show a preview.
ipcMain.handle('parse-portable-profile', (_, input: string): PortableProfile => {
    return parsePortableProfile(input);
});

// resolve-portable-profile — looks up each entry against GameBanana and
// returns the per-row exact/upgraded/unresolvable categorization for the
// import preview UI. Passes the active Deadlock path so the resolver can
// flag entries that are already installed and skip their downloads. When no
// path is configured, resolution still succeeds but the already-installed
// hint is unavailable.
ipcMain.handle(
    'resolve-portable-profile',
    async (_, profile: PortableProfile) => {
        const deadlockPath = getActiveDeadlockPath();
        return resolvePortableProfile(profile, deadlockPath);
    }
);

// finalize-portable-import — called after downloads finish to capture the
// import as a new local profile (preserves priority, enabled state, and
// extensions). The renderer is responsible for kicking off downloads via the
// existing download-mod handler before calling this.
ipcMain.handle(
    'finalize-portable-import',
    async (_, args: { profile: PortableProfile; resolved: PortableResolvedMod[] }): Promise<Profile> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) {
            throw new Error('No Deadlock path configured');
        }
        return createProfileFromPortable(deadlockPath, args.profile, args.resolved);
    }
);

ipcMain.handle('list-profile-recovery-points', () => listProfileRecoveryPoints());
ipcMain.handle('preview-profile-recovery', async (_, id: string) => {
    const path = getActiveDeadlockPath();
    if (!path) throw new Error('No Deadlock path configured');
    return previewProfileRecovery(path, id);
});
ipcMain.handle('restore-profile-recovery', async (_, id: string, reviewToken: string) => {
    const path = getActiveDeadlockPath();
    if (!path) throw new Error('No Deadlock path configured');
    return restoreProfileRecovery(path, id, reviewToken);
});
