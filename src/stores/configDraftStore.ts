import { create } from 'zustand';
import type { ConfigWorkspaceSnapshot } from '../types/configWorkspace';

interface ConfigDraft {
  snapshot: ConfigWorkspaceSnapshot | null;
  values: Record<string, string>;
  commands: string;
  launchOptions: string;
  accept: (snapshot: ConfigWorkspaceSnapshot, discard?: boolean) => void;
  setValues: (update: Record<string, string> | ((values: Record<string, string>) => Record<string, string>)) => void;
  setCommands: (commands: string) => void;
  setLaunchOptions: (launchOptions: string) => void;
}

/** Keep the original review token with a draft, including across route changes. */
export const useConfigDraftStore = create<ConfigDraft>((set, get) => ({
  snapshot: null, values: {}, commands: '', launchOptions: '',
  accept: (snapshot, discard = true) => {
    const current = get();
    const dirty = Object.keys(current.values).length > 0
      || current.commands !== (current.snapshot?.autoexecCommands.join('\n') ?? '')
      || current.launchOptions !== (current.snapshot?.launchOptions ?? '');
    if (!discard && dirty && current.snapshot?.workspaceId === snapshot.workspaceId) return;
    set({ snapshot, values: {}, commands: snapshot.autoexecCommands.join('\n'), launchOptions: snapshot.launchOptions });
  },
  setValues: update => set(current => ({ values: typeof update === 'function' ? update(current.values) : update })),
  setCommands: commands => set({ commands }),
  setLaunchOptions: launchOptions => set({ launchOptions }),
}));
