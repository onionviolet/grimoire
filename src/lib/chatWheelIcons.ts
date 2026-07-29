/**
 * The chat-wheel icon set ChatLane accepts for a custom menu's `icon:` field.
 *
 * The names and artwork are vendored from RedMser/ChatLane (MIT,
 * `GUI/autoload/icon_db.gd` + `GUI/ping_icons/`), the same converter whose CLI
 * builds our VPKs, so the picker can only offer what the wheel can actually
 * show. ChatLane renders any unknown name as "no icon" rather than failing,
 * which is why free-text values remain allowed everywhere: this list drives
 * suggestions and previews, never validation.
 */
import defend from '../assets/chatlane-icons/defend.svg';
import goingIn from '../assets/chatlane-icons/going_in.svg';
import groupUp from '../assets/chatlane-icons/group_up.svg';
import heal from '../assets/chatlane-icons/heal.svg';
import heart from '../assets/chatlane-icons/heart.svg';
import help from '../assets/chatlane-icons/help.svg';
import question from '../assets/chatlane-icons/question.svg';
import quick from '../assets/chatlane-icons/quick.svg';
import retreat from '../assets/chatlane-icons/retreat.svg';
import shop from '../assets/chatlane-icons/shop.svg';
import thanks from '../assets/chatlane-icons/thanks.svg';

export const CHAT_WHEEL_ICONS: ReadonlyArray<{ name: string; url: string }> = [
  { name: 'defend', url: defend },
  { name: 'going_in', url: goingIn },
  { name: 'group_up', url: groupUp },
  { name: 'heal', url: heal },
  { name: 'heart', url: heart },
  { name: 'help', url: help },
  { name: 'question', url: question },
  { name: 'quick', url: quick },
  { name: 'retreat', url: retreat },
  { name: 'shop', url: shop },
  { name: 'thanks', url: thanks },
];

/** The icon's image URL, or null for a name ChatLane would show as no icon. */
export function chatWheelIconUrl(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  return CHAT_WHEEL_ICONS.find((icon) => icon.name === trimmed)?.url ?? null;
}
