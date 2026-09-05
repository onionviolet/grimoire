/**
 * Game-asset dressing for the Chat Wheel preview (Phase 11 spike).
 *
 * `backplateUrl` is a renderer-loadable URL served by the existing
 * `grimoire-foundry:` thumbnail protocol (the same decode path the Foundry
 * lightbox uses), never a filesystem path. `entryPath` names the pak entry it
 * was decoded from, so a later pass can pin or replace the heuristic.
 *
 * The resolver that produces this is deliberately allowed to answer null: the
 * pure-SVG wheel is the permanent fallback, not a provisional one.
 */
export interface ChatWheelDressing {
    backplateUrl: string;
    entryPath: string;
}
