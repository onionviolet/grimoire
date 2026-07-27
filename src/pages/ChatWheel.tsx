import { useEffect, useMemo, useState } from 'react';
import { FileUp, Save, Sparkles } from 'lucide-react';
import { getMods, readChatWheel, saveChatWheel } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { Button } from '../components/common/ui';
import type { Mod } from '../types/mod';

const STARTER_YAML = `# ChatLane configuration\n# Load a compatible VPK to edit its exact YAML, or paste a configuration here.\n`;

export default function ChatWheel() {
  const [yaml, setYaml] = useState(STARTER_YAML);
  const [name, setName] = useState('My Chat Wheel');
  const [wheels, setWheels] = useState<Mod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [busy, setBusy] = useState<'load' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadMods = useAppStore((state) => state.loadMods);

  const selected = useMemo(() => wheels.find((wheel) => wheel.id === selectedId), [selectedId, wheels]);

  const refreshWheels = async () => {
    const mods = await getMods();
    setWheels(mods.filter((mod) => mod.sourceSection === 'ChatWheel'));
  };

  useEffect(() => { void refreshWheels().catch((err) => setError(String(err))); }, []);

  const loadFromDisk = async () => {
    setError(null);
    const path = await window.electronAPI.showOpenDialog({
      title: 'Open ChatLane VPK', filters: [{ name: 'Valve Pak', extensions: ['vpk'] }],
    });
    if (!path) return;
    setBusy('load');
    try {
      setYaml(await readChatWheel(path));
      const wheel = wheels.find((item) => item.path === path);
      setSelectedId(wheel?.id ?? '');
      if (wheel?.name) setName(wheel.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const loadInstalled = async () => {
    if (!selected) return;
    setError(null);
    setBusy('load');
    try {
      setYaml(await readChatWheel(selected.path));
      setName(selected.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setError(null);
    setBusy('save');
    try {
      await saveChatWheel({ yaml, name, replaceModId: selectedId || undefined });
      await Promise.all([refreshWheels(), loadMods()]);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary"><Sparkles className="h-6 w-6 text-accent" /> Chat Wheel</h1>
        <p className="text-sm text-text-secondary">Edit ChatLane YAML and install it as a managed Deadlock add-on. Saving replaces the selected wheel in-place; Grimoire never changes gameinfo.gi here.</p>
      </header>

      {error && <div className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200 whitespace-pre-wrap">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-3 rounded border border-border bg-bg-secondary p-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">Installed wheels</label>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded border border-border bg-bg-tertiary px-2 py-2 text-sm text-text-primary">
            <option value="">New chat wheel</option>
            {wheels.map((wheel) => <option key={wheel.id} value={wheel.id}>{wheel.name}</option>)}
          </select>
          <Button variant="secondary" size="sm" className="w-full" onClick={loadInstalled} disabled={!selected || busy !== null} isLoading={busy === 'load'}>Load selected</Button>
          <Button variant="secondary" size="sm" className="w-full" onClick={loadFromDisk} disabled={busy !== null}><FileUp className="mr-1 h-4 w-4" /> Open VPK…</Button>
          <p className="text-xs leading-relaxed text-text-secondary">Only VPKs made by ChatLane can be opened. The embedded <code>chatlane.yml</code> is preserved on every save.</p>
        </aside>

        <section className="space-y-3 rounded border border-border bg-bg-secondary p-4">
          <label className="block text-sm font-medium text-text-primary">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" /></label>
          <label className="block text-sm font-medium text-text-primary">ChatLane YAML<textarea value={yaml} onChange={(event) => setYaml(event.target.value)} spellCheck={false} className="mt-1 min-h-[28rem] w-full resize-y rounded border border-border bg-bg-primary p-3 font-mono text-xs leading-5 text-text-primary" /></label>
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-text-secondary">Validation happens in ChatLane before any add-on is installed.</span><Button onClick={save} disabled={busy !== null} isLoading={busy === 'save'}><Save className="mr-1 h-4 w-4" /> Save &amp; install</Button></div>
        </section>
      </div>
    </div>
  );
}
