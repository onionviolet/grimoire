/** Read-only pak build snapshots for Foundry's local patch comparison. */
import { promises as fs } from 'fs';
import { join } from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { VpkEntryIndex } from './vpk';

const compress = promisify(gzip);
const decompress = promisify(gunzip);
const RETAINED_SNAPSHOTS = 3;

export type FoundryBuildChangeKind = 'added' | 'removed' | 'changed' | 'resized-only';

export interface FoundryBuildChange {
    path: string;
    kind: FoundryBuildChangeKind;
    before?: VpkEntryIndex;
    after?: VpkEntryIndex;
}

export interface FoundryBuildSnapshotMeta {
    fingerprint: string;
    firstSeenAt: string;
    entryCount: number;
}

interface SnapshotIndex { snapshots: FoundryBuildSnapshotMeta[]; }

function snapshotPath(root: string, fingerprint: string): string {
    return join(root, `${fingerprint}.jsonl.gz`);
}

function indexPath(root: string): string { return join(root, 'index.json'); }

function sorted(entries: readonly VpkEntryIndex[]): VpkEntryIndex[] {
    return [...entries].sort((a, b) => a.path.localeCompare(b.path));
}

export function diffVpkEntryIndexes(before: readonly VpkEntryIndex[], after: readonly VpkEntryIndex[]): FoundryBuildChange[] {
    const oldEntries = new Map(before.map((entry) => [entry.path.toLowerCase(), entry]));
    const nextEntries = new Map(after.map((entry) => [entry.path.toLowerCase(), entry]));
    const changes: FoundryBuildChange[] = [];
    for (const [key, entry] of nextEntries) {
        const previous = oldEntries.get(key);
        if (!previous) changes.push({ path: entry.path, kind: 'added', after: entry });
        else if (previous.crc !== entry.crc) changes.push({ path: entry.path, kind: 'changed', before: previous, after: entry });
        else if (previous.size !== entry.size) changes.push({ path: entry.path, kind: 'resized-only', before: previous, after: entry });
    }
    for (const [key, entry] of oldEntries) {
        if (!nextEntries.has(key)) changes.push({ path: entry.path, kind: 'removed', before: entry });
    }
    return changes.sort((a, b) => a.path.localeCompare(b.path));
}

async function readIndex(root: string): Promise<SnapshotIndex> {
    try {
        const value = JSON.parse(await fs.readFile(indexPath(root), 'utf8')) as SnapshotIndex;
        return { snapshots: Array.isArray(value.snapshots) ? value.snapshots : [] };
    } catch { return { snapshots: [] }; }
}

export async function readBuildSnapshot(root: string, fingerprint: string): Promise<VpkEntryIndex[] | null> {
    try {
        const body = await decompress(await fs.readFile(snapshotPath(root, fingerprint)));
        return body.toString('utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as VpkEntryIndex);
    } catch { return null; }
}

/** Persist an observed build and compare it to the immediately prior build.
 * The pak is only read by the caller; this service writes exclusively below
 * userData and retains three compact gzip snapshots. */
export async function recordBuildSnapshot(root: string, fingerprint: string, entries: readonly VpkEntryIndex[]) {
    await fs.mkdir(root, { recursive: true });
    const index = await readIndex(root);
    const existing = index.snapshots.find((snapshot) => snapshot.fingerprint === fingerprint);
    if (existing) return { baseline: false, changes: [] as FoundryBuildChange[], snapshot: existing };

    const previous = index.snapshots.at(-1);
    const previousEntries = previous ? await readBuildSnapshot(root, previous.fingerprint) : null;
    const normalized = sorted(entries);
    const lines = normalized.map((entry) => JSON.stringify(entry)).join('\n');
    await fs.writeFile(snapshotPath(root, fingerprint), await compress(Buffer.from(lines)), { flag: 'wx' });
    const snapshot: FoundryBuildSnapshotMeta = { fingerprint, firstSeenAt: new Date().toISOString(), entryCount: normalized.length };
    index.snapshots.push(snapshot);
    while (index.snapshots.length > RETAINED_SNAPSHOTS) {
        const evicted = index.snapshots.shift();
        if (evicted) await fs.rm(snapshotPath(root, evicted.fingerprint), { force: true });
    }
    await fs.writeFile(indexPath(root), JSON.stringify(index, null, 2));
    return { baseline: !previousEntries, changes: previousEntries ? diffVpkEntryIndexes(previousEntries, normalized) : [], snapshot };
}
