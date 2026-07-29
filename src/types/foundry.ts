/**
 * Foundry tab wire types: the typed shapes returned by the `vpkmerge catalog *`
 * sidecar (run from the main process, see electron/main/services/foundryCatalog.ts)
 * and surfaced to the renderer over IPC. Imported into the single-source IPC
 * contract (src/types/electron.ts) via `import('./foundry')`.
 *
 * These mirror the JSON the catalog engine emits with `--json`; keep them in sync
 * with vpkmerge-core's `localization`/`texture_catalog` structs.
 */

/** One playable/in-development hero from `catalog heroes --json`. Codename is the
 *  engine name (e.g. `vampirebat`); `name` is the in-game display name (`Mina`). */
export interface HeroInfo {
    codename: string;
    name: string;
    selectable: boolean;
    inDevelopment: boolean;
    disabled: boolean;
}

/** Texture categories as classified by vpkmerge-core::texture_catalog from the
 *  entry path alone. The browse grid foundation surfaces only the bounded,
 *  visual-icon categories; `hero-model`/`ability-vfx`/`other` are large and
 *  deferred to later Foundry slices. */
export type TextureCategory =
    | 'ability-icon'
    | 'item-icon'
    /** Hero cards, portraits, and other hero-facing panorama images. */
    | 'hero-image'
    | 'hero-model'
    | 'ability-vfx'
    | 'other';

/** One texture entry from `catalog texture --json`. `path` is the verbatim
 *  swap/recolor target inside the pak; `label` is the filename rendered as prose
 *  (search key); `hero` is the codename when the path encodes one. */
export interface TextureEntry {
    path: string;
    category: TextureCategory;
    hero: string | null;
    label: string;
}

/** Filters accepted by `getTextures`; all optional and AND-combined by the CLI. */
export interface TextureFilters {
    category?: TextureCategory;
    hero?: string;
    search?: string;
    limit?: number;
}

/** A texture entry enriched (main-side) with a renderer-loadable thumbnail URL
 *  under the `grimoire-foundry:` scheme. `thumbUrl` is null when the texture
 *  failed to decode (the batch skips it rather than failing the whole category). */
export interface TextureGridItem extends TextureEntry {
    thumbUrl: string | null;
    /** Native pixel dimensions of the source texture (a swap-size hint), when known. */
    sourceWidth?: number;
    sourceHeight?: number;
}

/** One VO sound event from `catalog voiceline --json`. `label` is the event name
 *  turned to prose (the search key); `vsnd` lists the clip path(s) (>1 == a
 *  randomizer pool); `event` is the verbatim soundevents swap target. Deadlock
 *  ships no English subtitles for hero VO, so `caption` is almost always null. */
export interface VoiceLine {
    event: string;
    hero: string | null;
    label: string;
    vsnd: string[];
    duration: number;
    caption: string | null;
}

/** Filters accepted by `getVoicelines`; all optional and AND-combined by the CLI.
 *  The VO corpus is ~76K events, so the Sound tab always scopes by `hero`. */
export interface VoicelineFilters {
    hero?: string;
    search?: string;
    limit?: number;
}

/** Which family a hero gameplay sound belongs to, from `catalog herosounds`
 *  (derived engine-side from the soundevent name). The Sound tab leads with these
 *  gameplay sounds (weapon + abilities + movement + melee), with VO supplementary. */
export type HeroSoundCategory = 'weapon' | 'ability' | 'movement' | 'melee' | 'other';

/** One playable hero gameplay sound from `catalog herosounds --json`: the non-VO
 *  surface (abilities, gun, movement, melee). `hero` is the sound-path codename
 *  (the `soundevents/hero/<code>` stem, e.g. `abrams`, which can differ from the
 *  roster codename `atlas`). `ability` is the grouping name when `category` is
 *  `ability` (else null); `slot` is 1..4 when recoverable (else null). `label` is
 *  the event detail as prose (search key); `vsnd` lists the clip path(s) (>1 == a
 *  randomizer pool); `event` is the verbatim soundevents swap target. */
export interface HeroSound {
    event: string;
    hero: string;
    category: HeroSoundCategory;
    ability: string | null;
    slot: number | null;
    label: string;
    vsnd: string[];
    duration: number | null;
}

/** Filters accepted by `getHeroSounds`; all optional and AND-combined by the CLI.
 *  `hero` is the sound-path codename (resolved main-side from a roster codename). */
export interface HeroSoundFilters {
    hero?: string;
    category?: HeroSoundCategory;
    search?: string;
    limit?: number;
}

/** Which family a non-hero (global) sound belongs to, from `catalog globalsounds`.
 *  Derived engine-side from the event's *source file* rather than its name, since
 *  global event names follow no cross-file convention. */
export type GlobalSoundCategory =
    | 'ui'
    | 'music'
    | 'ambience'
    | 'npc'
    | 'item'
    | 'gameplay'
    | 'voice'
    | 'other';

/** One playable non-hero sound from `catalog globalsounds --json`: everything
 *  outside the hero and VO trees (UI, music, ambience, NPCs, shop items, match
 *  gameplay). `soundevents` is the `.vsndevts_c` entry the event lives in, which
 *  is what a swap passes back as `--soundevents` (there is no hero to infer it
 *  from); `source` is that path rendered short (`ui`, `npc/troopers`) and is the
 *  grouping key; `label` is the event name as prose (search key); `vsnd` lists the
 *  clip path(s) (>1 == a randomizer pool). */
export interface GlobalSound {
    event: string;
    soundevents: string;
    source: string;
    category: GlobalSoundCategory;
    label: string;
    vsnd: string[];
    duration: number | null;
}

/** Filters accepted by `getGlobalSounds`; all optional and AND-combined by the
 *  CLI. `source` matches as a prefix, so `npc` keeps the whole NPC tree. */
export interface GlobalSoundFilters {
    category?: GlobalSoundCategory;
    source?: string;
    search?: string;
    limit?: number;
}

/** A user-authored name or note for one catalog event and one clip path. */
export interface SoundAnnotation {
    /** Personal label; never replaces the catalog/base-game label. */
    name: string | null;
    note: string | null;
    /** Searchable personal key terms, stored without a required # prefix. */
    tags: string[];
    updatedAt: string;
}

export interface SoundAnnotationEntry {
    key: string;
    annotation: SoundAnnotation;
}

export interface SoundAnnotationsFile {
    version: 2;
    entries: Record<string, SoundAnnotation>;
}

/** One record in the thumbnail batch's `manifest.json` (path -> PNG file + dims). */
export interface ThumbManifestEntry {
    entry: string;
    file: string;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
    format: string;
}

/**
 * Request to bake a hero ability-VFX effect (recolor / prism / gradient / trippy)
 * into a standalone addon VPK and let the user save it to disk, instead of (or as
 * well as) applying it into the managed mod list. Mirrors the params the picker's
 * "Apply" path passes; the main process builds the same per-hero cache VPK the
 * apply flow uses, then opens a save dialog. `hue`/`saturation`/`brightness` are
 * ignored in `trippy` mode (kept neutral); `gradient` only applies in `gradient`
 * mode; `trippy` carries the procedural-paint choice for `trippy` mode.
 */
export interface HeroEffectExportRequest {
    heroName: string;
    mode: 'hue' | 'prism' | 'gradient' | 'trippy';
    hue: number;
    saturation: number;
    brightness: number;
    animated?: boolean;
    gradient?: string | null;
    trippy?: import('./mod').TrippyVfxChoice;
}

/** Outcome of a save-to-disk export: `exported` false means the user cancelled
 *  the save dialog; `path` is the file written when `exported` is true. */
export interface VpkExportResult {
    exported: boolean;
    path?: string;
}

/**
 * Request to swap a hero gameplay sound event's audio with a user-supplied MP3
 * and install the result as a managed local mod. `heroCodename` is the roster
 * codename from the Foundry hero picker (resolved main-side to the sound-path
 * codename); `heroName` is the display name (tagged as the mod's Locker hero);
 * `event` is the verbatim soundevent (a `HeroSound.event`); `audioPath` is the
 * dropped/picked MP3 on disk. v1 replaces every clip in the event's randomizer
 * pool (`--pool all`). `loop` defaults to `auto` (inherit the donor clip's flag).
 */
export interface HeroSoundSwapRequest {
    heroCodename: string;
    heroName: string;
    /** Global swap: the `.vsndevts_c` entry carrying `event` (a
     *  `GlobalSound.soundevents`, e.g. `soundevents/ui.vsndevts_c`). Set for
     *  non-hero sounds, where there is no hero to resolve the file from; it
     *  overrides `heroCodename` on the engine call, and the installed mod is
     *  left untagged rather than filed under a hero. */
    soundeventsEntry?: string;
    /** Gameplay swap: the soundevent name (event mode). Omit when using
     *  `clipPaths`. */
    event?: string;
    /** Voice-line swap: explicit clip entries to override in place (clip mode).
     *  VO has no per-hero soundevents file, so event mode does not apply. */
    clipPaths?: string[];
    audioPath: string;
    /** Exact clip-to-audio write set from the pool editor. When supplied it
     *  takes precedence over `audioPath` / event pool expansion, so selected,
     *  N-to-N, and seeded-library edits never accidentally affect another clip. */
    assignments?: Array<{ clipPath: string; audioPath: string }>;
    /** Pool editor intent, retained in managed provenance for re-forge. */
    poolMode?: 'replace-all' | 'selected-targets' | 'n-to-n' | 'seeded-library';
    /** Recorded only for seeded-library mode; permits a reproducible shuffle. */
    poolSeed?: number;
    name: string;
    loop?: 'auto' | 'on' | 'off';
    thumbnailDataUrl?: string;
    nsfw?: boolean;
    /** Optional trim window (ms) authored in the import editor; both ends set
     *  together, frame-snapped (~26 ms) by the minter. Omitted = whole clip. */
    trimStartMs?: number;
    trimEndMs?: number;
    /** Optional loudness gain (dB) from the "match volume" normalizer, applied
     *  losslessly before minting. Omitted / 0 = no change. */
    gainDb?: number;
    conflictResolution?: SoundConflictResolution;
}

/** Deliberate disposition of every VPK whose actual entry paths overlap. */
export interface SoundConflictResolution {
    action: 'cancel' | 'forge-above' | 'forge-below' | 'disable-conflicts' | 'replace-managed';
    conflictModIds: string[];
}

export interface FoundrySoundConflict {
    modId: string;
    modName: string;
    metaKey: string;
    enabled: boolean;
    priority: number;
    entries: string[];
    /** How this VPK arrived in the library. This is provenance only; it never
     * changes the expected load order. */
    provenance: 'Downloaded' | 'Imported' | 'Forged' | 'Third-party';
    managed: boolean;
    soundSwap?: import('./mod').SoundSwapInfo;
}

export interface FoundrySoundConflictInspection {
    writeSet: string[];
    conflicts: FoundrySoundConflict[];
    /** Expected enabled-VPK owner for each exact entry path. An absent mod id
     * means that no installed VPK owns the path, so the base-game asset wins. */
    expectedWinners: Array<{ entry: string; modId?: string; modName?: string; priority?: number }>;
    unreadableMods: Array<{ modId: string; modName: string; enabled: boolean }>;
}

export type FoundryAssetSourceProvenance = 'Downloaded' | 'Imported' | 'Forged' | 'Third-party';

/** Exact-directory ownership for a visual asset. Disabled contenders never win. */
export interface FoundryAssetSource {
    modId: string;
    modName: string;
    enabled: boolean;
    priority: number;
    provenance: FoundryAssetSourceProvenance;
    entries: string[];
    wins: string[];
    /** Grimoire minted or downloaded this VPK. A third-party VPK is opaque and
     *  is only ever layered over, never edited in place. */
    managed: boolean;
    /** Matched entries that can actually be extracted and played. */
    auditionable: string[];
}

export interface FoundryAssetSourcesInspection {
    paths: string[];
    sources: FoundryAssetSource[];
    winners: Record<string, string | null>;
    unreadableMods: Array<{
        modId: string;
        modName: string;
        enabled: boolean;
        /** The file's real type read from its magic bytes, as a human-readable
         *  noun phrase ("7-Zip archive", "ZIP archive"). Null or absent when
         *  the type could not be identified. */
        detectedType?: string | null;
    }>;
}

/** Request to replace one catalog texture with a user-selected PNG and install
 * the generated VPK as a managed local mod. */
export interface TextureReplacementRequest {
    entryPath: string;
    imagePath: string;
    name: string;
    category: TextureCategory;
    /** Hero display name from the catalog entry, when it had one. Retained for
     *  grouping and the Locker cross-link only: the entry path stays the sole
     *  ownership key. */
    heroName?: string;
    thumbnailDataUrl?: string;
}

/** A deferred Foundry edit. It contains the authoring input, not a generated
 * VPK, so reviewing or cancelling a tray never changes the mod library. */
export type FoundryForgeEdit =
    | { id: string; kind: 'sound'; precedence: number; request: HeroSoundSwapRequest }
    | { id: string; kind: 'texture'; precedence: number; request: TextureReplacementRequest };

/** The renderer repeats its reviewed result here. Main derives it again from
 * the requests and rejects stale/tampered confirmation rather than trusting a
 * displayed label or a client supplied VPK path. */
export interface FoundryForgeRequest {
    name: string;
    edits: FoundryForgeEdit[];
    confirmation: {
        writeSet: string[];
        collisionWinners: Array<{ file: string; editId: string }>;
    };
}

/** Which vpkmerge engine the app is actually running, for the Settings card.
 *  `bundled` is false when settings.vpkmergeBinaryPath overrides it. A non-null
 *  `error` with a non-null `path` means the binary resolved but would not run. */
export interface EngineInfo {
    path: string | null;
    version: string | null;
    bundled: boolean;
    error: string | null;
}

/** What the in-app browser's ad/tracker filter is doing, for the Settings card.
 *  `domains` counts blocklist entries (built-in plus any user list); `blocked`
 *  counts requests cancelled since launch; `error` reports an unreadable user
 *  list, which would otherwise fail silently and look like weak blocking. */
export interface BrowserFilterStats {
    domains: number;
    blocked: number;
    error: string | null;
}
