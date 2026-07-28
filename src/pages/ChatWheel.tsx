import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FileUp, Save, Sparkles } from 'lucide-react';
import { getMods, readChatWheel, saveChatWheel, getChatWheelStarter, getChatWheelStatus, validateChatWheel } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { Button } from '../components/common/ui';
import Tx from '../components/translation/Tx';
import type { Mod } from '../types/mod';
import { parseChatWheelYaml, updateChatWheelYaml, type ChatWheelModel } from '../lib/chatWheelModel';

export default function ChatWheel() {
  const { t } = useTranslation();
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

  const selected = useMemo(() => wheels.find((wheel) => wheel.id === selectedId), [selectedId, wheels]);
  const model = useMemo(() => parseChatWheelYaml(yaml), [yaml]);
  const [activeMenu, setActiveMenu] = useState(0);
  const [focusedItem, setFocusedItem] = useState<number | null>(null);

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
    if (dirty && !window.confirm(t('chatWheel.confirmDiscard', 'Discard unsaved changes and create a new chat wheel?'))) return;
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
                {model.menus.length === 0 ? (
                  <p className="text-sm text-text-secondary"><Tx k="chatWheel.noMenus" fallback="No custom menus yet. Add one to begin." /></p>
                ) : model.menus.map((menu, menuIndex) => (
                  <div key={`${menuIndex}-${menu.name}`} className="mb-3 rounded border border-border bg-bg-secondary p-3 last:mb-0">
                    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                      <input aria-label={t('chatWheel.menuName', 'Menu name')} value={menu.name} onFocus={() => setActiveMenu(menuIndex)} onChange={(event) => changeMenu(menuIndex, { name: event.target.value })} className="rounded border border-border bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary" />
                      <input aria-label={t('chatWheel.menuIcon', 'Icon')} value={menu.icon} onChange={(event) => changeMenu(menuIndex, { icon: event.target.value })} className="rounded border border-border bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary" />
                      <Button size="sm" variant="secondary" onClick={() => { applyModel({ ...model, menus: model.menus.filter((_, index) => index !== menuIndex) }); }}><Tx k="chatWheel.remove" fallback="Remove" /></Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {menu.items.map((item, itemIndex) => (
                        <div key={`${itemIndex}-${item}`} className="flex gap-2">
                          <input id={`chat-wheel-slot-${menuIndex}-${itemIndex}`} aria-label={t('chatWheel.command', 'Command')} value={item} onFocus={() => { setActiveMenu(menuIndex); setFocusedItem(itemIndex); }} onChange={(event) => changeMenu(menuIndex, { items: menu.items.map((value, index) => index === itemIndex ? event.target.value : value) })} className="min-w-0 flex-1 rounded border border-border bg-bg-tertiary px-2 py-1.5 text-sm text-text-primary" />
                          <Button size="sm" variant="secondary" onClick={() => changeMenu(menuIndex, { items: menu.items.filter((_, index) => index !== itemIndex) })}><Tx k="chatWheel.remove" fallback="Remove" /></Button>
                        </div>
                      ))}
                      <Button size="sm" variant="secondary" onClick={() => changeMenu(menuIndex, { items: [...menu.items, 'New command'] })}><Tx k="chatWheel.addCommand" fallback="Add command" /></Button>
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
                <div className="relative mx-auto mt-5 grid h-64 w-64 grid-cols-3 grid-rows-3 gap-2 rounded-full border border-accent/30 bg-bg-tertiary p-5">
                  {Array.from({ length: 8 }, (_, slot) => {
                    const item = model.menus[activeMenu].items[slot];
                    const gridSlots = [1, 2, 5, 8, 7, 6, 3, 0];
                    return <button key={slot} type="button" onClick={() => selectPreviewSlot(slot)} style={{ gridColumnStart: (gridSlots[slot] % 3) + 1, gridRowStart: Math.floor(gridSlots[slot] / 3) + 1 }} className={`rounded border px-1 text-center text-[10px] ${focusedItem === slot ? 'border-accent bg-accent/20 text-text-primary' : 'border-border bg-bg-secondary text-text-secondary'}`} title={item || t('chatWheel.emptySlot', 'Empty slot')}>
                      {item || <span className="text-text-secondary/50">+</span>}
                    </button>;
                  })}
                  <div className="col-start-2 row-start-2 flex items-center justify-center rounded-full border border-accent/40 bg-bg-primary p-2 text-center text-xs font-semibold text-text-primary">{model.menus[activeMenu].name || t('chatWheel.untitled', 'Untitled')}</div>
                </div>
              ) : <div className="mt-5 rounded border border-dashed border-border p-6 text-center text-xs text-text-secondary"><Tx k="chatWheel.previewEmpty" fallback="Add a menu to preview its wheel." /></div>}
            </div>
          </div>

          <details className="rounded border border-border bg-bg-primary p-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary"><Tx k="chatWheel.advancedYaml" fallback="Advanced YAML" /></summary>
            <label className="mt-3 block text-sm font-medium text-text-primary">
              <Tx k="chatWheel.yamlLabel" fallback="ChatLane YAML" />
              <textarea value={yaml} onChange={(event) => setYaml(event.target.value)} spellCheck={false} className="mt-1 min-h-[28rem] w-full resize-y rounded border border-border bg-bg-primary p-3 font-mono text-xs leading-5 text-text-primary" />
            </label>
          </details>
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
