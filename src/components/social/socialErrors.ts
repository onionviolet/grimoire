// Classifying a failed Grimoire Social call into something the UI can be
// honest about.
//
// Two failures deserve their own copy rather than the generic "something went
// wrong" banner:
//   - offline: there is no connection. Retrying now is pointless.
//   - busy:    the service answered 429/5xx. Retrying in a minute is the fix.
// Everything else stays generic.
//
// Errors reach the renderer as text: Electron serializes an IPC rejection down
// to `Error invoking remote method '<channel>': <name>: <message>`. The status
// code does not survive that trip, but the error NAME does, which is why
// electron/main/services/social.ts throws named SocialOfflineError /
// SocialBusyError subclasses instead of relying on a status check here.

export type SocialErrorKind = 'offline' | 'busy' | 'other';

export interface ClassifiedSocialError {
    kind: SocialErrorKind;
    /** The message to show for `kind === 'other'`, with Electron's IPC
     *  wrapper stripped. Offline and busy have their own translated copy and
     *  ignore this. */
    message: string;
}

// Same shape Settings.tsx and PerformanceConfigCard.tsx strip. Kept local
// rather than shared because those call sites are unrelated surfaces.
const IPC_WRAPPER = /^Error invoking remote method '[^']+': /;
const LEADING_ERROR_NAME = /^[A-Za-z]*Error: /;

function messageOf(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}

/** Strip the IPC wrapper and the serialized error-class prefix so the user
 *  sees the message the main process actually wrote. */
export function cleanSocialErrorMessage(err: unknown): string {
    return messageOf(err).replace(IPC_WRAPPER, '').replace(LEADING_ERROR_NAME, '').trim();
}

/**
 * Classify a rejected social call.
 *
 * `online` is injected rather than read from `navigator` so this stays pure
 * and testable. Callers pass `navigator.onLine`.
 *
 * The browser's own offline signal wins over everything: if the machine says
 * it has no network, the request never had a chance, whatever the service
 * would otherwise have said.
 */
export function classifySocialError(err: unknown, online: boolean): ClassifiedSocialError {
    const message = cleanSocialErrorMessage(err);
    if (!online) return { kind: 'offline', message };

    const raw = messageOf(err);
    const name = err instanceof Error ? err.name : '';
    // Match on the raw string as well as the name: the class survives the IPC
    // hop inside the message text, not as the deserialized error's name.
    if (name === 'SocialOfflineError' || raw.includes('SocialOfflineError')) {
        return { kind: 'offline', message };
    }
    if (name === 'SocialBusyError' || raw.includes('SocialBusyError')) {
        return { kind: 'busy', message };
    }
    return { kind: 'other', message };
}
