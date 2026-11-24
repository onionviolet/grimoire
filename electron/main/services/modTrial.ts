import { setTimeout as delay } from 'node:timers/promises';
import { installedVariantGroupKey } from '../../../src/lib/localVariantEligibility';
import { isChatWheelAddon } from '../../../src/lib/chatWheelAddon';
import { scanMods, disableModUnlocked, enableModUnlocked, runExclusiveModMutation } from './mods';
import { isLaunchInFlight, probeDeadlockRunning, readStash } from './launch';
import { journalRecoveryMetadata, createRecoveryJournal, markModTrialLaunchRequested, readRecoveryJournal, withRecoveryMutationJournal } from './recoveryJournal';
import { recoverInterruptedUnlocked } from './profileRecovery';
import { assertVpkSafety } from './modSafety';
import { getActiveDeadlockPath, loadSettings } from './settings';
import { setModTrialWindow } from './vanillaWindow';
import { hasPendingGameLaunch } from './gameSessionMods';
import { shouldIgnoreFile } from './conflicts';
import { parseVpkDirectoriesAsync } from './vpk';
import { getModMetadata } from './metadata';

const LAUNCH_TIMEOUT = 60_000;
const POLL_DELAY = 2_000;
let pending = false;

function assertNoModTrialPending(): void {
    if (pending) throw new Error('Finish the one-launch mod trial first.');
}

export async function assertNoModTrial(gamePath: string): Promise<void> {
    assertNoModTrialPending();
    if ((await readRecoveryJournal(gamePath))?.modTrial) throw new Error('Restore the one-launch mod trial from Recovery first.');
    assertNoModTrialPending();
}

function endTrial(): void {
    setModTrialWindow(false);
    pending = false;
}

export async function reviewModTrial(gamePath: string, modId: string, replacedIds: string[]) {
    const mods = await scanMods(gamePath);
    const target = mods.find(mod => mod.id === modId && !mod.enabled);
    if (!target) throw new Error('The selected trial mod is no longer available.');
    const others = mods.filter(mod => {
        if (!mod.enabled || replacedIds.includes(mod.id)) return false;
        const meta = getModMetadata(mod.metaKey);
        return !meta?.lockerCosmetics && !meta?.lockerSounds;
    });
    const parsed = await parseVpkDirectoriesAsync([target.path, ...others.map(mod => mod.path)]);
    const files = parsed.get(target.path);
    if (!files) return null;
    const targetFiles = new Set(files.filter(file => !shouldIgnoreFile(file)));
    const names = others.filter(mod => parsed.get(mod.path)?.some(file => targetFiles.has(file))).map(mod => mod.name);
    return { names: names.slice(0, 5), total: names.length, incomplete: others.some(mod => !parsed.get(mod.path)) };
}

async function restoreTrial(gamePath: string): Promise<void> {
    await runExclusiveModMutation(async () => {
        if (!(await readRecoveryJournal(gamePath))?.modTrial) return;
        if (await probeDeadlockRunning() !== false) throw new Error('Close Deadlock before restoring the trial.');
        await recoverInterruptedUnlocked(gamePath);
    }, { exemptFromModTrial: true });
}

function monitorTrial(gamePath: string, requestedAt: number | null, notify: (restored: boolean) => void): void {
    void (async () => {
        let sawGame = false;
        let consecutiveClosed = 0;
        let unknownSince: number | null = null;
        for (;;) {
            const running = await probeDeadlockRunning();
            sawGame ||= running === true;
            consecutiveClosed = running === false ? consecutiveClosed + 1 : 0;
            unknownSince = running === null ? unknownSince ?? Date.now() : null;
            if (consecutiveClosed >= 2 && (sawGame || requestedAt === null || Date.now() >= requestedAt + LAUNCH_TIMEOUT)) break;
            if (unknownSince !== null && Date.now() >= unknownSince + LAUNCH_TIMEOUT) {
                throw new Error('Could not verify whether Deadlock has exited.');
            }
            await delay(POLL_DELAY, undefined, { ref: false });
        }
        await restoreTrial(gamePath);
    })().then(() => {
        endTrial();
        notify(true);
    }, error => {
        endTrial();
        console.error('[mod trial] Restore requires Recovery:', error);
        notify(false);
    });
}

export async function resumeModTrial(gamePath: string, notify: (restored: boolean) => void): Promise<void> {
    if (pending) return;
    const journal = await readRecoveryJournal(gamePath);
    if (!journal?.modTrial || pending) return;
    pending = true;
    setModTrialWindow(true);
    monitorTrial(gamePath, journal.modTrial.requestedAt, notify);
}

export async function launchModTrial(
    gamePath: string,
    modId: string,
    replaceIds: string[],
    launch: (markRequested: () => Promise<void>) => Promise<void>,
    notify: (restored: boolean) => void,
): Promise<void> {
    assertNoModTrialPending();
    pending = true;
    let ownsJournal = false;
    try {
        const journal = await runExclusiveModMutation(async () => {
            const checkLaunch = async () => {
                if (getActiveDeadlockPath() !== gamePath || isLaunchInFlight() || hasPendingGameLaunch()
                    || await readStash() || await probeDeadlockRunning() !== false) {
                    throw new Error('Close Deadlock and finish any other launch before trying a mod.');
                }
            };
            await checkLaunch();
            const mods = await scanMods(gamePath);
            const target = mods.find(mod => mod.id === modId && !mod.enabled);
            if (!target || target.merged || isChatWheelAddon(target)) throw new Error('This mod cannot be tried for one launch.');
            const group = installedVariantGroupKey(target);
            const outgoing = group ? mods.filter(mod => mod.enabled && installedVariantGroupKey(mod) === group) : [];
            if (outgoing.some(isChatWheelAddon)) throw new Error('An active chat wheel cannot be swapped in a trial.');
            if (replaceIds.length !== outgoing.length || outgoing.some(mod => !replaceIds.includes(mod.id))) {
                throw new Error('The selected variants changed. Review the trial again.');
            }
            await assertVpkSafety(target.path, { name: target.name });
            await checkLaunch();
            const journal = await createRecoveryJournal(gamePath, loadSettings().activeProfileId ?? null, { requestedAt: null });
            ownsJournal = true;
            setModTrialWindow(true);
            await journalRecoveryMetadata(journal, [target.metaKey, ...outgoing.map(mod => mod.metaKey)]);
            await withRecoveryMutationJournal(journal, async () => {
                for (const mod of outgoing) await disableModUnlocked(gamePath, mod.id);
                await enableModUnlocked(gamePath, target.id);
            });
            return journal;
        });
        await launch(async () => {
            if (await probeDeadlockRunning() !== false) throw new Error('Deadlock started before the trial could launch.');
            await markModTrialLaunchRequested(journal);
        });
        monitorTrial(gamePath, journal.modTrial!.requestedAt, notify);
    } catch (error) {
        if (ownsJournal) {
            try { await restoreTrial(gamePath); }
            catch (failure) {
                console.error('[mod trial] Failed to roll back launch:', failure);
                notify(false);
            }
        }
        endTrial();
        throw error;
    }
}
