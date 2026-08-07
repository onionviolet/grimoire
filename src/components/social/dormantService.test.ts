/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Guard for the two render gates that let this fork point at a dormant social
// service (one that never runs the revalidation cron or the view counter)
// without a client change. This fork's shipped installer bakes the upstream
// Worker URL into every build (D-01, ADR-018): that deployment does not run
// wave 3, so `mods_available`, `mods_revalidated_at`, `unavailable_mod_ids`,
// and `view_count` are absent from every response in practice, not merely
// null. `resolveModsAvailability` and this file's two source assertions are
// the reason a dormant service produces no permanent "not checked yet"
// badge and no empty view-count statistic: removing either gate is what
// would make a shipped surface advertise a check that will never run.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
    return readFileSync(join(REPO_ROOT, relativePath), 'utf-8');
}

describe('dormant service guard (D-01 / ADR-018)', () => {
    it('ModsAvailableBadge returns nothing for the unsupported branch, not a permanent badge', () => {
        const source = readSource('src/components/social/ModsAvailableBadge.tsx');
        // The unsupported early return must come before any badge markup is
        // produced, so a service that never reports availability renders no
        // badge at all rather than a "not checked yet" badge that never clears.
        expect(source).toContain("if (availability.kind === 'unsupported') return null;");
    });

    it('SocialProfileHeader gates the owner-only view count on the field being defined, not merely truthy', () => {
        const source = readSource('src/components/social/SocialProfileHeader.tsx');
        // `!== undefined`, not a truthiness check: a real zero must still
        // render, and only the field's absence (a dormant service) must
        // suppress the row. A truthy check would also hide a real zero,
        // which is a different bug this guard also catches.
        expect(source).toContain('isOwner && viewCount !== undefined');
        expect(source).not.toMatch(/isOwner\s*&&\s*viewCount\s*&&/);
    });
});
