// Renderer-facing types for the Grimoire Social client surface. Wire-format
// types (ProfileSummary, LikeResponse, etc.) come from @grimoire/social-types
// — this file holds only the IPC-only shapes that don't cross the network.

import type { ProfileDetail, UserPublic } from '@grimoire/social-types';

/**
 * Forward-declaration of wire fields this fork's service may not serve.
 *
 * `mods_available`, `mods_revalidated_at`, `unavailable_mod_ids` and
 * `view_count` were added to the wire schema in the sibling repo
 * (`../grimoire-social/packages/social-types`, commit 5f870bd) along with the
 * revalidation cron and view counter that populate them. That work is not
 * published: the sibling's only remote is `Slush97/grimoire-social`, which this
 * fork does not own, and CI checks that repository out fresh.
 *
 * Grimoire deliberately points at the upstream deployment, which does not run
 * that cron. So these fields are expected to be ABSENT in practice, not merely
 * null, and every consumer must treat absent as "this service does not report
 * it" and render nothing. See resolveModsAvailability for that split.
 *
 * This is a widening of ProfileDetail with exactly the optional and nullable
 * shape the sibling declares, not a competing definition: the client must not
 * start believing something different about the wire format. It stops being
 * needed only if the sibling change becomes reachable from CI.
 */
export type ProfileDetailWithAvailability = ProfileDetail & {
    view_count?: number | null;
    unavailable_mod_ids?: number[] | null;
};

/** Whether the session token survives an app restart on this OS.
 *  - 'os-keychain': stored via safeStorage backed by a real keychain.
 *  - 'session-only': in-memory only (Linux without libsecret, per ADR-011).
 */
export type SocialPersistenceMode = 'os-keychain' | 'session-only';

export interface SocialSessionStatus {
    signedIn: boolean;
    user: UserPublic | null;
    persistenceMode: SocialPersistenceMode;
    /** Unix seconds when the session expires, or null when signed out. */
    expiresAt: number | null;
}
