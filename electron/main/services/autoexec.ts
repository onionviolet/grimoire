import * as fs from 'fs';
import * as path from 'path';

// Section markers for autoexec
export const CROSSHAIR_START = '// === CROSSHAIR SETTINGS (Mod Manager) ===';
export const CROSSHAIR_END = '// === END CROSSHAIR ===';
export const COMMANDS_START = '// === AUTOEXEC COMMANDS (Mod Manager) ===';
export const COMMANDS_END = '// === END COMMANDS ===';

export interface AutoexecData {
    header: string;
    crosshair: string | null;
    commands: string[];
    other: string;
}

function getExecutableAutoexecLine(line: string): string {
    // A line comment starts at the first // that begins the line or follows
    // whitespace. A // inside a token (e.g. a URL in an echo) is left intact.
    const match = /(^|\s)\/\//.exec(line);
    if (match) {
        return line.slice(0, match.index + match[1].length).trim();
    }
    return line.trim();
}

export function getManualAutoexecCommands(data: AutoexecData): string[] {
    return [data.header, data.other]
        .flatMap((section) => section.split('\n'))
        .map(getExecutableAutoexecLine)
        .filter((line) => line.length > 0);
}

// Helper to parse autoexec into sections
export function parseAutoexec(content: string): AutoexecData {
    const lines = content.split('\n');
    const header: string[] = [];
    const crosshair: string[] = [];
    const commands: string[] = [];
    const other: string[] = [];

    let section: 'header' | 'crosshair' | 'commands' | 'other' = 'header';

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === CROSSHAIR_START) {
            section = 'crosshair';
            continue;
        } else if (trimmed === CROSSHAIR_END) {
            section = 'other';
            continue;
        } else if (trimmed === COMMANDS_START) {
            section = 'commands';
            continue;
        } else if (trimmed === COMMANDS_END) {
            section = 'other';
            continue;
        }

        if (section === 'header') {
            // Old-style crosshair commands (written without section markers by
            // pre-1.18 applyPreset) are rescued into the crosshair section so a
            // rewrite upgrades them instead of silently deleting them.
            if (trimmed.startsWith('citadel_crosshair_') || trimmed.startsWith('// Preset:')) {
                crosshair.push(line);
            } else if (!line.includes('Mod Manager')) {
                header.push(line);
            }
        } else if (section === 'crosshair') {
            crosshair.push(line);
        } else if (section === 'commands') {
            const command = getExecutableAutoexecLine(line);
            if (command) commands.push(command);
        } else if (section === 'other') {
            if (trimmed.startsWith('citadel_crosshair_')) {
                crosshair.push(line);
            } else if (!line.includes('Crosshair settings from Deadlock Mod Manager') &&
                !line.includes('// Preset:')) {
                other.push(line);
            }
        }
    }

    return {
        header: header.join('\n').trim(),
        crosshair: crosshair.join('\n').trim() || null,
        commands,
        other: other.join('\n').trim(),
    };
}

// Helper to build autoexec content from sections
export function buildAutoexec(data: AutoexecData): string {
    const parts: string[] = [];

    // Header (user's manual content)
    if (data.header) {
        parts.push(data.header);
    } else {
        parts.push('// Deadlock autoexec.cfg');
        parts.push('// Managed by Deadlock Mod Manager');
        parts.push('// Add +exec autoexec to Steam launch options');
    }

    // Commands section
    if (data.commands.length > 0) {
        parts.push('');
        parts.push(COMMANDS_START);
        parts.push(...data.commands);
        parts.push(COMMANDS_END);
    }

    // Crosshair section
    if (data.crosshair) {
        parts.push('');
        parts.push(CROSSHAIR_START);
        parts.push(data.crosshair);
        parts.push(CROSSHAIR_END);
    }

    // User content that lived after the managed sections. Dropping this used
    // to silently destroy manual edits on every managed rewrite.
    if (data.other) {
        parts.push('');
        parts.push(data.other);
    }

    return parts.join('\n') + '\n';
}

export function getAutoexecPath(gamePath: string): string {
    return path.join(gamePath, 'game', 'citadel', 'cfg', 'autoexec.cfg');
}

/**
 * Where autoexec.cfg sets any of `keys`, scanned over the raw file rather than
 * the parsed sections: a line's position is the point, and parseAutoexec
 * deliberately reshuffles content between sections.
 *
 * autoexec runs after gameinfo.gi, so a line found here beats whatever a
 * gameinfo.gi control writes for the same ConVar. Two Grimoire surfaces can
 * therefore fight over one ConVar with the loser saying nothing, which is what
 * this exists to let the UI surface. `managed` marks a line inside the section
 * the Autoexec page owns, so the UI knows whether it can send the user
 * somewhere that can actually change it.
 *
 * The last assignment wins in a cfg, so a key set more than once reports its
 * last line.
 */
export function findAutoexecConvars(
    gamePath: string,
    keys: Iterable<string>
): Record<string, { value: string; line: number; managed: boolean }> {
    const wanted = new Set(keys);
    const found: Record<string, { value: string; line: number; managed: boolean }> = {};
    const autoexecPath = getAutoexecPath(gamePath);
    if (!wanted.size || !fs.existsSync(autoexecPath)) return found;

    let content: string;
    try {
        content = fs.readFileSync(autoexecPath, 'utf-8');
    } catch {
        return found; // unreadable autoexec is not worth failing a status read
    }

    let managed = false;
    content.split('\n').forEach((raw, index) => {
        const trimmed = raw.trim();
        if (trimmed === COMMANDS_START || trimmed === CROSSHAIR_START) {
            managed = true;
            return;
        }
        if (trimmed === COMMANDS_END || trimmed === CROSSHAIR_END) {
            managed = false;
            return;
        }
        const command = getExecutableAutoexecLine(raw);
        // `key value`, with the value optionally quoted. A bare `key` is a query
        // in the console, not an assignment, so it is not a conflict.
        const match = /^"?([A-Za-z_][\w.]*)"?\s+("[^"]*"|\S+)/.exec(command);
        if (!match || !wanted.has(match[1])) return;
        found[match[1]] = {
            value: match[2].replace(/^"|"$/g, ''),
            line: index + 1,
            managed,
        };
    });
    return found;
}

export function readAutoexec(gamePath: string): AutoexecData {
    const autoexecPath = getAutoexecPath(gamePath);
    if (!fs.existsSync(autoexecPath)) {
        return { header: '', crosshair: null, commands: [], other: '' };
    }
    const content = fs.readFileSync(autoexecPath, 'utf-8');
    return parseAutoexec(content);
}

/**
 * Write autoexec atomically (P1 fix #8)
 * Uses write-to-temp-then-rename pattern to prevent corruption on crash
 */
export function writeAutoexec(gamePath: string, data: AutoexecData): void {
    const autoexecPath = getAutoexecPath(gamePath);
    const tempPath = `${autoexecPath}.tmp`;
    const cfgDir = path.dirname(autoexecPath);

    if (!fs.existsSync(cfgDir)) {
        fs.mkdirSync(cfgDir, { recursive: true });
    }

    const content = buildAutoexec(data);

    try {
        fs.writeFileSync(tempPath, content);
        fs.renameSync(tempPath, autoexecPath);
    } catch (error) {
        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch { /* ignore */ }
        throw error;
    }
}
