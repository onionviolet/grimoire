import type { FoundryPoolMember } from './poolView';

/**
 * What one pool member can be previewed *as*, derived from recorded provenance
 * only.
 *
 * This is the whole decision behind the alternatives gallery, kept pure and away
 * from React so it can be tested and so it cannot quietly grow a second opinion
 * about ownership. Two rules it obeys, both from the lane's contract:
 *
 *  - A preview describes the **source material** of a change, never its state.
 *    Nothing here reports or implies enabled/winning. Whether an alternative is
 *    live is answered by the pool card's winner resolution and by the mod store,
 *    and picking one goes through the same store toggle as everywhere else.
 *  - Only a recorded absolute path counts as an image source. A build keeps one
 *    in its re-forge request; a legacy `textureReplacement` recorded a basename
 *    only, so it has no derivable image and says so rather than guessing at a
 *    file with that name.
 */
export type AlternativePreview =
    /** Thumbnail the user's own source file at this absolute path. */
    | { kind: 'image'; sourcePath: string }
    /** The change recorded its own thumbnail at authoring time. Used only when
     *  no source path survives, so a legacy replacement is not left blank. */
    | { kind: 'recorded-thumbnail'; src: string }
    /** Audition what this member writes at an exact entry path. */
    | { kind: 'sound'; modId: string; entryPath: string }
    /** Nothing honest to show: fall back to the kind icon. */
    | null;

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A compiled sound entry. Used only to choose which of a member's recorded
 *  paths to audition, never to decide ownership. */
function looksLikeSoundEntry(path: string): boolean {
  return /\.vsnd(_c)?$/i.test(path) || path.toLowerCase().startsWith('sounds/');
}

/**
 * The absolute source-image path a visual member was built from, or null.
 *
 * Matched by recorded basename when the member has one, which is what keeps a
 * multi-part build from showing the wrong part's image; a build with exactly one
 * texture edit needs no disambiguation.
 */
export function memberSourceImagePath(member: FoundryPoolMember): string | null {
  const edits = member.mod.foundryBuild?.reforge?.edits ?? [];
  const textures = edits.filter(
    (edit): edit is Extract<typeof edit, { kind: 'texture' }> => edit.kind === 'texture',
  );
  if (textures.length === 0) return null;
  if (member.sourceFileName) {
    const matched = textures.find((edit) => baseName(edit.request.imagePath) === member.sourceFileName);
    if (matched) return matched.request.imagePath;
  }
  return textures.length === 1 ? textures[0].request.imagePath : null;
}

/** The entry path to audition for a sound member, or null when it recorded none. */
export function memberAuditionEntry(member: FoundryPoolMember): string | null {
  return member.entries.find(looksLikeSoundEntry) ?? member.entries[0] ?? null;
}

export function alternativePreviewFor(member: FoundryPoolMember): AlternativePreview {
  if (member.kind === 'sound') {
    const entryPath = memberAuditionEntry(member);
    return entryPath ? { kind: 'sound', modId: member.mod.id, entryPath } : null;
  }

  const sourcePath = memberSourceImagePath(member);
  if (sourcePath) return { kind: 'image', sourcePath };

  // Only a Foundry-authored change may fall back to its own recorded thumbnail.
  // A downloaded mod's `thumbnailUrl` is an uploader's promotional image and
  // would be a picture of something other than what this change writes.
  const authored = Boolean(member.mod.foundryBuild || member.mod.textureReplacement);
  if (authored && member.mod.thumbnailUrl) return { kind: 'recorded-thumbnail', src: member.mod.thumbnailUrl };
  return null;
}

/**
 * In-memory bound for resolved thumbnail URLs.
 *
 * The bytes are already bounded on the main-process side (see
 * `foundrySourceThumbs.ts`: 128px, 256 files / 32 MB). This second, much smaller
 * bound only stops a long browse session from holding an unbounded map of
 * strings in the renderer, and it is insertion-ordered so the oldest lookup is
 * the one dropped.
 */
export const PREVIEW_URL_CACHE_LIMIT = 128;

export function rememberPreviewUrl(
  cache: Map<string, string | null>,
  key: string,
  value: string | null,
  limit: number = PREVIEW_URL_CACHE_LIMIT,
): Map<string, string | null> {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  return cache;
}
