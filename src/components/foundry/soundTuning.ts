import type { Mod } from '../../types/mod';

/**
 * Row-level derivation of the sound workbench state a change already carries.
 *
 * `SoundImportEditor` authors a trim window and a gain, and the forge persists
 * them on `soundSwap.reforge.trimStartMs / trimEndMs / gainDb`. Until now the
 * only place those numbers appeared was inside the editor itself, one modal deep
 * behind Swap, so a tuned change read exactly like an untuned one. Everything
 * here is pure so the row can say what was recorded without opening anything.
 *
 * Nothing in this module is an ownership signal: it describes what the user
 * authored, never which VPK wins a path.
 */

/** Loop handling recorded on the swap. */
export type SoundLoopMode = 'auto' | 'on' | 'off';

/** Narrowest trim window the editor's handles can produce, so a seeded window
 *  can never be narrower than one a drag could author. */
export const MIN_WINDOW_MS = 50;
/** Loudness clamp shared with the editor: a seed can never open the editor at a
 *  gain the slider itself could not reach. */
export const MAX_GAIN_DB = 18;

export interface SoundTuningState {
  /** A `reforge` block exists at all. Legacy swaps predate it and cannot be
   *  retuned or rebuilt, which is a different statement from "not tuned". */
  recorded: boolean;
  /** Trim window start in ms, only when it actually narrows the clip. */
  trimStartMs?: number;
  /** Trim window end in ms, only when it actually narrows the clip. */
  trimEndMs?: number;
  /** Authored gain in dB, only when it actually changes the level. */
  gainDb?: number;
  /** The clip was cut down: a start past zero, or an explicit end. */
  trimmed: boolean;
  /** The level was moved off unity. */
  gained: boolean;
  /** Loop handling, or null when the mod carries no sound swap. */
  loop: SoundLoopMode | null;
  /** Recorded, but with the whole clip at unity gain. */
  untouched: boolean;
  /** A retune can rebuild this change from what was recorded: it needs the
   *  recorded assignments (or clip paths) to write back to. */
  retunable: boolean;
}

/** Finite, real number or undefined. Guards against a JSON `null` or a NaN
 *  surviving into the persisted metadata. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** What the workbench recorded for this change. Safe on any mod: a mod with no
 *  sound swap reads as not recorded, not tuned, and not retunable. */
export function describeSoundTuning(mod: Mod): SoundTuningState {
  const swap = mod.soundSwap;
  const recorded = swap?.reforge;

  const rawStart = num(recorded?.trimStartMs);
  const rawEnd = num(recorded?.trimEndMs);
  const rawGain = num(recorded?.gainDb);

  // A zero start with no end is the whole clip: the minter's default, not an
  // edit. An end at or before the start cannot narrow anything either.
  const start = rawStart !== undefined && rawStart > 0 ? rawStart : undefined;
  const end = rawEnd !== undefined && rawEnd > 0 && rawEnd > (rawStart ?? 0) ? rawEnd : undefined;
  const gain = rawGain !== undefined && rawGain !== 0 ? rawGain : undefined;

  const trimmed = start !== undefined || end !== undefined;
  const gained = gain !== undefined;

  const assignments = recorded?.assignments ?? [];
  const clipPaths = recorded?.clipPaths ?? [];

  return {
    recorded: Boolean(recorded),
    trimStartMs: start,
    trimEndMs: end,
    gainDb: gain,
    trimmed,
    gained,
    loop: swap?.loop ?? null,
    untouched: Boolean(recorded) && !trimmed && !gained,
    retunable: Boolean(recorded?.audioPath) && (assignments.length > 0 || clipPaths.length > 0),
  };
}

/** Seconds with two decimals, matching the editor's own readout. */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Human trim window, or null when nothing was trimmed. Both ends, one end, or
 *  neither: the editor may author any of them. */
export function formatTrimWindow(state: SoundTuningState): string | null {
  const { trimStartMs, trimEndMs } = state;
  if (trimStartMs !== undefined && trimEndMs !== undefined) {
    return `${seconds(trimStartMs)} to ${seconds(trimEndMs)}`;
  }
  if (trimStartMs !== undefined) return `from ${seconds(trimStartMs)}`;
  if (trimEndMs !== undefined) return `to ${seconds(trimEndMs)}`;
  return null;
}

/** Signed gain to one decimal, or null when the level is unity. */
export function formatGain(state: SoundTuningState): string | null {
  if (state.gainDb === undefined) return null;
  const rounded = state.gainDb.toFixed(1);
  return `${state.gainDb > 0 ? '+' : ''}${rounded} dB`;
}

/* -------------------------------------------------------------------------
 * Seeding the editor
 *
 * A retune reopens `SoundImportEditor` on an existing change. Opening it on the
 * whole clip at unity gain would make a retune indistinguishable from a fresh
 * authoring, so the recorded numbers are handed to the editor as a seed. The
 * seed is authored against the file that was originally minted; the user may
 * pick a *different* file, whose duration bears no relation to it, so every
 * seeded window is fitted to the clip that was actually decoded.
 * ------------------------------------------------------------------------- */

/** What a caller asks the editor to open on. Every field optional: an absent
 *  field means "the editor's own default" (whole clip, unity gain). */
export interface SoundImportSeed {
  trimStartMs?: number;
  trimEndMs?: number;
  gainDb?: number;
  /** Carried for display only. The editor does not author loop mode; the
   *  rebuild reuses what was recorded, and saying so beats silence. */
  loop?: SoundLoopMode;
}

/**
 * How a seeded trim window survived contact with the decoded clip.
 *
 * - `none`: no window was seeded, so the editor opens on the whole clip.
 * - `exact`: the recorded window fits this clip untouched.
 * - `clamped`: one or both ends ran past this clip and were pulled to fit. The
 *   surviving window is still at least `MIN_WINDOW_MS` wide.
 * - `dropped`: nothing usable survived (the window starts at or past the end of
 *   this clip, or what remains is narrower than a handle drag could author), so
 *   the whole clip is selected instead. Deliberately not a zero-width or
 *   inverted selection: an invalid window is worse than an honest reset.
 */
export type SoundSeedFit = 'none' | 'exact' | 'clamped' | 'dropped';

export interface SeededSoundWindow {
  /** Trim start in ms, always inside the decoded clip. */
  startMs: number;
  /** Trim end in ms, always greater than `startMs` when the clip allows it. */
  endMs: number;
  /** Manual gain in dB the editor should open at, clamped to the slider range. */
  gainDb: number;
  /** Whether a trim window was asked for at all, before any fitting. */
  seededTrim: boolean;
  fit: SoundSeedFit;
}

/** The seed that reproduces what a change recorded. `undefined` when there is
 *  no recorded block at all: a legacy swap has nothing to seed from, and the
 *  editor must keep its own defaults rather than invent numbers. */
export function soundSeedFromTuning(state: SoundTuningState): SoundImportSeed | undefined {
  if (!state.recorded) return undefined;
  return {
    trimStartMs: state.trimStartMs,
    trimEndMs: state.trimEndMs,
    gainDb: state.gainDb,
    loop: state.loop ?? undefined,
  };
}

/** Clamp + round a seeded gain to what the editor's slider can hold. */
function clampGain(value: number | undefined): number {
  const raw = num(value);
  if (raw === undefined) return 0;
  const clamped = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, raw));
  return Math.round(clamped * 10) / 10;
}

/**
 * Fit a seed to a freshly decoded clip. Pure, total, and never returns an
 * invalid selection: `startMs <= endMs`, both inside `[0, durationMs]`.
 *
 * `durationMs` is the decoded clip length. A non-finite or non-positive
 * duration collapses to an empty clip, which drops any seeded window.
 */
export function seedTrimWindow(
  seed: SoundImportSeed | undefined,
  durationMs: number
): SeededSoundWindow {
  const full = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0;
  const gainDb = clampGain(seed?.gainDb);

  const rawStart = num(seed?.trimStartMs);
  const rawEnd = num(seed?.trimEndMs);
  const wantStart = rawStart !== undefined && rawStart > 0 ? rawStart : undefined;
  // An end at or past the whole clip narrows nothing, but it is still a
  // legitimate seed value; it is fitted below rather than discarded here.
  const wantEnd = rawEnd !== undefined && rawEnd > 0 ? rawEnd : undefined;
  const seededTrim = wantStart !== undefined || wantEnd !== undefined;

  if (!seededTrim) {
    return { startMs: 0, endMs: full, gainDb, seededTrim: false, fit: 'none' };
  }

  const start = Math.min(Math.max(0, wantStart ?? 0), full);
  const end = Math.min(Math.max(0, wantEnd ?? full), full);

  if (end - start < MIN_WINDOW_MS) {
    return { startMs: 0, endMs: full, gainDb, seededTrim: true, fit: 'dropped' };
  }

  const moved = start !== (wantStart ?? 0) || end !== (wantEnd ?? full);
  return { startMs: start, endMs: end, gainDb, seededTrim: true, fit: moved ? 'clamped' : 'exact' };
}

/** One badge the row renders. `kind` selects the label; `value` is the already
 *  formatted detail, absent for badges that are their own statement. */
export interface SoundTuningBadge {
  kind: 'trim' | 'gain' | 'loop' | 'untouched' | 'legacy';
  value?: string;
}

/**
 * The row's badge set, in reading order: what was cut, what was levelled, how it
 * loops, and otherwise an explicit "nothing was tuned" rather than silence.
 * `loop: 'auto'` is the default and says nothing, so it is not badged.
 */
export function soundTuningBadges(state: SoundTuningState): SoundTuningBadge[] {
  const badges: SoundTuningBadge[] = [];
  const trim = formatTrimWindow(state);
  if (trim) badges.push({ kind: 'trim', value: trim });
  const gain = formatGain(state);
  if (gain) badges.push({ kind: 'gain', value: gain });
  if (state.loop === 'on' || state.loop === 'off') badges.push({ kind: 'loop', value: state.loop });
  if (!state.recorded) badges.push({ kind: 'legacy' });
  else if (state.untouched && badges.length === 0) badges.push({ kind: 'untouched' });
  return badges;
}
