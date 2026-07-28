import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Power, Trash2, Volume2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { Mod } from '../../types/mod';

function scopeFor(mod: Mod): string {
  return mod.lockerHero?.trim() || (mod.soundSwap?.heroCodename ? mod.soundSwap.heroCodename : 'Global sounds');
}

/**
 * A deliberately thin view over the normal installed-mod store. It does not
 * maintain its own enabled flag: toggling here calls the same action used by
 * the Locker, preventing the two surfaces from drifting apart.
 */
export default function MySoundChanges() {
  const mods = useAppStore((state) => state.mods);
  const toggleMod = useAppStore((state) => state.toggleMod);
  const deleteMod = useAppStore((state) => state.deleteMod);
  const editLocalMod = useAppStore((state) => state.editLocalMod);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<Record<string, string>>({});
  const changes = useMemo(() => mods.filter((mod) => Boolean(mod.soundSwap)), [mods]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Mod[]>();
    for (const mod of changes) {
      const scope = scopeFor(mod);
      grouped.set(scope, [...(grouped.get(scope) ?? []), mod]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [changes]);

  if (!changes.length) return <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">No Foundry sound changes yet. Forged sound swaps will appear here and follow their normal Installed state.</p>;
  return <div className="space-y-3">
    {groups.map(([scope, entries]) => <section key={scope} className="rounded-sm border border-border">
      <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-text-primary">{scope}</h3>
      {entries.map((mod) => {
        const editing = open[mod.id];
        const value = rename[mod.id] ?? mod.name;
        return <div key={mod.id} className="border-b border-border/60 px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-accent" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-text-primary">{mod.soundSwap?.event}</p><p className="truncate text-[11px] text-text-secondary">{mod.name} · {mod.soundSwap?.audioFileName} · {mod.soundSwap?.pool}</p></div>
            <span className={`text-[11px] ${mod.enabled ? 'text-green-400' : 'text-text-secondary'}`}>{mod.enabled ? 'Enabled' : 'Disabled'}</span>
            <button type="button" onClick={() => void toggleMod(mod.id)} title={mod.enabled ? 'Disable' : 'Enable'} className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"><Power size={13} /></button>
            <button type="button" onClick={() => setOpen((current) => ({ ...current, [mod.id]: !editing }))} title="Rename" className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary">{editing ? <ChevronDown size={13} /> : <Pencil size={13} />}</button>
            <button type="button" onClick={() => { if (window.confirm(`Delete ${mod.name}?`)) void deleteMod(mod.id); }} title="Delete" className="rounded-sm border border-border p-1.5 text-red-300 hover:text-red-200"><Trash2 size={13} /></button>
          </div>
          {editing && <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const name = value.trim(); if (name) void editLocalMod(mod.id, { name }).then(() => setOpen((current) => ({ ...current, [mod.id]: false }))); }}><input aria-label="Sound change name" value={value} onChange={(event) => setRename((current) => ({ ...current, [mod.id]: event.target.value }))} className="min-w-0 flex-1 rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary" /><button className="rounded-sm bg-accent px-2 text-sm text-bg-primary">Save</button></form>}
        </div>;
      })}
    </section>)}
  </div>;
}
