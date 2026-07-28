import { describe, expect, it } from 'vitest';
import { isValidSemver } from './version';

describe('isValidSemver', () => {
    it.each(['1.25.167', '1.25.167-beta.1', '1.25.167+build.42'])('accepts %s', (version) => {
        expect(isValidSemver(version)).toBe(true);
    });

    it.each(['1.25.1v67', 'v1.25.167', '1.25', '01.25.167'])('rejects %s', (version) => {
        expect(isValidSemver(version)).toBe(false);
    });
});
