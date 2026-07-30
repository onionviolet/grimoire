import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { diffVpkEntryIndexes, readBuildSnapshot, recordBuildSnapshot } from './foundryBuildSnapshots';

const roots: string[] = [];
const entry = (path: string, crc: number, size = 1) => ({ path, crc, size, archiveIndex: 0 });
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function root() { const value = mkdtempSync(join(tmpdir(), 'grimoire-snapshots-')); roots.push(value); return value; }

describe('Foundry build snapshots', () => {
    it('classifies CRC changes separately from size-only changes and preserves moves', () => {
        expect(diffVpkEntryIndexes(
            [entry('old.vsnd_c', 1), entry('changed.vtex_c', 2, 4), entry('resized.vmat_c', 3, 4)],
            [entry('new.vsnd_c', 1), entry('changed.vtex_c', 9, 4), entry('resized.vmat_c', 3, 8)],
        ).map(({ path, kind }) => ({ path, kind }))).toEqual([
            { path: 'changed.vtex_c', kind: 'changed' }, { path: 'new.vsnd_c', kind: 'added' },
            { path: 'old.vsnd_c', kind: 'removed' }, { path: 'resized.vmat_c', kind: 'resized-only' },
        ]);
    });

    it('records a baseline then diffs the next build and retains only three snapshots', async () => {
        const store = root();
        expect((await recordBuildSnapshot(store, 'one', [entry('a', 1)])).baseline).toBe(true);
        const second = await recordBuildSnapshot(store, 'two', [entry('a', 2), entry('b', 1)]);
        expect(second.changes.map((change) => change.kind)).toEqual(['changed', 'added']);
        await recordBuildSnapshot(store, 'three', [entry('a', 2)]);
        await recordBuildSnapshot(store, 'four', [entry('a', 2)]);
        expect(await readBuildSnapshot(store, 'one')).toBeNull();
        expect(await readBuildSnapshot(store, 'four')).toEqual([entry('a', 2)]);
    });
});
