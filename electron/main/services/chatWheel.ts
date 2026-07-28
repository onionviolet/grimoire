import { app } from 'electron';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/** Run the bundled ChatLane converter and surface its own diagnostics verbatim. */
export function chatLaneBinaryPath(): string {
    const executable = process.platform === 'win32' ? 'ChatLane.exe' : 'ChatLane';
    const root = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
    const binary = join(root, 'chatlane', executable);
    if (!existsSync(binary)) throw new Error(`Chat Wheel converter is unavailable: ${binary}`);
    return binary;
}

/** The bundled, valid starting point for creating a wheel without a YAML file. */
export async function readChatWheelStarter(): Promise<string> {
    const root = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
    const templatePath = join(root, 'chatlane', 'starter.yml');
    if (!existsSync(templatePath)) throw new Error(`Chat Wheel starter template is unavailable: ${templatePath}`);
    return fs.readFile(templatePath, 'utf8');
}

async function runChatLane(input: string, output: string): Promise<void> {
    const binary = chatLaneBinaryPath();
    await new Promise<void>((resolve, reject) => {
        const child = spawn(binary, [input, output], { windowsHide: true });
        let outputText = '';
        child.stdout.on('data', (chunk: Buffer) => { outputText += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer) => { outputText += chunk.toString(); });
        child.once('error', reject);
        child.once('close', (code) => code === 0
            ? resolve()
            : reject(new Error(outputText.trim() || `ChatLane exited with status ${code ?? 'unknown'}.`)));
    });
}

export async function readChatWheelVpk(vpkPath: string): Promise<string> {
    if (!vpkPath.toLowerCase().endsWith('.vpk') || !existsSync(vpkPath)) throw new Error('Select an existing .vpk file.');
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-chatwheel-'));
    const output = join(dir, 'chatlane.yml');
    try {
        await runChatLane(vpkPath, output);
        return await fs.readFile(output, 'utf8');
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

/** Validates and converts YAML to a staging VPK. Caller owns install/replacement. */
export async function buildChatWheelVpk(yaml: string): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    if (!yaml.trim()) throw new Error('Chat Wheel YAML cannot be empty.');
    const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-chatwheel-'));
    const input = join(dir, 'chatlane.yml');
    const output = join(dir, 'chatlane_dir.vpk');
    try {
        await fs.writeFile(input, yaml, 'utf8');
        await runChatLane(input, output);
        if (!existsSync(output)) throw new Error('ChatLane completed without producing a VPK.');
        return { vpkPath: output, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
    } catch (err) {
        await fs.rm(dir, { recursive: true, force: true });
        throw err;
    }
}

/**
 * Run ChatLane against the current YAML without installing or retaining the
 * generated VPK. This intentionally uses the same converter path as Save so
 * inline feedback cannot disagree with the eventual install result.
 */
export async function validateChatWheelYaml(yaml: string): Promise<void> {
    const built = await buildChatWheelVpk(yaml);
    await built.cleanup();
}
