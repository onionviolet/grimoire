import { useCallback, useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { Gauge, ExternalLink, RefreshCw, RotateCcw, Settings2, SquarePen } from 'lucide-react';
import { Card, Badge, Button, Toggle } from '../common/ui';
import EditorPickerModal from './EditorPickerModal';
import OutOfRangeDialog from './OutOfRangeDialog';
import { useAppStore, type BrowseArtistRef } from '../../stores/appStore';
import {
  applyPerformanceConfig,
  clearPerformanceConvars,
  getPerformanceConfigStatus,
  openPerformanceConfigFile,
  removePerformanceConfig,
  resetPerformanceConfigOverrides,
  restorePerformanceConfigBackup,
  setPerformanceHudConvars,
  setPerformanceAdvancedConvars,
} from '../../lib/api';
import type {
  PerformanceConfigStatus,
  PerformanceConvarOrigin,
  PerformanceConvarState,
} from '../../types/electron';

const OPTIMIZATIONLOCK_URL = 'https://github.com/Sqooky/OptimizationLock';
const SQOOKY_KOFI_URL = 'https://ko-fi.com/sqooky';

// Sqooky's GameBanana identity, so the credit opens the in-app artist view
// (Browse scoped to their submissions) like any other artist link.
const SQOOKY_ARTIST: BrowseArtistRef = {
  id: 3826762,
  name: 'Sqooky!',
  avatarUrl: 'https://images.gamebanana.com/img/av/69f9ec7828119.png',
  profileUrl: 'https://gamebanana.com/members/3826762',
  kofiUrl: SQOOKY_KOFI_URL,
};

// `on` is the ConVar value the game reads when the control is switched on, so
// it is not always 'true': some of these are inverted (the offscreen indicator
// ConVar is a *disable* flag) or tri-state. `off` is carried too now that
// edits are staged: the pending row has to name the exact value that will be
// written. This list must stay a full mirror of HUD_CONVARS in
// performanceConfigData.ts, which the main process validates against: a key
// the main process supports but this list omits gets a computed state that
// nothing ever draws, so the preset can move it with no row to say so.
const HUD_CONTROLS = [
  { key: 'citadel_unit_status_use_v2', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_use_new', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_use_v2_for_nonplayers', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_single_bar_mode', on: 'true', off: 'false' },
  { key: 'citadel_unit_status_allies_see_thru_walls', on: 'true', off: 'false' },
  { key: 'citadel_hud_objective_health_enabled', on: '2', off: '0' },
  { key: 'citadel_damage_offscreen_indicator_disabled', on: 'false', off: 'true' },
  { key: 'citadel_damage_text_show_effectiveness', on: '1', off: '0' },
] as const;

// Slider bounds only. The *default* for each of these lives in
// ADVANCED_GAMEINFO_CONVARS (main process) and reaches the card through
// status.convarStates[key].gameDefault: a renderer-side default number gets
// drawn as if the game had chosen it, which is precisely the confusion the
// value-state badge exists to remove. Keep min/max/step in sync with the main
// table; the main process refuses anything outside them anyway.
const ADVANCED_CONTROLS = [
  { key: 'citadel_unit_status_allies_see_thru_walls_max_distance', min: 0, max: 200, step: 5 },
  { key: 'citadel_minimap_unit_click_radius', min: 400, max: 1200, step: 25 },
  { key: 'citadel_minimap_player_width', min: 4, max: 12, step: 0.5 },
  { key: 'citadel_minimap_local_player_width', min: 6, max: 16, step: 0.5 },
  { key: 'citadel_minimap_max_icon_shrink', min: 0.4, max: 1, step: 0.05 },
  { key: 'citadel_minimap_overlap_scan_distance', min: 0, max: 40, step: 1 },
  { key: 'citadel_minimap_zip_line_thickness', min: 1, max: 8, step: 0.5 },
  { key: 'minimap_update_rate_hz', min: 5, max: 60, step: 5 },
] as const;

/** An edit made in the card that has not been written to gameinfo.gi yet.
 *  'clear' means "remove Grimoire's line for this key", never "write the
 *  default value back". */
type PendingEdit = { kind: 'set'; value: string } | { kind: 'clear' };

const VALUE_STATE_SLUG: Record<PerformanceConvarOrigin, string> = {
  'game-default': 'gameDefault',
  'managed-preset': 'managedPreset',
  'user-override': 'userOverride',
  unsupported: 'unsupported',
};

/** The FPS preset writes a value for several of these keys, so the toggle is
 *  not the only writer. The origin badge says where the *current* value came
 *  from; this says which way the preset leans, which is what tells the user
 *  whether resetting the row lands back on the preset's opinion or on the
 *  game's own. Returns null for keys the preset has no opinion on. */
function presetNote(
  control: { on: string; off: string },
  presetValue: string | null | undefined,
  t: TFunction
): string | null {
  if (presetValue === null || presetValue === undefined) return null;
  if (presetValue === control.on) return t('performance.hud.presetNote.on');
  if (presetValue === control.off) return t('performance.hud.presetNote.off');
  return t('performance.hud.presetNote.value', { value: presetValue });
}

function controlLabel(key: string, t: TFunction): string {
  return HUD_CONTROLS.some((control) => control.key === key)
    ? t(`performance.hud.controls.${key}.label`)
    : t(`performance.advanced.controls.${key}`);
}

/** Where this control's current value came from, as a badge. Out of range wins
 *  over the origin: it is the state that blocks an edit, so it is the one the
 *  user needs to read first. */
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
    ? t('performance.valueStateHint.outOfRange', { value: state.value ?? '', min, max })
    : t(`performance.valueStateHint.${slug}`);
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
      <span title={hint}>{t(`performance.valueState.${slug}`)}</span>
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
      title={t('performance.resetHint')}
      aria-label={`${t('performance.reset')}`}
      className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
    >
      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  );
}

/**
 * Localized status sentence built from the structured status fields, so the
 * line follows the UI language instead of the English prose the main process
 * composes. Mirrors the message logic in performanceConfig.ts; falls back to
 * the backend message for the error state (which carries a raw error detail).
 */
function performanceStatusMessage(status: PerformanceConfigStatus, t: TFunction): string {
  const overrideCount = status.overrideCount ?? 0;
  switch (status.state) {
    case 'applied': {
      const base =
        status.appliedVersion === status.bundledVersion
          ? t('performance.status.applied', { version: status.appliedVersion })
          : t('performance.status.appliedOutdated', {
              version: status.appliedVersion,
              latest: status.bundledVersion,
            });
      const overrideNote = overrideCount
        ? t('performance.status.overrideNote', { count: overrideCount })
        : '';
      const handEditedNote = status.handEdited ? t('performance.status.handEditedNote') : '';
      return `${base}${overrideNote}${handEditedNote}`;
    }
    case 'wiped':
      if (status.canRestoreBackup === true) return t('performance.status.wipedRestorable');
      return (
        t('performance.status.wiped') +
        (overrideCount ? t('performance.status.wipedRestoreNote', { count: overrideCount }) : '')
      );
    case 'not-applied':
      return t('performance.status.notApplied');
    default:
      // error: keep the backend message (carries the raw error detail).
      return status.message;
  }
}

// Settings card for the OptimizationLock performance preset (experimental).
// Applies Sqooky's community fps config onto gameinfo.gi in place, shows
// whether a game update wiped it, and credits the upstream project.
//
// Every per-control edit is staged rather than written straight through: the
// card shows a pending-versus-applied summary and only touches gameinfo.gi on
// an explicit Apply. Sliders used to auto-commit on pointer-up while toggles
// wrote immediately, which made "what is actually in my file" unanswerable.
export default function PerformanceConfigCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PerformanceConfigStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  // Edits staged in the card, keyed by ConVar. Empty means the card matches
  // gameinfo.gi.
  const [pending, setPending] = useState<Record<string, PendingEdit>>({});
  // Keys whose out-of-range replacement the user has explicitly approved this
  // session, so the dialog does not reappear on every Apply.
  const [approvedOutOfRange, setApprovedOutOfRange] = useState<string[]>([]);
  const [outOfRangePrompt, setOutOfRangePrompt] = useState<{ key: string; next: string } | null>(null);
  // Result of the last reset, which is the one action that can legitimately do
  // nothing (no Grimoire line to remove). Reported verbatim rather than
  // pretending something changed.
  const [actionNote, setActionNote] = useState<string | null>(null);
  const { settings, saveSettings, setBrowseUi } = useAppStore();
  const navigate = useNavigate();

  const viewSqookyInBrowse = () => {
    setBrowseUi({ submitter: SQOOKY_ARTIST });
    navigate('/browse');
  };

  const refresh = useCallback(async () => {
    try {
      setStatus(await getPerformanceConfigStatus());
    } catch {
      setStatus({
        state: 'error',
        appliedVersion: null,
        bundledVersion: '',
        message: t('performance.statusReadError'),
      });
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-check when the window regains focus so hand edits made in an external
  // editor show up as the "edited" badge without a restart.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const run = async (action: () => Promise<PerformanceConfigStatus>) => {
    setBusy(true);
    setActionNote(null);
    try {
      setStatus(await action());
    } catch {
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  // What gameinfo.gi holds for a key right now, independent of anything staged.
  // convarStates is authoritative; convarValues is the fallback for a status
  // that predates the provenance pass (or could not compute it).
  const fileValueOf = (key: string): string | null => {
    const state = status?.convarStates?.[key];
    if (state) return state.value;
    const legacy = status?.convarValues?.[key];
    return legacy === undefined ? null : legacy;
  };

  const stageEdit = (key: string, edit: PendingEdit | null) => {
    setActionNote(null);
    setPending((prev) => {
      const next = { ...prev };
      // Staging the value the file already has is not a change.
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
    const advanced: Record<string, number> = {};
    const clears: string[] = [];
    for (const [key, edit] of entries) {
      if (edit.kind === 'clear') {
        clears.push(key);
        continue;
      }
      const hudControl = HUD_CONTROLS.find((control) => control.key === key);
      if (hudControl) hud[key] = edit.value === hudControl.on;
      else advanced[key] = Number(edit.value);
    }

    setBusy(true);
    setActionNote(null);
    try {
      let next: PerformanceConfigStatus | null = null;
      if (clears.length) {
        next = await clearPerformanceConvars(clears);
        // The clear path is allowed to change nothing (no Grimoire line to
        // remove); surface what it actually did.
        if (next.state !== 'error') setActionNote(next.message);
      }
      if (next?.state !== 'error' && Object.keys(hud).length) {
        next = await setPerformanceHudConvars(hud);
      }
      if (next?.state !== 'error' && Object.keys(advanced).length) {
        next = await setPerformanceAdvancedConvars(advanced);
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

  const openFile = async () => {
    setOpenError(null);
    try {
      await openPerformanceConfigFile();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setOpenError(detail.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  };

  const onEditFile = () => {
    // First use: ask which app to open with (.gi maps to text/plain, which
    // often resolves to a word processor). The choice persists in settings.
    if (settings?.externalEditorPath === undefined) setPickerOpen(true);
    else void openFile();
  };

  const onChooseEditor = async (editorPath: string | null) => {
    setPickerOpen(false);
    if (settings) await saveSettings({ ...settings, externalEditorPath: editorPath });
    void openFile();
  };

  const applied = status?.state === 'applied';
  const wiped = status?.state === 'wiped';
  const hudControlsAvailable = status?.state === 'applied' || status?.state === 'not-applied';
  // gameinfo.gi is empty/corrupt but we hold a backup: offer one-click recovery
  // so a manually cleared file is never a dead-end.
  const canRestore = status?.canRestoreBackup === true;
  // No provenance means the file could not be inspected (no ConVars section, or
  // an older status shape). Badges and per-control resets are hidden rather
  // than guessed at, and the sliders fall back to plain value editing.
  const canInspect = !!status?.convarStates;

  const pendingKeys = Object.keys(pending);
  const pendingRows = pendingKeys.map((key) => {
    const edit = pending[key];
    const label = controlLabel(key, t);
    const from = fileValueOf(key);
    const to = edit.kind === 'clear' ? null : edit.value;
    if (to === null) return { key, text: t('performance.pending.rowToDefault', { control: label, from }) };
    if (from === null) return { key, text: t('performance.pending.rowFromDefault', { control: label, to }) };
    return { key, text: t('performance.pending.row', { control: label, from, to }) };
  });

  const promptControl = outOfRangePrompt
    ? ADVANCED_CONTROLS.find((control) => control.key === outOfRangePrompt.key)
    : undefined;

  return (
    <Card
      title={t('settings.experimental.performanceConfig')}
      icon={Gauge}
      className="lg:col-span-2"
      description={t('performance.cardDescription')}
      action={
        status && (
          <Badge variant={applied ? (status.handEdited ? 'info' : 'success') : wiped ? 'warning' : status.state === 'error' ? 'error' : 'neutral'}>
            {applied
              ? status.handEdited
                ? t('performance.badge.appliedEdited', { version: status.appliedVersion })
                : t('performance.badge.applied', { version: status.appliedVersion })
              : wiped ? t('performance.badge.wiped') : status.state === 'error' ? t('performance.badge.error') : t('performance.badge.notApplied')}
          </Badge>
        )
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-text-secondary">{status ? performanceStatusMessage(status, t) : t('performance.checkingGameinfo')}</p>
          <p className="text-xs text-text-secondary">
            <Trans
              i18nKey="performance.credit"
              components={{
                sqooky: (
                  <button
                    type="button"
                    onClick={viewSqookyInBrowse}
                    className="text-accent hover:underline"
                  />
                ),
                contributors: (
                  <a
                    href={OPTIMIZATIONLOCK_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline inline-flex items-center gap-0.5"
                  />
                ),
                extlink: <ExternalLink className="w-3 h-3" aria-hidden="true" />,
                kofi: (
                  <a
                    href={SQOOKY_KOFI_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
          {actionNote && <p className="text-xs text-text-secondary/80">{actionNote}</p>}
          {openError && <p className="text-xs text-state-danger">{openError}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canRestore && (
            <Button
              onClick={() => run(restorePerformanceConfigBackup)}
              disabled={busy}
              icon={RotateCcw}
              size="sm"
            >
              {t('performance.restoreBackup')}
            </Button>
          )}
          <Button
            onClick={() => run(applyPerformanceConfig)}
            isLoading={busy}
            icon={wiped ? RefreshCw : undefined}
            variant={canRestore ? 'secondary' : 'primary'}
            size="sm"
          >
            {applied ? t('performance.reapply') : wiped ? t('performance.reapplyConfig') : t('performance.applyConfig')}
          </Button>
          {(applied || wiped) && (
            <Button onClick={() => run(removePerformanceConfig)} disabled={busy} variant="secondary" size="sm">
              {t('common.actions.remove')}
            </Button>
          )}
          {applied && (
            <Button onClick={onEditFile} disabled={busy} variant="ghost" size="sm" icon={SquarePen}>
              {t('performance.editFile')}
            </Button>
          )}
          {applied && settings?.externalEditorPath !== undefined && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={busy}
              title={t('performance.changeEditor')}
              aria-label={t('performance.changeEditor')}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-text-secondary hover:text-text-primary"
            >
              <Settings2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {applied && (status?.overrideCount ?? 0) > 0 && (
            <Button
              onClick={() => run(resetPerformanceConfigOverrides)}
              disabled={busy}
              variant="ghost"
              size="sm"
            >
              {t('performance.resetOverrides')}
            </Button>
          )}
        </div>
      </div>
      {hudControlsAvailable && (
        <details className="mt-5 border-t border-white/5 pt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary">
            {t('performance.hud.sectionTitle')}
          </summary>
          {pendingRows.length > 0 && (
            <div className="mt-4 rounded-sm border border-state-warning/25 bg-state-warning/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-state-warning">
                    {t('performance.pending.title')}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t('performance.pending.summary', { count: pendingRows.length })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={discardPending} disabled={busy} variant="ghost" size="sm">
                    {t('performance.pending.discard')}
                  </Button>
                  <Button onClick={() => void applyPending()} isLoading={busy} size="sm">
                    {t('performance.pending.apply')}
                  </Button>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5">
                {pendingRows.map((row) => (
                  <li key={row.key} className="text-xs text-text-secondary font-mono">
                    {row.text}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-text-secondary/70">{t('performance.pending.appliedNote')}</p>
            </div>
          )}
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {HUD_CONTROLS.map((control) => {
                const state = status?.convarStates?.[control.key];
                const edit = pending[control.key];
                const fileValue = fileValueOf(control.key);
                const effective = edit
                  ? edit.kind === 'clear'
                    ? null
                    : edit.value
                  : fileValue;
                const checked = effective === control.on;
                const unsupported = state?.origin === 'unsupported' && !edit;
                const note = presetNote(control, state?.presetValue, t);
                return (
                  <div key={control.key} className="flex items-start gap-2">
                    <Toggle
                      className="min-w-0 flex-1"
                      checked={checked}
                      onChange={(enabled) =>
                        stageEdit(control.key, {
                          kind: 'set',
                          value: enabled ? control.on : control.off,
                        })
                      }
                      disabled={busy || !status || unsupported}
                      label={t(`performance.hud.controls.${control.key}.label`)}
                      description={
                        unsupported ? (
                          t('performance.valueStateHint.unsupported')
                        ) : (
                          <>
                            {t(`performance.hud.controls.${control.key}.description`)}
                            {note && (
                              <span className="mt-1 block text-text-secondary/70">{note}</span>
                            )}
                          </>
                        )
                      }
                    />
                    {state && (
                      <div className="flex items-center gap-1 pt-0.5">
                        <ValueStateBadge state={state} />
                        <ResetControlButton
                          onClick={() => stageEdit(control.key, { kind: 'clear' })}
                          disabled={
                            busy ||
                            !canInspect ||
                            edit?.kind === 'clear' ||
                            (state.origin === 'game-default' && !edit)
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-5 border-t border-white/5 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('performance.advanced.sectionTitle')}</p>
            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {ADVANCED_CONTROLS.map((control) => {
                const state = status?.convarStates?.[control.key];
                const edit = pending[control.key];
                const fileValue = fileValueOf(control.key);
                const label = t(`performance.advanced.controls.${control.key}`);
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
                // The thumb parks on the known default for values we cannot
                // place (out of range, uninterpretable). The readout below
                // still shows what gameinfo.gi actually holds, so the position
                // is never mistaken for the value.
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
                  <div key={control.key} className="block">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-text-secondary">
                      <label htmlFor={`perf-${control.key}`} className="min-w-0 truncate">
                        {label}
                      </label>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-mono ${readoutClass}`}>{readout}</span>
                        {state && <ValueStateBadge state={state} min={control.min} max={control.max} />}
                        {state && (
                          <ResetControlButton
                            onClick={() => stageEdit(control.key, { kind: 'clear' })}
                            disabled={
                              busy ||
                              !canInspect ||
                              edit?.kind === 'clear' ||
                              (state.origin === 'game-default' && !edit)
                            }
                          />
                        )}
                      </span>
                    </div>
                    <input
                      id={`perf-${control.key}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={sliderValue}
                      onChange={(event) =>
                        stageEdit(control.key, { kind: 'set', value: event.target.value })
                      }
                      disabled={busy || !status || unsupported}
                      className="w-full accent-accent"
                      aria-label={label}
                    />
                    {(outOfRange || unsupported) && (
                      <p className="mt-1 text-[11px] text-state-warning/90">
                        {outOfRange
                          ? t('performance.valueStateHint.outOfRange', {
                              value: state?.value ?? '',
                              min: control.min,
                              max: control.max,
                            })
                          : t('performance.valueStateHint.unsupported')}
                      </p>
                    )}
                    {!outOfRange && !unsupported && showingDefault && (
                      <p className="mt-1 text-[11px] text-text-secondary/70">{t('performance.advanced.usingGameDefault')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      )}
      {pickerOpen && (
        <EditorPickerModal
          onClose={() => setPickerOpen(false)}
          onChoose={(editorPath) => void onChooseEditor(editorPath)}
        />
      )}
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
    </Card>
  );
}
