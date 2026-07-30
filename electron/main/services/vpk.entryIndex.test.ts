import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseVpkEntryIndex } from './vpk';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function nul(value: string) { return Buffer.from(`${value}\0`); }

/** A minimal v1 directory VPK: one preload-backed entry and no archive reads. */
function fixtureVpk(): Buffer {
    const entry = Buffer.alloc(18);
    entry.writeUInt32LE(0xa1b2c3d4, 0); // CRC
    entry.writeUInt16LE(3, 4); // preload
    entry.writeUInt16LE(7, 6); // archive index
    entry.writeUInt32LE(0, 8);
    entry.writeUInt32LE(19, 12); // archive bytes
    const tree = Buffer.concat([nul('vsnd_c'), nul('sounds/hero/test'), nul('clip'), entry, Buffer.from('abc'), nul(''), nul(''), nul('')]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x55aa1234, 0);
    header.writeUInt32LE(1, 4);
    header.writeUInt32LE(tree.length, 8);
    return Buffer.concat([header, tree]);
}

describe('parseVpkEntryIndex', () => {
    it('surfaces CRC, logical size, and archive index without reading a chunk', () => {
        const root = mkdtempSync(join(tmpdir(), 'grimoire-vpk-index-'));
        roots.push(root);
        const path = join(root, 'pak01_dir.vpk');
        writeFileSync(path, fixtureVpk());
        expect(parseVpkEntryIndex(path)).toEqual([
            { path: 'sounds/hero/test/clip.vsnd_c', crc: 0xa1b2c3d4, size: 22, archiveIndex: 7 },
        ]);
    });
});
