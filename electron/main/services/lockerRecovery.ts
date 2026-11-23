import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fingerprintFile } from './fileMatch';
import { isLockerVpkSlotFile, LOCKER_VPK_SLOTS } from './lockerVpkSlots';
import { getModMetadata, removeModMetadata, setModMetadata, type ModMetadata } from './metadata';
import { assertRecoveryPath, placeRecoveryFile, recoveryDirectory, retainRecoveryFile } from './recoveryBackup';
import { beginRecoveryMutation, journalRecoveryMetadata, journalRecoveryPaths, type RecoveryJournal } from './recoveryJournal';
import { assertVpkSafety } from './modSafety';

type LockerKey = keyof typeof LOCKER_VPK_SLOTS;
interface LockerSlot { files: Record<string, string>; metadata: ModMetadata | null }
export type LockerRecovery = Record<LockerKey, LockerSlot>;

const lockerKeys = Object.keys(LOCKER_VPK_SLOTS) as LockerKey[];
export const lockerRecoveryRoot = (gamePath: string) => join(gamePath, 'game', 'citadel', 'grimoire');

export function isLockerRecovery(value: unknown): value is LockerRecovery {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== lockerKeys.length) return false;
    const snapshot = value as LockerRecovery;
    return lockerKeys.every(key => {
        const slot = snapshot[key];
        return slot && slot.files && typeof slot.files === 'object' && !Array.isArray(slot.files) &&
            Object.entries(slot.files).every(([name, hash]) => isLockerVpkSlotFile(LOCKER_VPK_SLOTS[key], name) &&
                typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)) &&
            (slot.metadata === null || !!slot.metadata && typeof slot.metadata === 'object' && !Array.isArray(slot.metadata));
    });
}

export async function readLockerRecovery(gamePath: string, retain = false): Promise<LockerRecovery> {
    const root = lockerRecoveryRoot(gamePath);
    await assertRecoveryPath(root);
    const entries = await fs.readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
    });
    const slots = await Promise.all(lockerKeys.map(async key => {
        const files: LockerSlot['files'] = {};
        const names = entries.filter(entry => (entry.isFile() || entry.isSymbolicLink()) &&
            isLockerVpkSlotFile(LOCKER_VPK_SLOTS[key], entry.name)).map(entry => entry.name).sort();
        for (const name of names) {
            const path = join(root, name);
            await assertRecoveryPath(path);
            files[name] = retain ? await retainRecoveryFile(path) : (await fingerprintFile(path)).sha256;
        }
        const metadata = getModMetadata(key);
        return [key, { files, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) as ModMetadata : null }] as const;
    }));
    return Object.fromEntries(slots) as LockerRecovery;
}

export async function checkLockerRecovery(target: LockerRecovery, reviewed: LockerRecovery): Promise<void> {
    for (const key of lockerKeys) {
        const saved = target[key].files;
        if (JSON.stringify(saved) === JSON.stringify(reviewed[key].files)) continue;
        const directory = join(recoveryDirectory(), `locker-check-${randomUUID()}`);
        try {
            for (const [name, hash] of Object.entries(saved)) await placeRecoveryFile(hash, join(directory, name));
            const dirName = `${LOCKER_VPK_SLOTS[key]}_dir.vpk`;
            if (saved[dirName]) await assertVpkSafety(join(directory, dirName), { name: key });
        } finally { await fs.rm(directory, { recursive: true, force: true }); }
    }
}

export async function applyLockerRecovery(gamePath: string, target: LockerRecovery, reviewed: LockerRecovery, journal: RecoveryJournal): Promise<void> {
    if (JSON.stringify(await readLockerRecovery(gamePath)) !== JSON.stringify(reviewed)) throw new Error('Locker recovery review changed');
    const root = lockerRecoveryRoot(gamePath);
    for (const key of lockerKeys) {
        const before = reviewed[key];
        const after = target[key];
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const names = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
        const edits = [...names].filter(name => before.files[name] !== after.files[name]);
        await journalRecoveryPaths(journal, edits.map(name => ({ path: join(root, name), expectedBefore: before.files[name] ?? null, hash: after.files[name] })));
        await journalRecoveryMetadata(journal, [key]);
        await beginRecoveryMutation(journal);
        for (const name of edits) {
            const path = join(root, name);
            const validate = async () => {
                await assertRecoveryPath(path);
                const current = await fingerprintFile(path).then(file => file.sha256).catch((error: NodeJS.ErrnoException) => {
                    if (error.code === 'ENOENT') return undefined;
                    throw error;
                });
                if (current !== before.files[name]) throw new Error('Locker recovery file changed');
            };
            if (after.files[name]) await placeRecoveryFile(after.files[name], path, validate);
            else {
                await validate();
                await fs.unlink(path);
            }
        }
        removeModMetadata(key);
        if (after.metadata) setModMetadata(key, after.metadata);
    }
}
