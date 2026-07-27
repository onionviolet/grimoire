// The two pieces of the browser filter that are pure logic and easy to get
// subtly wrong: parsing a user-supplied list, and deciding whether a host is
// covered. Both fail in the same silent direction (nothing gets blocked and the
// UI still says "blocking on"), which is why they are pinned.

import { describe, expect, it } from 'vitest';
import { isBlockedHost, parseBlocklist } from './browserContentFilter';

describe('parseBlocklist', () => {
    it('accepts a plain domain list', () => {
        expect(parseBlocklist('ads.example.com\ntracker.example.org')).toEqual([
            'ads.example.com',
            'tracker.example.org',
        ]);
    });

    it('accepts hosts-file syntax', () => {
        // The format most downloadable lists ship in.
        expect(parseBlocklist('0.0.0.0 ads.example.com\n127.0.0.1 t.example.org')).toEqual([
            'ads.example.com',
            't.example.org',
        ]);
    });

    it('drops comments, blank lines, and the localhost preamble', () => {
        const text = ['# My list', '', '127.0.0.1 localhost', '::1 localhost', 'ads.example.com'].join(
            '\n'
        );
        expect(parseBlocklist(text)).toEqual(['ads.example.com']);
    });

    it('strips trailing comments and lowercases', () => {
        expect(parseBlocklist('Ads.Example.COM # why')).toEqual(['ads.example.com']);
    });
});

describe('isBlockedHost', () => {
    const domains = new Set(['doubleclick.net', 'ads.example.com']);

    it('matches the domain itself', () => {
        expect(isBlockedHost('doubleclick.net', domains)).toBe(true);
    });

    it('matches any subdomain', () => {
        expect(isBlockedHost('stats.g.doubleclick.net', domains)).toBe(true);
    });

    it('does not match a parent of a listed subdomain', () => {
        // Listing `ads.example.com` must not take out `example.com` itself:
        // over-blocking a real site is worse than missing an ad.
        expect(isBlockedHost('example.com', domains)).toBe(false);
    });

    it('does not match a lookalike suffix', () => {
        // `notdoubleclick.net` shares a suffix textually but is a different
        // domain; a naive endsWith() check would block it.
        expect(isBlockedHost('notdoubleclick.net', domains)).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isBlockedHost('STATS.DoubleClick.NET', domains)).toBe(true);
    });
});
