import { useEffect, useState } from 'react';
import { getChatWheelDressing } from '../../lib/api';
import type { AppSettings } from '../../types/mod';
import type { ChatWheelDressing } from '../../types/chatWheelDressing';

/** The four settings the gate reads; a partial so tests and the page's
 *  possibly-unloaded store both fit. */
export type DressingSettings = Partial<
    Pick<AppSettings, 'experimentalFoundry' | 'deadlockPath' | 'devMode' | 'devDeadlockPath'>
> | null | undefined;

/**
 * Whether dressing may even be asked for: the Foundry flag is on and a game
 * path is configured (the dev dummy path counts when dev mode is active, the
 * same rule `getActiveDeadlockPath` applies in main). Pure and exported so the
 * gate is testable without a render.
 */
export function chatWheelDressingEnabled(settings: DressingSettings): boolean {
    if (!settings?.experimentalFoundry) return false;
    const path = settings.devMode && settings.devDeadlockPath ? settings.devDeadlockPath : settings.deadlockPath;
    return typeof path === 'string' && path.trim() !== '';
}

/**
 * Resolve the game-asset dressing for the Chat Wheel preview, or null.
 *
 * Null is the steady state whenever the gate is closed, the main-process
 * resolver finds nothing, the decode fails, or the IPC call itself rejects:
 * every one of those means "draw the pure-SVG wheel unchanged". The hook
 * never surfaces an error, because there is nothing the user could do about
 * a missing backplate that the page should nag them for.
 */
export function useChatWheelDressing(settings: DressingSettings): ChatWheelDressing | null {
    const enabled = chatWheelDressingEnabled(settings);
    const [dressing, setDressing] = useState<ChatWheelDressing | null>(null);
    // Reset during render when the gate flips (React's "adjust state on prop
    // change" pattern), so a reopened gate never shows the previous answer
    // while the new one is in flight, and no effect calls setState directly.
    const [seenEnabled, setSeenEnabled] = useState(enabled);
    if (seenEnabled !== enabled) {
        setSeenEnabled(enabled);
        setDressing(null);
    }

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        void (async () => {
            let result: ChatWheelDressing | null = null;
            try {
                result = (await getChatWheelDressing()) ?? null;
            } catch {
                result = null;
            }
            if (!cancelled) setDressing(result);
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return enabled ? dressing : null;
}
