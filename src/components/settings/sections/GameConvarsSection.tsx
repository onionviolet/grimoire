import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Badge, Button, Toggle } from '../../common/ui';
import { Select } from '../../common/forms';
import OutOfRangeDialog from '../../performance/OutOfRangeDialog';
import {
  clearPerformanceConvars,
  getPerformanceConfigStatus,
  setPerformanceAdvancedConvars,
  setPerformanceHudConvars,
} from '../../../lib/api';
import type {
  PerformanceConfigStatus,
  PerformanceConvarOrigin,
  PerformanceConvarState,
} from '../../../types/electron';

/**
 * The HUD and gameplay ConVars Grimoire writes into gameinfo.gi.
 *
 * These lived inside the Performance Config card, which filed "how should
 * health bars look" under frame rate and inherited that card's experimental
 * flag along the way. They are standing game preferences, so they belong with
 * the rest of the game setup and are not gated on the preset feature. Issue #18.
 *
 * The values themselves are stored in the main process against gameinfo.gi
 * (see performanceConfig.ts), independently of whether a performance preset is
 * applied at all.
 */

/** Boolean toggles. `on` is the value the game reads when the control is
 *  switched on, so it is not always 'true': the offscreen indicator ConVar is a
 *  *disable* flag. `requires` names a control this one has no effect without,
 *  which is rendered as a disabled state rather than left in prose. Mirrors
 *  HUD_CONVARS in performanceUserControls.ts. */
const HUD_CONTROLS = [
  { key: 'citadel_unit_status_use_v2', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_use_new', on: 'true', off: 'false' },
  {
    key: 'citadel_unit_status_use_v2_for_nonplayers',
    on: 'true',
    off: 'false',
    requires: 'citadel_unit_status_use_v2',
  },
  { key: 'citadel_unit_status_single_bar_mode', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_allies_see_thru_walls', on: 'true', off: 'false' },
  { key: 'citadel_damage_offscreen_indicator_disabled', on: 'false', off: 'true' },
  { key: 'citadel_damage_text_show_effectiveness', on: '1', off: '0' },
] as const;

/** Numeric ConVars whose values are levels with names, not a magnitude. A
 *  slider over three stops technically reaches all of them, but "1" on a track
 *  says nothing; the level names do. */
const LEVEL_CONTROLS = [
  { key: 'citadel_hud_objective_health_enabled', values: ['0', '1', '2'] },
] as const;

// Slider bounds only. The *default* for each of these lives in
// ADVANCED_GAMEINFO_CONVARS (main process) and reaches the UI through
// status.convarStates[key].gameDefault: a renderer-side default number gets
// drawn as if the game had chosen it, which is precisely the confusion the
// value-state badge exists to remove. Keep min/max/step in sync with the main
// table; the main process refuses anything outside them anyway.
const ADVANCED_CONTROLS = [
  {
    key: 'citadel_unit_status_allies_see_thru_walls_max_distance',
    min: 0,
    max: 200,
    step: 5,
    requires: 'citadel_unit_status_allies_see_thru_walls',
  },
  { key: 'citadel_minimap_unit_click_radius', min: 400, max: 1200, step: 25 },
  { key: 'citadel_minimap_player_width', min: 4, max: 12, step: 0.5 },
  { key: 'citadel_minimap_local_player_width', min: 6, max: 16, step: 0.5 },
  { key: 'citadel_minimap_max_icon_shrink', min: 0.4, max: 1, step: 0.05 },
  { key: 'citadel_minimap_overlap_scan_distance', min: 0, max: 40, step: 1 },
  { key: 'citadel_minimap_zip_line_thickness', min: 1, max: 8, step: 0.5 },
  { key: 'minimap_update_rate_hz', min: 5, max: 60, step: 5 },
] as const;

/** An edit that has not been written to gameinfo.gi yet. 'clear' means "remove
 *  Grimoire's line for this key", never "write the default value back". */
type PendingEdit = { kind: 'set'; value: string } | { kind: 'clear' };

const VALUE_STATE_SLUG: Record<PerformanceConvarOrigin, string> = {
  'game-default': 'gameDefault',
  'managed-preset': 'managedPreset',
  'user-override': 'userOverride',
  unsupported: 'unsupported',
};

function controlLabel(key: string, t: TFunction): string {
  return HUD_CONTROLS.some((control) => control.key === key)
    ? t(`settings.gameConvars.controls.${key}.label`)
    : t(`settings.gameConvars.advanced.${key}`);
}

/** Where this control's current value came from. Out of range wins over the
 *  origin: it is the state that blocks an edit, so it is the one to read first. */
function ValueStateBadge({
  state,
  min,
  max,
}: {
  state: PerformanceConvarState;
  min?: number;
  max?: number;
}) {
  const { t } = useTranslation();
  const outOfRange = state.outOfRange === true;
  const slug = outOfRange ? 'outOfRange' : VALUE_STATE_SLUG[state.origin];
  const hint = outOfRange
    ? t('settings.gameConvars.valueStateHint.outOfRange', { value: state.value ?? '', min, max })
    : t(`settings.gameConvars.valueStateHint.${slug}`);
  const variant =
    outOfRange || state.origin === 'unsupported'
      ? 'warning'
      : state.origin === 'managed-preset'
        ? 'info'
        : state.origin === 'user-override'
          ? 'success'
          : 'neutral';
  return (
    <Badge variant={variant} className="shrink-0">
      <span title={hint}>{t(`settings.gameConvars.valueState.${slug}`)}</span>
    </Badge>
  );
}

function ResetControlButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t('settings.gameConvars.resetHint')}
      aria-label={t('common.actions.reset')}
      className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
    >
      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  );
}

/**
 * One control, as a bounded cell.
 *
 * The boundary is load-bearing, not decoration. These rows sit in a two-column
 * grid, and without it the left column's badge and reset button land directly
 * beside the right column's toggle: a green "Your override" chip in the middle
 * of the row genuinely does not say which control it belongs to.
 */
function ControlCell({
  label,
  badge,
  reset,
  control,
  children,
}: {
  label: React.ReactNode;
  badge?: React.ReactNode;
  reset?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {control}
          <span className="block min-w-0 text-sm font-medium text-text-primary">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {badge}
          {reset}
        </div>
      </div>
      {children}
    </div>
  );
}

/** A caveat that is a state of the control, not a sentence about it. */
function ControlNotice({ tone, children }: { tone: 'warning' | 'muted'; children: React.ReactNode }) {
  if (tone === 'muted') {
    return <p className="mt-1.5 text-[11px] text-text-secondary/70">{children}</p>;
  }
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-state-warning/90">
      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default function GameConvarsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PerformanceConfigStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingEdit>>({});
  const [approvedOutOfRange, setApprovedOutOfRange] = useState<string[]>([]);
  const [outOfRangePrompt, setOutOfRangePrompt] = useState<{ key: string; next: string } | null>(null);
  // Result of the last reset, which is the one action that can legitimately do
  // nothing (no Grimoire line to remove). Reported verbatim.
  const [actionNote, setActionNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getPerformanceConfigStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-check on focus so an edit made in an external editor, or on the Autoexec
  // page, shows up without a restart.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // What gameinfo.gi holds for a key right now, independent of anything staged.
  const fileValueOf = (key: string): string | null => {
    const state = status?.convarStates?.[key];
    if (state) return state.value;
    const legacy = status?.convarValues?.[key];
    return legacy === undefined ? null : legacy;
  };

  /** The value that would be in effect if the staged edits were applied. */
  const effectiveValueOf = (key: string): string | null => {
    const edit = pending[key];
    if (!edit) return fileValueOf(key);
    return edit.kind === 'clear' ? null : edit.value;
  };

  const stageEdit = (key: string, edit: PendingEdit | null) => {
    setActionNote(null);
    setPending((prev) => {
      const next = { ...prev };
      const isNoop =
        edit === null ||
        (edit.kind === 'set' && edit.value === fileValueOf(key)) ||
        (edit.kind === 'clear' && fileValueOf(key) === null);
      if (isNoop) delete next[key];
      else next[key] = edit;
      return next;
    });
  };

  const discardPending = () => {
    setPending({});
    setApprovedOutOfRange([]);
    setOutOfRangePrompt(null);
  };

  const applyPending = async (approved: string[] = approvedOutOfRange) => {
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    // Replacing a value the file holds outside this control's range takes an
    // explicit yes. Grimoire will not clamp somebody's deliberate number.
    const needsConfirm = entries.find(
      ([key, edit]) =>
        edit.kind === 'set' &&
        status?.convarStates?.[key]?.outOfRange === true &&
        !approved.includes(key)
    );
    if (needsConfirm) {
      const edit = needsConfirm[1];
      setOutOfRangePrompt({ key: needsConfirm[0], next: edit.kind === 'set' ? edit.value : '' });
      return;
    }

    const hud: Record<string, boolean> = {};
    const numeric: Record<string, number> = {};
    const clears: string[] = [];
    for (const [key, edit] of entries) {
      if (edit.kind === 'clear') {
        clears.push(key);
        continue;
      }
      const hudControl = HUD_CONTROLS.find((control) => control.key === key);
      if (hudControl) hud[key] = edit.value === hudControl.on;
      else numeric[key] = Number(edit.value);
    }

    setBusy(true);
    setActionNote(null);
    try {
      let next: PerformanceConfigStatus | null = null;
      if (clears.length) {
        next = await clearPerformanceConvars(clears);
        if (next.state !== 'error') setActionNote(next.message);
      }
      if (next?.state !== 'error' && Object.keys(hud).length) {
        next = await setPerformanceHudConvars(hud);
      }
      if (next?.state !== 'error' && Object.keys(numeric).length) {
        next = await setPerformanceAdvancedConvars(numeric);
      }
      if (next) setStatus(next);
      // A failed write keeps the staged edits on screen: losing them would hide
      // what did not land.
      if (!next || next.state !== 'error') {
        setPending({});
        setApprovedOutOfRange([]);
      }
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const confirmOutOfRange = () => {
    const key = outOfRangePrompt?.key;
    if (!key) return;
    const approved = approvedOutOfRange.includes(key)
      ? approvedOutOfRange
      : [...approvedOutOfRange, key];
    setApprovedOutOfRange(approved);
    setOutOfRangePrompt(null);
    void applyPending(approved);
  };

  const resetFromOutOfRange = () => {
    const key = outOfRangePrompt?.key;
    if (!key) return;
    setOutOfRangePrompt(null);
    setPending((prev) => ({ ...prev, [key]: { kind: 'clear' } }));
  };

  // No provenance means the file could not be inspected (no ConVars section, or
  // an older status shape). Badges and per-control resets are hidden rather than
  // guessed at, and the numeric controls fall back to plain value editing.
  const canInspect = !!status?.convarStates;
  const failed = status?.state === 'error';

  const pendingRows = Object.keys(pending).map((key) => {
    const edit = pending[key];
    const label = controlLabel(key, t);
    const from = fileValueOf(key);
    const to = edit.kind === 'clear' ? null : edit.value;
    if (to === null) return { key, text: t('settings.gameConvars.pending.rowToDefault', { control: label, from }) };
    if (from === null) return { key, text: t('settings.gameConvars.pending.rowFromDefault', { control: label, to }) };
    return { key, text: t('settings.gameConvars.pending.row', { control: label, from, to }) };
  });

  const promptControl = outOfRangePrompt
    ? ADVANCED_CONTROLS.find((control) => control.key === outOfRangePrompt.key)
    : undefined;

  /** The autoexec.cfg line that beats this control, if there is one. */
  const conflictFor = (key: string) => status?.autoexecConflicts?.[key];

  /** Rendered under a control whose ConVar autoexec.cfg also sets. autoexec runs
   *  after gameinfo.gi, so that line wins and this control cannot. */
  const AutoexecConflict = ({ convarKey }: { convarKey: string }) => {
    const conflict = conflictFor(convarKey);
    if (!conflict) return null;
    return (
      <ControlNotice tone="warning">
        {t('settings.gameConvars.autoexecConflict', {
          value: conflict.value,
          line: conflict.line,
        })}{' '}
        {conflict.managed && (
          <button
            type="button"
            onClick={() => navigate('/autoexec')}
            className="underline hover:text-state-warning cursor-pointer"
          >
            {t('settings.gameConvars.autoexecOpen')}
          </button>
        )}
      </ControlNotice>
    );
  };

  /** Rendered under a control that does nothing while its parent is off. */
  const Dependency = ({ requires }: { requires: string }) => {
    const parent = HUD_CONTROLS.find((control) => control.key === requires);
    if (!parent) return null;
    if (effectiveValueOf(requires) === parent.on) return null;
    return (
      <ControlNotice tone="muted">
        {t('settings.gameConvars.requiresOff', { control: controlLabel(requires, t) })}
      </ControlNotice>
    );
  };

  /** True when `requires` is off, so the control is inert and reads disabled. */
  const isInert = (requires?: string) => {
    if (!requires) return false;
    const parent = HUD_CONTROLS.find((control) => control.key === requires);
    return !!parent && effectiveValueOf(requires) !== parent.on;
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-text-primary">
          {t('settings.gameConvars.title')}
        </h4>
        <p className="mt-1 text-xs text-text-secondary max-w-2xl">
          {t('settings.gameConvars.description')}
        </p>
        {actionNote && <p className="mt-1 text-xs text-text-secondary/80">{actionNote}</p>}
        {failed && <p className="mt-1 text-xs text-state-danger">{status?.message}</p>}
      </div>

      {pendingRows.length > 0 && (
        <div className="rounded-sm border border-state-warning/25 bg-state-warning/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-state-warning">
                {t('settings.gameConvars.pending.title')}
              </p>
              <p className="text-xs text-text-secondary">
                {t('settings.gameConvars.pending.summary', { count: pendingRows.length })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={discardPending} disabled={busy} variant="ghost" size="sm">
                {t('settings.gameConvars.pending.discard')}
              </Button>
              <Button onClick={() => void applyPending()} isLoading={busy} size="sm">
                {t('settings.gameConvars.pending.apply')}
              </Button>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5">
            {pendingRows.map((row) => (
              <li key={row.key} className="font-mono text-xs text-text-secondary">
                {row.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {HUD_CONTROLS.map((control) => {
          const state = status?.convarStates?.[control.key];
          const edit = pending[control.key];
          const effective = effectiveValueOf(control.key);
          const unsupported = state?.origin === 'unsupported' && !edit;
          const requires = 'requires' in control ? control.requires : undefined;
          const inert = isInert(requires);
          return (
            <ControlCell
              key={control.key}
              label={t(`settings.gameConvars.controls.${control.key}.label`)}
              control={
                <Toggle
                  checked={effective === control.on}
                  onChange={(enabled) =>
                    stageEdit(control.key, {
                      kind: 'set',
                      value: enabled ? control.on : control.off,
                    })
                  }
                  disabled={busy || !status || unsupported || inert}
                />
              }
              badge={state && <ValueStateBadge state={state} />}
              reset={
                state && (
                  <ResetControlButton
                    onClick={() => stageEdit(control.key, { kind: 'clear' })}
                    disabled={
                      busy ||
                      !canInspect ||
                      edit?.kind === 'clear' ||
                      (state.origin === 'game-default' && !edit)
                    }
                  />
                )
              }
            >
              <p className="mt-1.5 text-xs text-text-secondary">
                {t(`settings.gameConvars.controls.${control.key}.description`)}
              </p>
              {unsupported && (
                <ControlNotice tone="warning">
                  {t('settings.gameConvars.valueStateHint.unsupported')}
                </ControlNotice>
              )}
              {requires && <Dependency requires={requires} />}
              <AutoexecConflict convarKey={control.key} />
            </ControlCell>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {LEVEL_CONTROLS.map((control) => {
          const state = status?.convarStates?.[control.key];
          const edit = pending[control.key];
          const effective = effectiveValueOf(control.key);
          // Every level is a supported value now, so an unset key shows as the
          // game default rather than as a level the user chose.
          const selected = effective === null ? '' : effective;
          return (
            <ControlCell
              key={control.key}
              label={t(`settings.gameConvars.advanced.${control.key}`)}
              badge={state && <ValueStateBadge state={state} />}
              reset={
                state && (
                  <ResetControlButton
                    onClick={() => stageEdit(control.key, { kind: 'clear' })}
                    disabled={
                      busy ||
                      !canInspect ||
                      edit?.kind === 'clear' ||
                      (state.origin === 'game-default' && !edit)
                    }
                  />
                )
              }
            >
              <div className="mt-2">
                <Select
                  inputSize="sm"
                  aria-label={t(`settings.gameConvars.advanced.${control.key}`)}
                  value={selected}
                  disabled={busy || !status}
                  onChange={(event) =>
                    stageEdit(
                      control.key,
                      event.target.value === ''
                        ? { kind: 'clear' }
                        : { kind: 'set', value: event.target.value }
                    )
                  }
                >
                  <option value="">{t('settings.gameConvars.levels.unset')}</option>
                  {control.values.map((level) => (
                    <option key={level} value={level}>
                      {t(`settings.gameConvars.levels.${control.key}.${level}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">
                {t(`settings.gameConvars.levelDescription.${control.key}`)}
              </p>
              <AutoexecConflict convarKey={control.key} />
            </ControlCell>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {ADVANCED_CONTROLS.map((control) => {
          const state = status?.convarStates?.[control.key];
          const edit = pending[control.key];
          const fileValue = fileValueOf(control.key);
          const label = t(`settings.gameConvars.advanced.${control.key}`);
          const gameDefault = state?.gameDefault ?? null;
          const defaultNum =
            gameDefault !== null && Number.isFinite(Number(gameDefault))
              ? Number(gameDefault)
              : control.min;
          const fileNum =
            fileValue !== null && fileValue.trim() !== '' && Number.isFinite(Number(fileValue))
              ? Number(fileValue)
              : null;
          const outOfRange = state?.outOfRange === true && !edit;
          const unsupported = state?.origin === 'unsupported' && !edit;
          const showingDefault = edit?.kind === 'clear' || (!edit && fileValue === null);
          const requires = 'requires' in control ? control.requires : undefined;
          const inert = isInert(requires);
          // The thumb parks on the known default for values we cannot place
          // (out of range, uninterpretable). The readout still shows what
          // gameinfo.gi actually holds, so the position is never mistaken for
          // the value.
          const sliderValue =
            edit?.kind === 'set'
              ? Number(edit.value)
              : showingDefault || fileNum === null || outOfRange
                ? defaultNum
                : fileNum;
          const readout =
            edit?.kind === 'set'
              ? edit.value
              : showingDefault || fileValue === null
                ? String(defaultNum)
                : fileValue;
          const readoutClass = edit
            ? 'text-accent'
            : outOfRange || unsupported
              ? 'text-state-warning'
              : 'text-text-primary';
          return (
            <ControlCell
              key={control.key}
              label={
                <label htmlFor={`convar-${control.key}`} className="block min-w-0">
                  {label}
                </label>
              }
              badge={
                <>
                  <span className={`font-mono text-xs ${readoutClass}`}>{readout}</span>
                  {state && <ValueStateBadge state={state} min={control.min} max={control.max} />}
                </>
              }
              reset={
                state && (
                  <ResetControlButton
                    onClick={() => stageEdit(control.key, { kind: 'clear' })}
                    disabled={
                      busy ||
                      !canInspect ||
                      edit?.kind === 'clear' ||
                      (state.origin === 'game-default' && !edit)
                    }
                  />
                )
              }
            >
              <input
                id={`convar-${control.key}`}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={sliderValue}
                onChange={(event) =>
                  stageEdit(control.key, { kind: 'set', value: event.target.value })
                }
                disabled={busy || !status || unsupported || inert}
                className="mt-2 w-full accent-accent"
                aria-label={label}
              />
              {(outOfRange || unsupported) && (
                <ControlNotice tone="warning">
                  {outOfRange
                    ? t('settings.gameConvars.valueStateHint.outOfRange', {
                        value: state?.value ?? '',
                        min: control.min,
                        max: control.max,
                      })
                    : t('settings.gameConvars.valueStateHint.unsupported')}
                </ControlNotice>
              )}
              {!outOfRange && !unsupported && showingDefault && (
                <ControlNotice tone="muted">
                  {t('settings.gameConvars.usingGameDefault')}
                </ControlNotice>
              )}
              {requires && <Dependency requires={requires} />}
              <AutoexecConflict convarKey={control.key} />
            </ControlCell>
          );
        })}
      </div>

      {outOfRangePrompt && promptControl && (
        <OutOfRangeDialog
          controlLabel={controlLabel(outOfRangePrompt.key, t)}
          current={status?.convarStates?.[outOfRangePrompt.key]?.value ?? ''}
          min={promptControl.min}
          max={promptControl.max}
          next={outOfRangePrompt.next}
          onConfirm={confirmOutOfRange}
          onResetToDefault={resetFromOutOfRange}
          onCancel={() => setOutOfRangePrompt(null)}
        />
      )}
    </div>
  );
}
