// Renderer-facing types for the Grimoire Social client surface. Wire-format
// types (ProfileSummary, LikeResponse, etc.) come from @grimoire/social-types
// — this file holds only the IPC-only shapes that don't cross the network.

import type { ProfileDetail, UserPublic } from '@grimoire/social-types';

/**
 * TEMPORARY SHIM. Remove this and read the fields off ProfileDetail directly.
 *
 * `mods_available`, `mods_revalidated_at`, `unavailable_mod_ids` and
 * `view_count` were added to the wire schema in the sibling repo
 * (`../grimoire-social/packages/social-types`, commit 5f870bd). That commit is
 * not published: the sibling's only remote is `Slush97/grimoire-social`, which
 * this fork does not own, and CI checks that repository out fresh. So a local
 * build resolves the new fields through the on-disk link and a CI build does
 * not, which is exactly how these two reads passed review and still broke the
 * pipeline.
 *
 * This is deliberately a widening of ProfileDetail with the same optional and
 * nullable shape the sibling declares, not a competing definition: the client
 * must not start believing something different about the wire format. Delete it
 * the moment the sibling change is reachable from CI.
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
