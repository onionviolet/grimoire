import { describe, expect, it } from 'vitest';
import {
  CHAT_WHEEL_COMMANDS,
  CHAT_WHEEL_COMMAND_COUNTS,
  findChatWheelCommand,
  type ChatWheelCommand,
} from './chatWheelCommands';

describe('chat wheel command catalogue', () => {
  it('vendors exactly the 53 VC_LIST entries', () => {
    expect(CHAT_WHEEL_COMMANDS).toHaveLength(53);
    expect(CHAT_WHEEL_COMMAND_COUNTS).toEqual({ all: 53, default: 33, hidden: 12, broken: 8 });
  });

  it('derives the counts from the array rather than hardcoding them', () => {
    const byCategory = (category: ChatWheelCommand['category']) =>
      CHAT_WHEEL_COMMANDS.filter((command) => command.category === category).length;
    expect(CHAT_WHEEL_COMMAND_COUNTS.all).toBe(CHAT_WHEEL_COMMANDS.length);
    expect(CHAT_WHEEL_COMMAND_COUNTS.default).toBe(byCategory('default'));
    expect(CHAT_WHEEL_COMMAND_COUNTS.hidden).toBe(byCategory('hidden'));
    expect(CHAT_WHEEL_COMMAND_COUNTS.broken).toBe(byCategory('broken'));
  });

  it('marks only the three submenu commands as menus', () => {
    expect(CHAT_WHEEL_COMMANDS.filter((command) => command.isMenu).map((command) => command.id)).toEqual([
      'Defend Lane',
      'Headed to Lane',
      'Push Lane',
    ]);
  });

  it('keeps every hidden command unbindable but ping-wheel available', () => {
    const hidden = CHAT_WHEEL_COMMANDS.filter((command) => command.category === 'hidden');
    expect(hidden).toHaveLength(12);
    expect(hidden.every((command) => !command.bindable && command.pingWheelBindable)).toBe(true);
  });

  it('keeps Missing as the odd broken entry that is still bindable', () => {
    const missing = findChatWheelCommand('Missing');
    expect(missing).toMatchObject({ category: 'broken', bindable: true, pingWheelBindable: true });
    const otherBroken = CHAT_WHEEL_COMMANDS.filter((command) => command.category === 'broken' && command.id !== 'Missing');
    expect(otherBroken).toHaveLength(7);
    expect(otherBroken.every((command) => !command.bindable && !command.pingWheelBindable)).toBe(true);
  });

  it('carries literal straight apostrophes in ids', () => {
    expect(findChatWheelCommand("You're Welcome")?.label).toBe('vc-item-youre_welcome');
    expect(findChatWheelCommand("I'll Clear Troopers")?.label).toBe('vc-item-ill_clear_troopers');
    expect(CHAT_WHEEL_COMMANDS.some((command) => /[\u2018\u2019]/.test(command.id))).toBe(false);
  });

  it('keeps ids unique and unnormalized', () => {
    expect(new Set(CHAT_WHEEL_COMMANDS.map((command) => command.id)).size).toBe(53);
    expect(findChatWheelCommand('Headed To Shop/Base')).toBeDefined();
  });

  it('looks up by exact display string only', () => {
    expect(findChatWheelCommand('Flank')).toMatchObject({ id: 'Flank', category: 'default', isMenu: false });
    expect(findChatWheelCommand('Not A Command')).toBeUndefined();
    expect(findChatWheelCommand(' flank ')).toBeUndefined();
    expect(findChatWheelCommand('flank')).toBeUndefined();
  });
});
