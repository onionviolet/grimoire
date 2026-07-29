import { describe, it, expect } from 'vitest';
import { classifySocialError, cleanSocialErrorMessage } from './socialErrors';

/** How an IPC rejection actually reaches the renderer: Electron flattens the
 *  main-process error to `<name>: <message>` behind its own wrapper. */
function ipcError(name: string, message: string): Error {
    return new Error(`Error invoking remote method 'social:listProfiles': ${name}: ${message}`);
}

describe('cleanSocialErrorMessage', () => {
    it('strips the IPC wrapper and the serialized class name', () => {
        expect(cleanSocialErrorMessage(ipcError('SocialBusyError', 'internal error'))).toBe(
            'internal error'
        );
    });

    it('leaves a plain message alone', () => {
        expect(cleanSocialErrorMessage(new Error('not found'))).toBe('not found');
    });

    it('accepts a non-Error rejection', () => {
        expect(cleanSocialErrorMessage('boom')).toBe('boom');
    });
});

describe('classifySocialError', () => {
    it('calls everything offline when the machine reports no network', () => {
        // The browser's own signal wins: the request never had a chance.
        const result = classifySocialError(ipcError('SocialBusyError', 'internal error'), false);
        expect(result.kind).toBe('offline');
    });

    it('detects an unreachable service from the serialized class name', () => {
        const result = classifySocialError(
            ipcError('SocialOfflineError', 'Grimoire Social request failed: fetch failed'),
            true
        );
        expect(result.kind).toBe('offline');
    });

    it('detects a busy service (429 / 5xx) from the serialized class name', () => {
        const result = classifySocialError(ipcError('SocialBusyError', 'internal error'), true);
        expect(result.kind).toBe('busy');
        expect(result.message).toBe('internal error');
    });

    it('classifies on the error name when the class survives deserialization', () => {
        const err = new Error('over capacity');
        err.name = 'SocialBusyError';
        expect(classifySocialError(err, true).kind).toBe('busy');
    });

    it('leaves ordinary failures generic', () => {
        const result = classifySocialError(ipcError('SocialApiError', 'not found'), true);
        expect(result.kind).toBe('other');
        expect(result.message).toBe('not found');
    });

    it('does not treat an auth failure as a service problem', () => {
        const result = classifySocialError(
            ipcError('SocialUnauthenticatedError', 'Not signed in to Grimoire Social'),
            true
        );
        expect(result.kind).toBe('other');
    });
});
