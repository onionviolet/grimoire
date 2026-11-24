import { ipcMain } from 'electron';
import { constants, promises as fs } from 'fs';
import type { ChatWheelSaveArgs } from '../../../src/types/electron';
import { getActiveDeadlockPath, loadSettings } from '../services/settings';
import { scanMods, scanModsReadOnly, allocateEnabledVpkPath, runExclusiveModMutation } from '../services/mods';
import { getGameinfoPath, metaKeyFor } from '../services/deadlock';
import { dirname, relative, sep } from 'path';
import { gameSearchPaths } from '../services/gameinfoSearchPaths';
import { setModMetadataWithHash } from '../services/metadata';
import { hasPendingGameLaunch, syncRunningGameModSnapshotFromMods } from '../services/gameSessionMods';
import { showSaveDialog } from '../services/dialogs';
import { fingerprintFile } from '../services/fileMatch';
import { placeRecoveryFile, retainRecoveryFile } from '../services/recoveryBackup';
import { beginRecoveryMutation, clearRecoveryJournal, createRecoveryJournal, journalRecoveryMetadata, journalRecoveryPaths } from '../services/recoveryJournal';
import { recoverInterruptedUnlocked } from '../services/profileRecovery';
import { chatLaneMenuNames } from '../services/chatWheelNative';
import { buildChatWheelVpk, readChatWheelStarter, readChatWheelVpk, getChatWheelConverterStatus, validateChatWheelYaml, suppliesChatWheel } from '../services/chatWheel';
import { resolveChatWheelDressing } from '../services/chatWheelDressing';
import type { ChatWheelDressing } from '../../../src/types/chatWheelDressing';
import type { ChatWheelConverterStatus, ChatWheelInspection } from '../../../src/types/chatWheelPlatform';

// Game-asset dressing for the preview (Phase 11 spike). Null is the normal
// answer whenever there is no game path, no qualifying pak entry, or the
// Foundry decode fails; the renderer then keeps its pure-SVG wheel. The
// Foundry flag itself is checked renderer-side, where the settings store is,
// so this handler never rejects: it is read-only over the base pak and the
// existing thumbnail cache.
ipcMain.handle('chat-wheel:dressing', async (): Promise<ChatWheelDressing | null> => {
    try {
        return await resolveChatWheelDressing(getActiveDeadlockPath());
    } catch {
        return null;
    }
});

ipcMain.handle('chat-wheel:inspect', async (): Promise<ChatWheelInspection | null> => {
    const gamePath = getActiveDeadlockPath();
    if (!gamePath) return null;
    const content = await fs.readFile(getGameinfoPath(gamePath), 'utf8').catch(() => null);
    const mounts = content === null ? null : gameSearchPaths(content);
    const mods = (await scanModsReadOnly(gamePath)).filter(suppliesChatWheel);
    const providers = await Promise.all(mods.map(async mod => {
        const mount = relative(dirname(getGameinfoPath(gamePath)), dirname(mod.path)).split(sep).join('/').toLowerCase();
        const fromGameRoot = `citadel/${mount}`;
        const order = mod.enabled ? mounts?.indexOf(fromGameRoot) ?? -1 : -1;
        const menus = await readChatWheelVpk(mod.path).then(chatLaneMenuNames).catch(() => null);
        return { id: mod.id, name: mod.name, enabled: mod.enabled, mount: fromGameRoot, order: order < 0 ? null : order, menus, priority: mod.priority };
    }));
    providers.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.priority - b.priority || a.name.localeCompare(b.name));
    return { mountOrderKnown: mounts !== null, providers };
});

ipcMain.handle('chat-wheel:status', async (): Promise<ChatWheelConverterStatus> => getChatWheelConverterStatus());

ipcMain.handle('chat-wheel:read', async (_, vpkPath: string): Promise<string> => readChatWheelVpk(vpkPath));

ipcMain.handle('chat-wheel:starter', async (): Promise<string> => readChatWheelStarter());

// This is deliberately a separate, non-mutating operation. The renderer
// debounces calls while editing and surfaces ChatLane's diagnostics inline.
ipcMain.handle('chat-wheel:validate', async (_, yaml: string): Promise<void> => validateChatWheelYaml(yaml));

ipcMain.handle('chat-wheel:export', async (_, yaml: string, name: string) => {
    const built = await buildChatWheelVpk(yaml);
    try {
        const stem = name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'chat-wheel';
        const destination = await showSaveDialog({ defaultPath: `${stem}_dir.vpk`, filters: [{ name: 'Valve Pak', extensions: ['vpk'] }] });
        if (destination.canceled || !destination.filePath) return null;
        const filePath = /\.vpk$/i.test(destination.filePath) ? destination.filePath : `${destination.filePath}.vpk`;
        const gamePath = getActiveDeadlockPath();
        if (gamePath) {
            const gameRoot = await fs.realpath(gamePath);
            const folder = await fs.realpath(dirname(filePath));
            const location = relative(gameRoot, folder);
            if (location === '' || (!location.startsWith(`..${sep}`) && location !== '..' && !location.includes(':'))) {
                throw new Error('Export the wheel outside the Deadlock installation. Use Activate to load it in game.');
            }
        }
        await fs.copyFile(built.vpkPath, filePath, constants.COPYFILE_EXCL);
        return filePath;
    } finally {
        await built.cleanup();
    }
});

ipcMain.handle('chat-wheel:save', async (_, args: ChatWheelSaveArgs) => {
    const deadlockPath = getActiveDeadlockPath();
    if (!deadlockPath) throw new Error('No Deadlock path configured.');
    if (!args.name.trim()) throw new Error('Give this chat wheel a name.');
    const built = await buildChatWheelVpk(args.yaml);
    try {
        return await runExclusiveModMutation(async () => {
            if (getActiveDeadlockPath() !== deadlockPath) throw new Error('Deadlock path changed. Review the wheel again.');
            const mods = await scanMods(deadlockPath);
            if ((await syncRunningGameModSnapshotFromMods(mods)).running || hasPendingGameLaunch()) {
                throw new Error('Close Deadlock before activating a chat wheel.');
            }

            const replacing = args.replaceModId ? mods.find((mod) => mod.id === args.replaceModId && mod.sourceSection === 'ChatWheel' && mod.enabled) : undefined;
            if (args.replaceModId && !replacing) throw new Error('The wheel selected for replacement is no longer active. Reload the editor.');
            const competing = mods.find((mod) => mod.enabled && mod.id !== replacing?.id &&
                suppliesChatWheel(mod));
            if (competing) throw new Error(`“${competing.name}” already supplies the chat wheel. Unbind its custom menus before disabling it or replacing it.`);

            const beforeHash = replacing ? (await fingerprintFile(replacing.path)).sha256 : null;
            if (replacing && !args.customMenusUnbound) {
                const previous = chatLaneMenuNames(await readChatWheelVpk(replacing.path));
                const next = chatLaneMenuNames(args.yaml);
                if (previous.some((name, index) => name !== next[index])) {
                    throw new Error('This edit changes existing custom menu IDs. Unbind the custom menus in Deadlock before applying it.');
                }
            }

            const destination = replacing?.path ?? await allocateEnabledVpkPath(deadlockPath);
            const key = metaKeyFor(destination);
            const hash = await retainRecoveryFile(built.vpkPath);
            const journal = await createRecoveryJournal(deadlockPath, loadSettings().activeProfileId ?? null);
            try {
                await journalRecoveryMetadata(journal, [key]);
                await journalRecoveryPaths(journal, [{ path: destination, hash, expectedBefore: beforeHash }]);
                await beginRecoveryMutation(journal);
                await placeRecoveryFile(hash, destination, async () => {
                    const current = await fingerprintFile(destination).then(file => file.sha256).catch((error: NodeJS.ErrnoException) => {
                        if (error.code === 'ENOENT') return null;
                        throw error;
                    });
                    if (current !== beforeHash) throw new Error('The chat wheel changed during review.');
                });
                await setModMetadataWithHash(key, { modName: args.name.trim(), sourceSection: 'ChatWheel', chatWheel: true }, destination);
                const refreshed = await scanMods(deadlockPath);
                const installed = refreshed.find((mod) => mod.path === destination);
                if (!installed) throw new Error('The activated wheel could not be found.');
                await clearRecoveryJournal();
                return installed;
            } catch (error) {
                await recoverInterruptedUnlocked(deadlockPath);
                throw error;
            }
        });
    } finally {
        await built.cleanup();
    }
});
