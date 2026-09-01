import type { TFunction } from 'i18next';
import type { ConfirmFn } from '../common/confirmContext';
import type { Mod } from '../../types/mod';
import { chatWheelAddonsIn } from '../../lib/chatWheelAddon';

/**
 * The gate in front of removing a chat wheel add-on.
 *
 * Deadlock binds a custom menu to the add-on that defines it. If the add-on is
 * gone while the binding is still in the game's Chat Wheel settings, opening
 * the chat wheel or the settings screen can crash the game, and nothing in
 * Grimoire can undo that binding: only the game's own settings can. So the
 * user has to be told before the file is deleted, not after.
 *
 * Resolves `true` without showing anything when none of `mods` is a chat wheel
 * add-on, so ordinary removals keep their existing flow; otherwise it resolves
 * to the user's answer. Both the Chat Wheel page and the Installed page route
 * through here so the copy cannot drift between them.
 */
export async function confirmChatWheelUnbind(
  confirm: ConfirmFn,
  t: TFunction,
  mods: readonly Pick<Mod, 'name' | 'sourceSection'>[]
): Promise<boolean> {
  const addons = chatWheelAddonsIn(mods);
  if (addons.length === 0) return true;
  return confirm({
    title: t('chatWheel.unbind.title', { count: addons.length }),
    message: t('chatWheel.unbind.message', { count: addons.length }),
    items: addons.map((addon) => addon.name),
    confirmLabel: t('chatWheel.unbind.confirm', { count: addons.length }),
    variant: 'danger',
  });
}
