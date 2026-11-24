import { afterEach, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { writeNativeVpk } from './nativeVpk';
import { parseVpkEntryIndex, readVpkEntryBytes } from './vpk';

vi.mock('./mods', () => ({ runExclusiveModMutation: async (run: () => Promise<unknown>) => run() }));
const { applyDisabledCompression } = await import('./disabledCompression');
let root: string | undefined;
afterEach(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });

it.skipIf(process.platform !== 'win32')('compresses and expands actual temporary NTFS VPKs without changing bytes or entry reads', async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'grimoire-compact-native-test-'));
    const parking = join(root, 'game/citadel/addons/.disabled');
    await fs.mkdir(parking, { recursive: true });
    const payload = Buffer.alloc(1024 * 1024, 'localization fixture\n');
    const bytes = writeNativeVpk(new Map([['resource/localization/test.txt', payload]]));
    const file = join(parking, 'test with spaces_dir.vpk');
    await fs.writeFile(file, bytes);
    const chunk = join(parking, 'test with spaces_000.vpk');
    const chunkBytes = Buffer.alloc(512 * 1024, 'chunk fixture');
    await fs.writeFile(chunk, chunkBytes);
    const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
    for (const mode of ['compress', 'expand'] as const) {
        expect(await applyDisabledCompression(root, mode)).toEqual({ processedFiles: 2, skippedFiles: 0, failedFiles: 0 });
        expect(hash(await fs.readFile(file))).toBe(hash(bytes));
        expect(hash(await fs.readFile(chunk))).toBe(hash(chunkBytes));
        expect(parseVpkEntryIndex(file)).toHaveLength(1);
        expect(readVpkEntryBytes(file, 'resource/localization/test.txt')).toEqual(payload);
        // Same-volume enabling remains an ordinary rename with readable bytes.
        const enabled = join(root, 'game/citadel/addons/pak99_dir.vpk');
        await fs.rename(file, enabled);
        expect(readVpkEntryBytes(enabled, 'resource/localization/test.txt')).toEqual(payload);
        await fs.rename(enabled, file);
    }
}, 60_000);
