import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { getActiveDeadlockPath } from '../services/settings';
import { scanMods, allocateEnabledVpkPath, runExclusiveModMutation } from '../services/mods';
import { metaKeyFor } from '../services/deadlock';
import { setModMetadataWithHash } from '../services/metadata';
import { assertCanMoveLoadedGameMod } from '../services/gameSessionMods';
import { buildChatWheelVpk, readChatWheelVpk } from '../services/chatWheel';

interface ChatWheelSaveArgs { yaml: string; name: string; replaceModId?: string; }

ipcMain.handle('chat-wheel:read', async (_, vpkPath: string): Promise<string> => readChatWheelVpk(vpkPath));

ipcMain.handle('chat-wheel:save', async (_, args: ChatWheelSaveArgs) => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) throw new Error('No Deadlock path configured.');
    if (!args.name.trim()) throw new Error('Give this chat wheel a name.');
    return runExclusiveModMutation(async () => {
        const built = await buildChatWheelVpk(args.yaml);
        try {
            const mods = await scanMods(deadlockPath);
            const replacing = args.replaceModId ? mods.find((mod) => mod.id === args.replaceModId) : undefined;
            if (args.replaceModId && !replacing) throw new Error('The selected chat wheel is no longer installed.');
            if (replacing) assertCanMoveLoadedGameMod(replacing);
            const destination = replacing?.path ?? await allocateEnabledVpkPath(deadlockPath);
            await fs.copyFile(built.vpkPath, destination);
            await setModMetadataWithHash(metaKeyFor(destination), {
                modName: args.name.trim(), sourceSection: 'ChatWheel', chatWheel: true,
            }, destination);
            const refreshed = await scanMods(deadlockPath);
            return refreshed.find((mod) => mod.path === destination) ?? null;
        } finally {
            await built.cleanup();
        }
    });
});
