import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { app } from 'electron';
import type { SoundAnnotation, SoundAnnotationEntry, SoundAnnotationsFile } from '../../../src/types/foundry';

const FILE_VERSION = 1;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_KEY_LENGTH = 1_024;

function filePath(): string {
    return join(app.getPath('userData'), 'foundry-sound-annotations.json');
}

export function soundAnnotationKey(event: string, clipPath: string): string {
    return `${event}\u0000${clipPath}`;
}

function isValidKey(key: string): boolean {
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) return false;
    const separator = key.indexOf('\u0000');
    return separator > 0 && separator === key.lastIndexOf('\u0000') && separator < key.length - 1;
}

function emptyFile(): SoundAnnotationsFile {
    return { version: FILE_VERSION, entries: {} };
}

function readFile(): SoundAnnotationsFile {
    const path = filePath();
    if (!existsSync(path)) return emptyFile();

    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SoundAnnotationsFile>;
        if (parsed.version !== FILE_VERSION || !parsed.entries || typeof parsed.entries !== 'object') {
            return emptyFile();
        }
        return { version: FILE_VERSION, entries: normalizeEntries(parsed.entries) };
    } catch (error) {
        console.warn('[SoundAnnotations] Failed to read annotations, resetting:', error);
        return emptyFile();
    }
}

function normalizeEntries(value: unknown): Record<string, SoundAnnotation> {
    if (!value || typeof value !== 'object') return {};
    const entries: Record<string, SoundAnnotation> = {};
    for (const [key, candidate] of Object.entries(value)) {
        if (!isValidKey(key) || Object.keys(entries).length >= MAX_ENTRIES) continue;
        if (!candidate || typeof candidate !== 'object') continue;
        const item = candidate as Partial<SoundAnnotation>;
        const name = typeof item.name === 'string' ? item.name.trim().slice(0, 200) : '';
        const note = typeof item.note === 'string' ? item.note.trim().slice(0, 2000) : '';
        if (!name && !note) continue;
        const updatedAt = typeof item.updatedAt === 'string' && !Number.isNaN(Date.parse(item.updatedAt))
            ? item.updatedAt
            : new Date(0).toISOString();
        entries[key] = {
            name: name || null,
            note: note || null,
            updatedAt,
        };
    }
    return entries;
}

function writeFile(value: SoundAnnotationsFile): void {
    const path = filePath();
    const tempPath = `${path}.tmp`;
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    try {
        writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
        renameSync(tempPath, path);
    } catch (error) {
        try {
            if (existsSync(tempPath)) unlinkSync(tempPath);
        } catch {
            // Preserve the original write error.
        }
        throw error;
    }
}

export function listSoundAnnotations(): SoundAnnotationEntry[] {
    return Object.entries(readFile().entries).map(([key, annotation]) => ({ key, annotation }));
}

export function saveSoundAnnotation(
    key: string,
    annotation: Pick<SoundAnnotation, 'name' | 'note'>
): SoundAnnotationEntry | null {
    if (!isValidKey(key)) throw new Error('Invalid sound annotation key.');
    const data = readFile();
    const normalized = normalizeEntries({ [key]: { ...annotation, updatedAt: new Date().toISOString() } });
    if (!normalized[key]) {
        delete data.entries[key];
        writeFile(data);
        return null;
    }
    data.entries[key] = normalized[key];
    writeFile(data);
    return { key, annotation: data.entries[key] };
}

export function exportSoundAnnotations(): string {
    return JSON.stringify(readFile(), null, 2);
}

export function importSoundAnnotations(content: string): SoundAnnotationEntry[] {
    if (Buffer.byteLength(content, 'utf8') > MAX_IMPORT_BYTES) {
        throw new Error('Sound annotation file is too large.');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('Sound annotation file is not valid JSON.');
    }
    if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as Partial<SoundAnnotationsFile>).version !== FILE_VERSION ||
        !(parsed as Partial<SoundAnnotationsFile>).entries ||
        typeof (parsed as Partial<SoundAnnotationsFile>).entries !== 'object' ||
        Array.isArray((parsed as Partial<SoundAnnotationsFile>).entries)
    ) {
        throw new Error('Unsupported sound annotation file.');
    }
    const data = readFile();
    data.entries = { ...data.entries, ...normalizeEntries((parsed as Partial<SoundAnnotationsFile>).entries) };
    writeFile(data);
    return listSoundAnnotations();
}
