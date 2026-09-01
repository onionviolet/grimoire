import type { Mod } from '../types/mod';

/**
 * A chat wheel add-on is the VPK the Chat Wheel page writes through
 * `chat-wheel:save`, which stamps `sourceSection: 'ChatWheel'` on its metadata.
 * That is the only field the renderer-side `Mod` carries for it (the sidecar's
 * `chatWheel: true` never crosses IPC), so every surface that needs to know
 * asks here rather than comparing the string itself.
 */
export function isChatWheelAddon(mod: Pick<Mod, 'sourceSection'>): boolean {
  return mod.sourceSection === 'ChatWheel';
}

export function chatWheelAddonsIn<T extends Pick<Mod, 'sourceSection'>>(mods: readonly T[]): T[] {
  return mods.filter(isChatWheelAddon);
}
