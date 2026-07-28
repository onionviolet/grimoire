import { describe, expect, it } from 'vitest';
import { parseChatWheelYaml, updateChatWheelYaml } from './chatWheelModel';

describe('chat wheel form model', () => {
  const yaml = '# keep this comment\nname: Wheel\nextra_option: keep-me\n\ncustom_menus:\n  - name: Calls\n    icon: quick\n    items:\n      - Help\n      - Thanks\n';

  it('reads ChatLane menus and commands', () => {
    expect(parseChatWheelYaml(yaml)).toEqual({ name: 'Wheel', menus: [{ name: 'Calls', icon: 'quick', items: ['Help', 'Thanks'] }] });
  });

  it('updates owned fields without discarding unknown root text', () => {
    const next = updateChatWheelYaml(yaml, { name: 'Updated', menus: [{ name: 'Team', icon: 'ping', items: ['On my way'] }] });
    expect(next).toContain('# keep this comment');
    expect(next).toContain('extra_option: keep-me');
    expect(parseChatWheelYaml(next)).toEqual({ name: 'Updated', menus: [{ name: 'Team', icon: 'ping', items: ['On my way'] }] });
  });
});
