import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Two-sided guard for the D-03 support-destination decision: every fork-owned
// support surface must point at this fork's own GitHub Issues tracker, while
// every attribution surface (which D-03 deliberately leaves upstream-owned)
// must still name upstream. An over-correction that strips attribution fails
// this test just as loudly as an under-correction that leaves a support
// surface pointed at upstream.
//
// NOTE: coverage here is intentionally incomplete after this task.
// SupportSection.tsx's two support-context anchors are added by the next
// task (Task 2), which extends this file rather than replacing it.

const REPO_ROOT = join(__dirname, '..', '..');

// Copied verbatim from electron/main/services/discordRpc.ts. This is the
// upstream project's own Discord invite; it is an attribution surface, not a
// support destination, so it must remain intact there and in README.md.
const UPSTREAM_DISCORD_INVITE = 'https://discord.gg/KgYGHEMq2P';

const FORK_ISSUES_URL = 'https://github.com/onionviolet/grimoire/issues';

function readSource(relativePath: string): string {
    return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

describe('support destination guard (D-03)', () => {
    it('does not send a user from the update modal to the upstream Discord', () => {
        const updateModal = readSource('src/components/UpdateModal.tsx');
        expect(updateModal).not.toContain(UPSTREAM_DISCORD_INVITE);
    });

    it('links the update modal footer to this fork\'s issue tracker', () => {
        const updateModal = readSource('src/components/UpdateModal.tsx');
        expect(updateModal).toContain(FORK_ISSUES_URL);
    });

    // Attribution surfaces D-03 deliberately leaves upstream-owned. An
    // over-correction that strips these while "fixing" support destinations
    // would misrepresent authorship, so this guard fails just as loudly for
    // that as for an under-correction.
    it('leaves the Discord Rich Presence attribution surface intact', () => {
        const discordRpc = readSource('electron/main/services/discordRpc.ts');
        expect(discordRpc).toContain(UPSTREAM_DISCORD_INVITE);
    });

    it('leaves the README credit line intact', () => {
        const readme = readSource('README.md');
        expect(readme).toContain(UPSTREAM_DISCORD_INVITE);
    });
});
