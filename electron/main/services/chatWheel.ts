import { app } from 'electron';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ChatWheelConverterStatus, ChatWheelPlatform } from '../../../src/types/chatWheelPlatform';
import { chatLaneMenuNames, compileChatLaneVpk, readChatLaneConfig } from './chatWheelNative';
import { parseVpkDirectoryCached } from './vpk';
import type { Mod } from './mods';
import { CHAT_WHEEL_RESOURCE } from '../../../src/lib/chatWheelAddon';
export const CHAT_WHEEL_UNBIND_REQUIRED = 'Unbind custom chat wheel menus in Deadlock while their wheel is loaded, then close the game before continuing.';

export function suppliesChatWheel(mod: Pick<Mod, 'sourceSection' | 'path'>): boolean {
    return mod.sourceSection === 'ChatWheel' || (parseVpkDirectoryCached(mod.path)?.some(path => path.toLowerCase() === CHAT_WHEEL_RESOURCE) ?? false);
}

export async function mayHaveCustomChatWheelBindings(mod: Pick<Mod, 'sourceSection' | 'path' | 'enabled'>): Promise<boolean> {
    if (!mod.enabled || !suppliesChatWheel(mod)) return false;
    try {
        return chatLaneMenuNames(await readChatWheelVpk(mod.path)).length > 0;
    } catch {
        return true;
    }
}

function chatWheelResourceRoot(): string {
    return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
}

/** The converter runs in Node on every desktop platform; only its data needs packaging. */
export function getChatWheelConverterStatus(
    platform: ChatWheelPlatform = process.platform as ChatWheelPlatform,
    resourceRoot = chatWheelResourceRoot(),
    fileExists: (path: string) => boolean = existsSync,
): ChatWheelConverterStatus {
    if (!['win32', 'darwin', 'linux'].includes(platform)) return { available: false, platform, reason: 'unsupported-platform' };
    const directory = join(resourceRoot, 'chatlane');
    return ['base-commands.json', 'red2.bin', 'starter.yml', 'LICENSE'].every((name) => fileExists(join(directory, name)))
        ? { available: true, platform }
        : { available: false, platform, reason: 'missing-resource' };
}

/** The bundled, valid starting point for creating a wheel without a YAML file. */
export async function readChatWheelStarter(): Promise<string> {
    const templatePath = join(chatWheelResourceRoot(), 'chatlane', 'starter.yml');
    if (!existsSync(templatePath)) throw new Error(`Chat Wheel starter template is unavailable: ${templatePath}`);
    return fs.readFile(templatePath, 'utf8');
}

export async function readChatWheelVpk(vpkPath: string): Promise<string> {
    if (!vpkPath.toLowerCase().endsWith('.vpk') || !existsSync(vpkPath)) throw new Error('Select an existing .vpk file.');
    return readChatLaneConfig(vpkPath);
}

/** Validates and converts YAML to a staging VPK. Caller owns install/replacement. */
export async function buildChatWheelVpk(yaml: string): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    if (!yaml.trim()) throw new Error('Chat Wheel YAML cannot be empty.');
    const status = getChatWheelConverterStatus();
    if (!status.available) throw new Error(`Chat Wheel converter resources are unavailable for ${status.platform}.`);
    const bytes = await compileChatLaneVpk(yaml, join(chatWheelResourceRoot(), 'chatlane'));
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-chatwheel-'));
    const output = join(dir, 'chatlane_dir.vpk');
    try {
        await fs.writeFile(output, bytes);
        return { vpkPath: output, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
    } catch (err) {
        await fs.rm(dir, { recursive: true, force: true });
        throw err;
    }
}

/** Validation shares the exact compiler used for saving, with no retained VPK or mod writes. */
export async function validateChatWheelYaml(yaml: string): Promise<void> {
    if (!yaml.trim()) throw new Error('Chat Wheel YAML cannot be empty.');
    const status = getChatWheelConverterStatus();
    if (!status.available) throw new Error(`Chat Wheel converter resources are unavailable for ${status.platform}.`);
    await compileChatLaneVpk(yaml, join(chatWheelResourceRoot(), 'chatlane'));
}
