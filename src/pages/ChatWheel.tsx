import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp, FileUp, Save, Sparkles } from 'lucide-react';
import { getMods, readChatWheel, saveChatWheel, getChatWheelStarter, getChatWheelStatus, validateChatWheel } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { Button } from '../components/common/ui';
import { EmptyState } from '../components/common/PageComponents';
import { useConfirm } from '../components/common/confirmContext';
import Tx from '../components/translation/Tx';
import type { Mod } from '../types/mod';
import { applyOverride, parseChatWheelYaml, updateChatWheelYaml, type ChatWheelModel, type OverrideState } from '../lib/chatWheelModel';
import { CHAT_WHEEL_ICONS, chatWheelIconUrl } from '../lib/chatWheelIcons';
import RadialWheelPreview from '../components/chatwheel/RadialWheelPreview';
import BaseCommandCatalog from '../components/chatwheel/BaseCommandCatalog';
import RemoveWheelButton from '../components/chatwheel/RemoveWheelButton';
import LimitationNote from '../components/chatwheel/LimitationNote';
import {
  hasChatWheelDrag,
  insertMenuItem,
  moveMenuItem,
  readChatWheelDrag,
  transferMenuItem,
  writeChatWheelDrag,
  type ChatWheelDragPayload,
} from '../lib/chatWheelMenuEdit';

export default function ChatWheel() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [yaml, setYaml] = useState('');
  const [name, setName] = useState('My Chat Wheel');
  const [wheels, setWheels] = useState<Mod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [busy, setBusy] = useState<'load' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converterAvailable, setConverterAvailable] = useState<boolean | null>(null);
  const [starterLoading, setStarterLoading] = useState(true);
  const [savedYaml, setSavedYaml] = useState('');
  const [savedName, setSavedName] = useState('My Chat Wheel');
  const [validation, setValidation] = useState<{ state: 'checking' | 'valid' | 'invalid'; message?: string } | null>(null);
  const validationRequest = useRef(0);
  const loadMods = useAppStore((state) => state.loadMods);
  const settings = useAppStore((state) => state.settings);

  const selected = useMemo(() => wheels.find((wheel) => wheel.id === selectedId), [selectedId, wheels]);
  const model = useMemo(() => parseChatWheelYaml(yaml), [yaml]);
  const [activeMenu, setActiveMenu] = useState(0);
  const [focusedItem, setFocusedItem] = useState<number | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(true);
  /** The menu whose item list is under a drag, for the drop highlight. */
  const [dropMenu, setDropMenu] = useState<number | null>(null);

  const refreshWheels = async () => {
    const mods = await getMods();
    setWheels(mods.filter((mod) => mod.sourceSection === 'ChatWheel'));
  };

  useEffect(() => {
    void refreshWheels().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    void getChatWheelStarter()
      .then((starter) => {
        setYaml(starter);
        setSavedYaml(starter);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setStarterLoading(false));
    void getChatWheelStatus()
      .then((res) => setConverterAvailable(res.available))
      .catch(() => setConverterAvailable(false));
  }, []);

  const dirty = yaml !== savedYaml || name !== savedName;

  const applyModel = (next: ChatWheelModel) => setYaml(updateChatWheelYaml(yaml, next));

  const changeMenu = (index: number, patch: Partial<ChatWheelModel['menus'][number]>) => {
    applyModel({ ...model, menus: model.menus.map((menu, menuIndex) => menuIndex === index ? { ...menu, ...patch } : menu) });
  };

  const focusItemInput = (menuIndex: number, itemIndex: number) => {
    requestAnimationFrame(() => document.getElementById(`chat-wheel-slot-${menuIndex}-${itemIndex}`)?.focus());
  };

  /** Reorder one menu's items, keeping focus on the item that moved. Shared by
   *  the Move up / Move down buttons, Alt+Arrow, and wedge drag-and-drop. */
  const moveItem = (menuIndex: number, from: number, to: number) => {
    const menu = model.menus[menuIndex];
    if (!menu || to < 0 || to >= menu.items.length || to === from) return;
    applyModel({ ...model, menus: moveMenuItem(model.menus, menuIndex, from, to) });
    setFocusedItem(to);
    focusItemInput(menuIndex, to);
  };

  /** Land a drag payload in a menu: a catalogue command is copied in, an
   *  existing item is moved (within or across menus). `at` undefined appends. */
  const dropInto = (menuIndex: number, payload: ChatWheelDragPayload, at?: number) => {
    const menus =
      payload.kind === 'command'
        ? insertMenuItem(model.menus, menuIndex, payload.id, at)
        : transferMenuItem(model.menus, payload, { menu: menuIndex, index: at });
    applyModel({ ...model, menus });
    setActiveMenu(menuIndex);
    const landed = at === undefined ? (menus[menuIndex]?.items.length ?? 1) - 1 : Math.min(at, (menus[menuIndex]?.items.length ?? 1) - 1);
    setFocusedItem(landed);
  };

  const addToActiveMenu = (id: string) => {
    if (!model.menus[activeMenu]) return;
    dropInto(activeMenu, { kind: 'command', id });
  };

  const selectPreviewSlot = (slot: number) => {
    const menu = model.menus[activeMenu];
    if (!menu) return;
    if (slot >= menu.items.length) {
      changeMenu(activeMenu, { items: [...menu.items, ...Array.from({ length: slot - menu.items.length + 1 }, () => 'New command')] });
    }
    setFocusedItem(slot);
    requestAnimationFrame(() => document.getElementById(`chat-wheel-slot-${activeMenu}-${slot}`)?.focus());
  };

  useEffect(() => {
    if (activeMenu >= model.menus.length) setActiveMenu(Math.max(0, model.menus.length - 1));
  }, [activeMenu, model.menus.length]);

  useEffect(() => {
    const request = ++validationRequest.current;
    if (starterLoading || converterAvailable !== true) {
      setValidation(null);
      return;
    }
    setValidation({ state: 'checking' });
    const timer = window.setTimeout(() => {
      void validateChatWheel(yaml)
        .then(() => {
          if (validationRequest.current === request) setValidation({ state: 'valid' });
        })
        .catch((err) => {
          if (validationRequest.current === request) {
            setValidation({ state: 'invalid', message: err instanceof Error ? err.message : String(err) });
          }
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [yaml, starterLoading, converterAvailable]);

  const createNewWheel = async () => {
    if (
      dirty &&
      !(await confirm({
        title: t('chatWheel.confirmDiscard', 'Discard unsaved changes and create a new chat wheel?'),
        confirmLabel: t('common.actions.discard', 'Discard'),
        variant: 'danger',
      }))
    ) {
      return;
    }
    setError(null);
    setBusy('load');
    setStarterLoading(true);
    try {
      const starter = await getChatWheelStarter();
      setYaml(starter);
      setName('My Chat Wheel');
      setSelectedId('');
      setSavedYaml(starter);
      setSavedName('My Chat Wheel');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setStarterLoading(false);
    }
  };

  const loadFromDisk = async () => {
    setError(null);
    const path = await window.electronAPI.showOpenDialog({
      title: t('chatWheel.dialogTitle', 'Open ChatLane VPK'),
      filters: [{ name: 'Valve Pak', extensions: ['vpk'] }],
    });
    if (!path) return;
    setBusy('load');
    try {
      const loadedYaml = await readChatWheel(path);
      setYaml(loadedYaml);
      setSavedYaml(loadedYaml);
      const wheel = wheels.find((item) => item.path === path);
      setSelectedId(wheel?.id ?? '');
      if (wheel?.name) {
        setName(wheel.name);
        setSavedName(wheel.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const loadInstalled = async () => {
    if (!selected) return;
    setError(null);
    setBusy('load');
    try {
      const loadedYaml = await readChatWheel(selected.path);
      setYaml(loadedYaml);
      setSavedYaml(loadedYaml);
      setName(selected.name);
      setSavedName(selected.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setError(null);
    setBusy('save');
    try {
      await saveChatWheel({ yaml, name, replaceModId: selectedId || undefined });
      setSavedYaml(yaml);
      setSavedName(name);
      await Promise.all([refreshWheels(), loadMods()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!settings?.experimentalChatWheel) {
    return (
      <EmptyState
        icon={Sparkles}
        title={<Tx k="chatWheel.disabled.title" fallback="Chat Wheel is off" />}
        description={
          <Tx
            k="chatWheel.disabled.description"
            fallback="Enable the Chat Wheel in Settings to use this page."
          />
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
          <Sparkles className="h-6 w-6 text-accent" />
          <Tx k="chatWheel.title" fallback="Chat Wheel" />
        </h1>
        <p className="text-sm text-text-secondary">
          <Tx
            k="chatWheel.subtitle"
            fallback="Edit ChatLane YAML and install it as a managed Deadlock add-on. Saving replaces the selected wheel in-place; Grimoire never changes gameinfo.gi here."
          />
        </p>
      </header>

      {converterAvailable === false && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-100">
              <Tx k="chatWheel.binaryMissingTitle" fallback="ChatLane converter unavailable" />
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              <Tx
                k="chatWheel.binaryMissing"
                fallback="The ChatLane converter binary is unavailable on this system. You can view installed wheels, but building or reading VPKs requires the ChatLane executable in resources/chatlane."
              />
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-3 rounded border border-border bg-bg-secondary p-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <Tx k="chatWheel.installedWheels" fallback="Installed wheels" />
          </label>
          <select
            value={selectedId}
            onChange={(event) => {
              if (event.target.value) setSelectedId(event.target.value);
              else void createNewWheel();
            }}
            className="w-full rounded border border-border bg-bg-tertiary px-2 py-2 text-sm text-text-primary"
          >
            <option value="">{t('chatWheel.createNew', 'Create new wheel')}</option>
            {wheels.map((wheel) => (
              <option key={wheel.id} value={wheel.id}>
                {wheel.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={loadInstalled}
            disabled={!selected || busy !== null || converterAvailable === false}
            isLoading={busy === 'load'}
          >
            <Tx k="chatWheel.loadSelected" fallback="Load selected" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={createNewWheel}
            disabled={busy !== null || converterAvailable === false}
            isLoading={busy === 'load'}
          >
            <Tx k="chatWheel.createNew" fallback="Create new wheel" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={loadFromDisk}
            disabled={busy !== null || converterAvailable === false}
          >
            <FileUp className="mr-1 h-4 w-4" />
            <Tx k="chatWheel.openVpk" fallback="Open VPK…" />
          </Button>
          <RemoveWheelButton
            wheel={selected}
            disabled={busy !== null}
            onRemoved={async () => { setSelectedId(''); await Promise.all([refreshWheels(), loadMods()]); }}
            onError={setError}
          />
          <p className="text-xs leading-relaxed text-text-secondary">
            <Tx
              k="chatWheel.helpNote"
              fallback="Only VPKs made by ChatLane can be opened. The embedded chatlane.yml is preserved on every save. Installation happens only when you choose Save & install."
            />
          </p>
        </aside>

        <section className="space-y-5 rounded border border-border bg-bg-secondary p-4">
          {!selected && (
            <p className="rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-secondary" role="status">
              <Tx
                k="chatWheel.newWheelDraft"
                fallback="New wheel draft: this is not installed yet. Save & install creates the managed add-on."
              />
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-text-primary">
                <Tx k="chatWheel.nameLabel" fallback="Add-on name" />
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" />
              </label>
              <label className="block text-sm font-medium text-text-primary">
                <Tx k="chatWheel.wheelName" fallback="Wheel name" />
                <input value={model.name} onChange={(event) => applyModel({ ...model, name: event.target.value })} className="mt-1 w-full rounded border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" />
              </label>

              <div className="rounded border border-border bg-bg-primary p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary"><Tx k="chatWheel.menus" fallback="Menus and commands" /></h2>
                    <p className="text-xs text-text-secondary"><Tx k="chatWheel.menusHelp" fallback="Edit the ChatLane menus shown in the preview." /></p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => { applyModel({ ...model, menus: [...model.menus, { name: 'New menu', icon: 'quick', items: [] }] }); setActiveMenu(model.menus.length); }}>
                    <Tx k="chatWheel.addMenu" fallback="Add menu" />
                  </Button>
                </div>
                <div className="mb-3 space-y-1">
                  <LimitationNote limitation="topSlot" />
                  <LimitationNote limitation="placeholderVoice" />
                </div>
                {model.menus.length === 0 ? (
                  <p className="text-sm text-text-secondary"><Tx k="chatWheel.noMenus" fallback="No custom menus yet. Add one to begin." /></p>
                ) : model.menus.map((menu, menuIndex) => (
                  <div key={`${menuIndex}-${menu.name}`} className="mb-3 rounded border border-border bg-bg-secondary p-3 last:mb-0">
                    <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                      <input aria-label={t('chatWheel.menuName', 'Menu name')} value={menu.name} onFocus={() => setActiveMenu(menuIndex)} onChange={(event) => changeMenu(menuIndex, { name: event.target.value })} className="rounded border border-border bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary" />
                      {/* The icon names ChatLane ships; anything else renders as
                          no icon in game, so free text stays allowed. */}
                      <div className="flex items-center gap-1.5 rounded border border-border bg-bg-tertiary px-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center" title={chatWheelIconUrl(menu.icon) ? menu.icon : t('chatWheel.iconUnknown', 'Not a ChatLane icon name; the wheel will show no icon.')}>
                          {chatWheelIconUrl(menu.icon)
                            ? <img src={chatWheelIconUrl(menu.icon)!} alt="" className="h-4 w-4" />
                            : <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-border" />}
                        </span>
                        <input aria-label={t('chatWheel.menuIcon', 'Icon')} list="chat-wheel-icon-names" value={menu.icon} onFocus={() => setActiveMenu(menuIndex)} onChange={(event) => changeMenu(menuIndex, { icon: event.target.value })} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-text-primary focus:outline-none" />
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => { applyModel({ ...model, menus: model.menus.filter((_, index) => index !== menuIndex) }); }}><Tx k="chatWheel.remove" fallback="Remove" /></Button>
                    </div>
                    <div
                      className={`mt-2 space-y-2 rounded transition-shadow ${dropMenu === menuIndex ? 'ring-2 ring-accent/50' : ''}`}
                      data-drop-menu={dropMenu === menuIndex ? 'true' : undefined}
                      onDragOver={(event) => {
                        if (!hasChatWheelDrag(event.dataTransfer)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
                        if (dropMenu !== menuIndex) setDropMenu(menuIndex);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropMenu(null);
                      }}
                      onDrop={(event) => {
                        const payload = readChatWheelDrag(event.dataTransfer);
                        setDropMenu(null);
                        if (!payload) return;
                        event.preventDefault();
                        // A drop on a row inserts before it; anywhere else appends.
                        const row = (event.target as HTMLElement).closest('[data-item-index]');
                        const at = row ? Number(row.getAttribute('data-item-index')) : undefined;
                        dropInto(menuIndex, payload, at);
                      }}
                    >
                      {menu.items.map((item, itemIndex) => (
                        <div
                          key={`${itemIndex}-${item}`}
                          data-item-index={itemIndex}
                          draggable
                          onDragStart={(event) => {
                            writeChatWheelDrag(event.dataTransfer, { kind: 'item', menu: menuIndex, index: itemIndex });
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            id={`chat-wheel-slot-${menuIndex}-${itemIndex}`}
                            aria-label={t('chatWheel.command', 'Command')}
                            value={item}
                            onFocus={() => { setActiveMenu(menuIndex); setFocusedItem(itemIndex); }}
                            onChange={(event) => changeMenu(menuIndex, { items: menu.items.map((value, index) => index === itemIndex ? event.target.value : value) })}
                            onKeyDown={(event) => {
                              if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
                              event.preventDefault();
                              moveItem(menuIndex, itemIndex, event.key === 'ArrowUp' ? itemIndex - 1 : itemIndex + 1);
                            }}
                            className="min-w-0 flex-1 rounded border border-border bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={ChevronUp}
                            aria-label={t('chatWheel.dnd.moveUp', 'Move {{command}} up', { command: item })}
                            disabled={itemIndex === 0}
                            onClick={() => moveItem(menuIndex, itemIndex, itemIndex - 1)}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={ChevronDown}
                            aria-label={t('chatWheel.dnd.moveDown', 'Move {{command}} down', { command: item })}
                            disabled={itemIndex === menu.items.length - 1}
                            onClick={() => moveItem(menuIndex, itemIndex, itemIndex + 1)}
                          />
                          {model.menus.length > 1 && (
                            <select
                              aria-label={t('chatWheel.dnd.moveToMenu', 'Move {{command}} to menu', { command: item })}
                              value={menuIndex}
                              onChange={(event) => {
                                const target = Number(event.target.value);
                                if (target !== menuIndex) dropInto(target, { kind: 'item', menu: menuIndex, index: itemIndex });
                              }}
                              className="rounded border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
                            >
                              {model.menus.map((option, optionIndex) => (
                                <option key={`${optionIndex}-${option.name}`} value={optionIndex}>
                                  {option.name || t('chatWheel.untitled', 'Untitled')}
                                </option>
                              ))}
                            </select>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => changeMenu(menuIndex, { items: menu.items.filter((_, index) => index !== itemIndex) })}><Tx k="chatWheel.remove" fallback="Remove" /></Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => changeMenu(menuIndex, { items: [...menu.items, 'New command'] })}><Tx k="chatWheel.addCommand" fallback="Add command" /></Button>
                        <span className="text-[11px] text-text-secondary">
                          <Tx k="chatWheel.dnd.listHint" fallback="Drag commands here from the catalogue or another menu. Alt+Up and Alt+Down also move a command." />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-border bg-bg-primary p-3">
              <h2 className="text-sm font-semibold text-text-primary"><Tx k="chatWheel.preview" fallback="Live wheel preview" /></h2>
              <p className="mt-1 text-xs text-text-secondary"><Tx k="chatWheel.previewHelp" fallback="Choose a menu, then select a slot to edit its command." /></p>
              <div className="mt-3 flex flex-wrap gap-1">
                {model.menus.map((menu, index) => <Button key={`${menu.name}-${index}`} size="sm" variant={activeMenu === index ? 'primary' : 'secondary'} onClick={() => setActiveMenu(index)}>{menu.name || t('chatWheel.untitled', 'Untitled')}</Button>)}
              </div>
              {model.menus[activeMenu] ? (
                <RadialWheelPreview
                  menuIndex={activeMenu}
                  menuName={model.menus[activeMenu].name}
                  icon={model.menus[activeMenu].icon}
                  items={model.menus[activeMenu].items}
                  focusedSlot={focusedItem}
                  onSelectSlot={selectPreviewSlot}
                  onMoveItem={(from, to) => moveItem(activeMenu, from, to)}
                  onDrop={(payload, at) => dropInto(activeMenu, payload, at)}
                />
              ) : <div className="mt-5 rounded border border-dashed border-border p-6 text-center text-xs text-text-secondary"><Tx k="chatWheel.previewEmpty" fallback="Add a menu to preview its wheel." /></div>}
              <div className="mt-3 space-y-1">
                <LimitationNote limitation="archmotherOrder" />
                <LimitationNote limitation="slotSelect" />
              </div>
            </div>
          </div>

          {/* React 19 emits one toggle event on mount for a controlled
              details, so the handler must be idempotent. */}
          <details
            open={catalogOpen}
            onToggle={(event) => {
              const next = event.currentTarget.open;
              if (next !== catalogOpen) setCatalogOpen(next);
            }}
            className="rounded border border-border bg-bg-primary p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">
              <Tx k="chatWheel.catalog.title" fallback="Base command catalogue" />
            </summary>
            <BaseCommandCatalog
              model={model}
              loading={starterLoading}
              disabled={starterLoading || busy !== null}
              onSetOverride={(id, map, state: OverrideState) => applyModel(applyOverride(model, map, id, state))}
              activeMenuName={model.menus[activeMenu] ? (model.menus[activeMenu].name || t('chatWheel.untitled', 'Untitled')) : null}
              onAddToMenu={addToActiveMenu}
            />
          </details>

          <datalist id="chat-wheel-icon-names">
            {CHAT_WHEEL_ICONS.map((icon) => <option key={icon.name} value={icon.name} />)}
          </datalist>

          <details className="rounded border border-border bg-bg-primary p-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary"><Tx k="chatWheel.advancedYaml" fallback="Advanced YAML" /></summary>
            <label className="mt-3 block text-sm font-medium text-text-primary">
              <Tx k="chatWheel.yamlLabel" fallback="ChatLane YAML" />
              <textarea value={yaml} onChange={(event) => setYaml(event.target.value)} spellCheck={false} className="mt-1 min-h-[28rem] w-full resize-y rounded border border-border bg-bg-primary p-3 font-mono text-xs leading-5 text-text-primary" />
            </label>
          </details>
          <LimitationNote limitation="unbindCrash" />
          <div className="flex items-center justify-between gap-3">
            <span className={validation?.state === 'invalid' ? 'text-xs text-red-300' : 'text-xs text-text-secondary'}>
              {validation?.state === 'checking' && t('chatWheel.validationChecking', 'Checking YAML with ChatLane…')}
              {validation?.state === 'valid' && t('chatWheel.validationValid', 'ChatLane YAML is valid. Nothing has been installed.')}
              {validation?.state === 'invalid' && validation.message}
              {!validation && <Tx k="chatWheel.validationNote" fallback="Validation happens in ChatLane before any add-on is installed." />}
            </span>
            <Button
              onClick={save}
              disabled={busy !== null || starterLoading || converterAvailable === false || validation?.state === 'checking' || validation?.state === 'invalid'}
              isLoading={busy === 'save'}
            >
              <Save className="mr-1 h-4 w-4" />
              <Tx k="chatWheel.saveAndInstall" fallback="Save & install" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
