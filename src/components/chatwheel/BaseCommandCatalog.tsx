import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, GripVertical, Plus, SearchX, X } from 'lucide-react';
import SearchInput from '../common/SearchInput';
import { Skeleton } from '../common/Skeleton';
import { Button, Tag } from '../common/ui';
import {
  CHAT_WHEEL_COMMANDS,
  CHAT_WHEEL_COMMAND_COUNTS,
  findChatWheelCommand,
  type ChatWheelCommand,
  type ChatWheelCommandCategory,
} from '../../lib/chatWheelCommands';
import { overrideStateFor, type ChatWheelModel, type OverrideState } from '../../lib/chatWheelModel';
import { writeChatWheelDrag } from '../../lib/chatWheelMenuEdit';
import TriStateControl from './TriStateControl';
import { chipClass, rovingArrowKeyDown } from './chipStyles';

/**
 * The base command catalogue: every command ChatLane knows about, with its
 * game default and both override maps editable as three-state controls.
 *
 * The component owns no override state. Values are read out of the parsed
 * model and every change is handed back to the page, which routes it through
 * `updateChatWheelYaml`, so Advanced YAML stays the single source of truth and
 * a manual YAML edit flows straight back into these controls.
 *
 * Command ids are the raw display strings the game shows and the literal YAML
 * keys, so they render verbatim and never pass through `t()`.
 */

type OverrideMap = 'bindable' | 'pingWheel';
type CategoryFilter = 'all' | ChatWheelCommandCategory;

interface BaseCommandCatalogProps {
  model: ChatWheelModel;
  /** True only while the starter YAML loads; replaces the list with skeletons. */
  loading: boolean;
  /** Wider than `loading`: also true while a save is in flight. */
  disabled: boolean;
  onSetOverride: (id: string, map: OverrideMap, state: OverrideState) => void;
  /** Name of the menu an "Add" button targets; null when the wheel has no
   *  menu yet. Omit both add props to hide the column and the drag handles. */
  activeMenuName?: string | null;
  /** Add a catalogue command to the active menu: the keyboard twin of
   *  dragging a row onto a menu. */
  onAddToMenu?: (id: string) => void;
}

const FILTERS: ReadonlyArray<{ value: CategoryFilter; key: string; fallback: string; count: number }> = [
  { value: 'all', key: 'chatWheel.catalog.filterAll', fallback: 'All', count: CHAT_WHEEL_COMMAND_COUNTS.all },
  { value: 'default', key: 'chatWheel.catalog.filterDefault', fallback: 'Default', count: CHAT_WHEEL_COMMAND_COUNTS.default },
  { value: 'hidden', key: 'chatWheel.catalog.filterHidden', fallback: 'Hidden', count: CHAT_WHEEL_COMMAND_COUNTS.hidden },
  { value: 'broken', key: 'chatWheel.catalog.filterBroken', fallback: 'Broken', count: CHAT_WHEEL_COMMAND_COUNTS.broken },
];

const ROW_GRID = 'sm:grid-cols-[minmax(0,1fr)_9rem_11rem_11rem]';
const ROW_GRID_WITH_ADD = 'sm:grid-cols-[minmax(0,1fr)_9rem_11rem_11rem_auto]';

export default function BaseCommandCatalog({
  model,
  loading,
  disabled,
  onSetOverride,
  activeMenuName,
  onAddToMenu,
}: BaseCommandCatalogProps) {
  const { t } = useTranslation();
  const canAdd = Boolean(onAddToMenu);
  const rowGrid = canAdd ? ROW_GRID_WITH_ADD : ROW_GRID;
  const addTitle =
    activeMenuName == null
      ? t('chatWheel.dnd.addToMenuNone', 'Add a menu first to add commands to it.')
      : undefined;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CHAT_WHEEL_COMMANDS.filter(
      (command) =>
        (category === 'all' || command.category === category) &&
        (needle === '' || command.id.toLowerCase().includes(needle)),
    );
  }, [category, query]);

  /** Keys present in either override map that the catalogue does not know,
   *  in map order (bindable first, then ping-only keys). */
  const unknownKeys = useMemo(() => {
    const keys: string[] = [];
    for (const map of [model.overrideBindable, model.overridePingWheelBindable]) {
      for (const key of Object.keys(map ?? {})) {
        if (!findChatWheelCommand(key) && !keys.includes(key)) keys.push(key);
      }
    }
    return keys;
  }, [model.overrideBindable, model.overridePingWheelBindable]);

  const narrowed = query.trim() !== '' || category !== 'all';
  const showBrokenCaveat =
    (category === 'all' || category === 'broken') && rows.some((command) => command.category === 'broken');

  const statusTag = (command: ChatWheelCommand) => {
    if (command.category === 'hidden') {
      return (
        <Tag tone="info" title={t('chatWheel.catalog.statusHiddenTooltip', 'Available in game but not bindable on the stock Chat Wheel; ChatLane unlocks it.')}>
          {t('chatWheel.catalog.statusHidden', 'Hidden by default')}
        </Tag>
      );
    }
    if (command.category === 'broken') {
      return (
        <Tag tone="warning" title={t('chatWheel.catalog.statusBrokenTooltip', 'Only usable in the game states that use it, such as post-game all-chat.')}>
          {t('chatWheel.catalog.statusBroken', 'Game-state dependent')}
        </Tag>
      );
    }
    // Unreachable with the pinned commit's data (every default entry is
    // bindable). Kept so a future VC_LIST change degrades honestly rather than
    // labelling a non-bindable command as bindable.
    return command.bindable ? (
      <Tag tone="success">{t('chatWheel.catalog.statusBindable', 'Bindable by default')}</Tag>
    ) : (
      <Tag tone="neutral">{t('chatWheel.catalog.statusNotBindable', 'Not bindable by default')}</Tag>
    );
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('chatWheel.catalog.searchPlaceholder', 'Search commands')}
          scope={t('chatWheel.catalog.searchScope', 'Search all {{count}} commands by name.', {
            count: CHAT_WHEEL_COMMAND_COUNTS.all,
          })}
          clearLabel={t('chatWheel.catalog.searchClear', 'Clear search')}
          summary={
            narrowed
              ? t('chatWheel.catalog.searchSummary', 'Showing {{count}} of {{total}} commands', {
                  count: rows.length,
                  total: CHAT_WHEEL_COMMAND_COUNTS.all,
                })
              : undefined
          }
        />
        <div role="group" aria-label={t('chatWheel.catalog.filterLabel', 'Filter by category')} className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={category === filter.value}
              disabled={disabled}
              onClick={() => setCategory(filter.value)}
              className={chipClass(category === filter.value)}
            >
              {t(filter.key, filter.fallback)} {filter.count}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        {t(
          'chatWheel.catalog.legend',
          'Each command has a game default. Inherit keeps it, On forces it enabled in the saved YAML, Off forces it disabled.',
        )}
        {canAdd && activeMenuName != null && (
          <>
            {' '}
            {t('chatWheel.dnd.catalogHint', 'Drag a command onto a menu, or use its Add button to add it to {{menu}}.', {
              menu: activeMenuName,
            })}
          </>
        )}
      </p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className={`hidden gap-2 px-1 pb-1 text-xs font-semibold text-text-secondary sm:grid ${rowGrid}`}>
            <span>{t('chatWheel.catalog.columnCommand', 'Command')}</span>
            <span>{t('chatWheel.catalog.columnDefault', 'Game default')}</span>
            <span>{t('chatWheel.catalog.columnChatWheel', 'Chat Wheel')}</span>
            <span>{t('chatWheel.catalog.columnPingWheel', 'Ping wheel')}</span>
            {canAdd && <span>{t('chatWheel.dnd.columnAdd', 'Add')}</span>}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded border border-border bg-bg-secondary px-3 py-6 text-center">
              <SearchX className="h-8 w-8 text-text-secondary" />
              <p className="text-sm font-semibold text-text-primary">
                {t('chatWheel.catalog.emptyTitle', 'No commands match your search')}
              </p>
              <p className="text-xs text-text-secondary">
                {t(
                  'chatWheel.catalog.emptyBody',
                  'Try a different search or category. Toggles change what ChatLane offers, not what the game guarantees.',
                )}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                {t('chatWheel.catalog.emptyAction', 'Clear search and filters')}
              </Button>
            </div>
          ) : (
            <div role="list" aria-label={t('chatWheel.catalog.listLabel', 'Base commands')}>
              {rows.map((command) => (
                <div
                  key={command.id}
                  role="listitem"
                  className={`grid items-center gap-2 border-b border-border/50 py-2 ${rowGrid}`}
                >
                  {canAdd ? (
                    <span
                      draggable
                      aria-label={t('chatWheel.dnd.dragItem', 'Drag {{command}}', { command: command.id })}
                      title={command.id}
                      onDragStart={(event) => {
                        writeChatWheelDrag(event.dataTransfer, { kind: 'command', id: command.id });
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="flex min-w-0 cursor-grab items-center gap-1 text-sm text-text-primary active:cursor-grabbing"
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
                      <span className="truncate">{command.id}</span>
                    </span>
                  ) : (
                    <span className="truncate text-sm text-text-primary" title={command.id}>
                      {command.id}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-1">
                    {statusTag(command)}
                    {command.pingWheelBindable !== command.bindable && (
                      <Tag tone="neutral">
                        {command.pingWheelBindable
                          ? t('chatWheel.catalog.statusPingBindable', 'On ping wheel by default')
                          : t('chatWheel.catalog.statusPingNotBindable', 'Not on ping wheel by default')}
                      </Tag>
                    )}
                  </span>
                  <TriStateControl
                    value={overrideStateFor(model.overrideBindable, command.id)}
                    onChange={(state) => onSetOverride(command.id, 'bindable', state)}
                    ariaLabel={t('chatWheel.catalog.ariaChatWheel', '{{command}}: Chat Wheel', { command: command.id })}
                    disabled={disabled}
                  />
                  <TriStateControl
                    value={overrideStateFor(model.overridePingWheelBindable, command.id)}
                    onChange={(state) => onSetOverride(command.id, 'pingWheel', state)}
                    ariaLabel={t('chatWheel.catalog.ariaPingWheel', '{{command}}: Ping wheel', { command: command.id })}
                    disabled={disabled}
                  />
                  {canAdd && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      aria-label={t('chatWheel.dnd.addToMenu', 'Add {{command}} to {{menu}}', {
                        command: command.id,
                        menu: activeMenuName ?? '',
                      })}
                      title={addTitle}
                      disabled={disabled || activeMenuName == null}
                      onClick={() => onAddToMenu?.(command.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {showBrokenCaveat && (
            <div className="flex items-start gap-2 rounded border border-state-warning/20 bg-state-warning/5 px-3 py-2 text-xs text-text-secondary">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-state-warning" />
              {t(
                'chatWheel.catalog.brokenCaveat',
                'Broken commands are not bindable by default and only matter in the game states that use them, such as post-game all-chat. Toggling them here changes what ChatLane offers, not what the game guarantees.',
              )}
            </div>
          )}

          {unknownKeys.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {t('chatWheel.catalog.otherCommands', 'Other commands in this file')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t(
                  'chatWheel.catalog.otherCommandsHelp',
                  'These override keys are not in the base catalogue. They are kept byte-for-byte and stay editable.',
                )}
              </p>
              {unknownKeys.map((key) => (
                <div
                  key={key}
                  className="grid items-center gap-2 border-b border-border/50 py-2 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]"
                >
                  <span className="truncate font-mono text-xs text-text-primary" title={key}>
                    {key}
                  </span>
                  <BooleanPair
                    value={model.overrideBindable?.[key]}
                    ariaLabel={t('chatWheel.catalog.ariaChatWheel', '{{command}}: Chat Wheel', { command: key })}
                    disabled={disabled}
                    onChange={(state) => onSetOverride(key, 'bindable', state)}
                  />
                  <BooleanPair
                    value={model.overridePingWheelBindable?.[key]}
                    ariaLabel={t('chatWheel.catalog.ariaPingWheel', '{{command}}: Ping wheel', { command: key })}
                    disabled={disabled}
                    onChange={(state) => onSetOverride(key, 'pingWheel', state)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The unknown-key editor: two states, not three. An unknown command has no
 * catalogue default, so inherit would mean nothing. Switching off writes an
 * explicit `false`; deleting an entry stays an Advanced YAML action.
 */
function BooleanPair({
  value,
  ariaLabel,
  disabled,
  onChange,
}: {
  value: boolean | undefined;
  ariaLabel: string;
  disabled: boolean;
  onChange: (state: 'on' | 'off') => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1">
      <span role="group" aria-label={ariaLabel} className="inline-flex gap-1">
        <button
          type="button"
          aria-pressed={value === true}
          disabled={disabled}
          tabIndex={value === false ? -1 : 0}
          onKeyDown={rovingArrowKeyDown}
          onClick={() => onChange('on')}
          className={chipClass(value === true)}
        >
          <Check className="h-3.5 w-3.5" />
          {t('chatWheel.catalog.stateOn', 'On')}
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          disabled={disabled}
          tabIndex={value === false ? 0 : -1}
          onKeyDown={rovingArrowKeyDown}
          onClick={() => onChange('off')}
          className={chipClass(value === false)}
        >
          <X className="h-3.5 w-3.5" />
          {t('chatWheel.catalog.stateOff', 'Off')}
        </button>
      </span>
      {value === undefined && (
        <span className="text-xs text-text-secondary">{t('chatWheel.catalog.otherNotSet', 'Not set')}</span>
      )}
    </span>
  );
}
