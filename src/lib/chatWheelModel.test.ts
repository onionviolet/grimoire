import { describe, expect, it } from 'vitest';
import {
  applyOverride,
  overrideStateFor,
  parseChatWheelYaml,
  updateChatWheelYaml,
  type ChatWheelModel,
} from './chatWheelModel';

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

/**
 * The override maps are exercised against a hand-written fixture rather than
 * the vendored catalogue on purpose: parser compatibility with known AND
 * unknown ids must hold without the two modules being coupled.
 */
describe('chat wheel override maps', () => {
  const yaml = [
    '# keep this comment',
    'name: Wheel',
    'extra_option: keep-me',
    '',
    'override_bindable:',
    '  Good Game (Post Game) - All Chat: true',
    '  "Well Played (Post Game) - All Chat": true',
    "  You're Welcome: false",
    '  Totally Unknown Cmd: true',
    '  Weird Key: TRUE',
    '',
    'custom_menus:',
    '  - name: Calls',
    '    icon: quick',
    '    items:',
    '      - Help',
    '      - Thanks',
    '',
    '# trailing comment',
    '',
  ].join('\n');

  const starter = [
    '# A working ChatLane configuration for first-time users.',
    'name: My Chat Wheel',
    '',
    'override_bindable: {}',
    'override_ping_wheel_bindable: {}',
    '',
    'custom_menus:',
    '  - name: My Messages',
    '    icon: quick',
    '    items:',
    '      - On My Way',
    '      - Help',
    '',
  ].join('\n');

  const parsed = () => parseChatWheelYaml(yaml);
  const lines = (text: string) => text.split('\n');
  const diff = (before: string, after: string) =>
    lines(before).map((line, index) => [line, lines(after)[index]]).filter(([a, b]) => a !== b);

  it('parses a populated block, unquoting keys and reading booleans strictly', () => {
    expect(parsed().overrideBindable).toEqual({
      'Good Game (Post Game) - All Chat': true,
      'Well Played (Post Game) - All Chat': true,
      "You're Welcome": false,
      'Totally Unknown Cmd': true,
    });
    expect(Object.keys(parsed().overrideBindable ?? {})).toEqual([
      'Good Game (Post Game) - All Chat',
      'Well Played (Post Game) - All Chat',
      "You're Welcome",
      'Totally Unknown Cmd',
    ]);
  });

  it('distinguishes absent, empty and populated maps', () => {
    expect(parsed().overridePingWheelBindable).toBeUndefined();
    expect('overridePingWheelBindable' in parsed()).toBe(false);
    expect(parseChatWheelYaml(starter).overrideBindable).toEqual({});
    expect(parseChatWheelYaml(starter).overridePingWheelBindable).toEqual({});
  });

  it('round-trips an unedited file byte for byte', () => {
    const updated = updateChatWheelYaml(yaml, parsed());
    expect(updated).toBe(yaml);
  });

  it('leaves an absent ping wheel map absent', () => {
    expect(updateChatWheelYaml(yaml, parsed())).not.toContain('override_ping_wheel_bindable');
  });

  it('rewrites only the boolean token when one entry is toggled', () => {
    const model = parsed();
    const updated = updateChatWheelYaml(yaml, applyOverride(model, 'bindable', "You're Welcome", 'on'));
    expect(diff(yaml, updated)).toEqual([["  You're Welcome: false", "  You're Welcome: true"]]);
    expect(updated).toContain('  Weird Key: TRUE');
    expect(updated).toContain('# trailing comment');
    expect(updated.endsWith('\n')).toBe(true);
    expect(parseChatWheelYaml(updated).overrideBindable?.["You're Welcome"]).toBe(true);
  });

  it('never deletes a line the entry parser did not produce', () => {
    const model = parsed();
    const cleared: ChatWheelModel = { ...model, overrideBindable: {} };
    const updated = updateChatWheelYaml(yaml, cleared);
    expect(updated).toContain('override_bindable:');
    expect(updated).toContain('  Weird Key: TRUE');
    expect(updated).not.toContain('Totally Unknown Cmd');
    expect(parseChatWheelYaml(updated).overrideBindable).toEqual({});
  });

  it('appends a new entry after the last parsed entry line', () => {
    const model = parsed();
    const updated = updateChatWheelYaml(yaml, applyOverride(model, 'bindable', 'Flank', 'off'));
    const added = lines(updated).indexOf('  Flank: false');
    expect(added).toBe(lines(updated).indexOf('  Totally Unknown Cmd: true') + 1);
    expect(lines(updated).indexOf('  Weird Key: TRUE')).toBe(added + 1);
    expect(parseChatWheelYaml(updated).overrideBindable?.Flank).toBe(false);
  });

  it('quotes new keys a YAML 1.1 reader would resolve to a non-string', () => {
    const model = parsed();
    const withYesNo = applyOverride(applyOverride(model, 'bindable', 'Yes', 'on'), 'bindable', 'No', 'off');
    const updated = updateChatWheelYaml(yaml, withYesNo);
    expect(updated).toContain('  "Yes": true');
    expect(updated).toContain('  "No": false');
    expect(parseChatWheelYaml(updated).overrideBindable?.Yes).toBe(true);
    expect(parseChatWheelYaml(updated).overrideBindable?.No).toBe(false);
  });

  it('collapses a fully emptied block to {} and deletes an undefined map', () => {
    const simple = 'name: Wheel\noverride_bindable:\n  Flank: true\n\ncustom_menus:\n  - name: Calls\n    icon: quick\n    items:\n      - Help\n';
    const model = parseChatWheelYaml(simple);
    const emptied = updateChatWheelYaml(simple, { ...model, overrideBindable: {} });
    expect(emptied).toContain('override_bindable: {}');
    expect(emptied).not.toContain('Flank: true');
    expect(parseChatWheelYaml(emptied).overrideBindable).toEqual({});

    const removed = updateChatWheelYaml(simple, { ...model, overrideBindable: undefined });
    expect(removed).not.toContain('override_bindable');
    expect(parseChatWheelYaml(removed).overrideBindable).toBeUndefined();
  });

  it('creates a missing block at the end of the file', () => {
    const model = parsed();
    const updated = updateChatWheelYaml(yaml, applyOverride(model, 'pingWheel', 'Flank', 'on'));
    expect(updated).toContain('override_ping_wheel_bindable:\n  Flank: true');
    expect(parseChatWheelYaml(updated).overridePingWheelBindable).toEqual({ Flank: true });
    expect(parseChatWheelYaml(updated).menus).toEqual(model.menus);

    const empty = updateChatWheelYaml(yaml, { ...model, overridePingWheelBindable: {} });
    expect(empty).toContain('override_ping_wheel_bindable: {}');
  });

  it('expands an inline {} map only when an entry is added', () => {
    const model = parseChatWheelYaml(starter);
    const menuEdit = updateChatWheelYaml(starter, {
      ...model,
      menus: [{ ...model.menus[0], items: ['On My Way', 'Help', 'Thanks'] }],
    });
    expect(menuEdit).toContain('override_bindable: {}');
    expect(menuEdit).toContain('override_ping_wheel_bindable: {}');
    expect(menuEdit.endsWith('      - Thanks\n')).toBe(true);
    expect(diff(starter, menuEdit)).toEqual([['', '      - Thanks']]);

    const added = updateChatWheelYaml(starter, applyOverride(model, 'bindable', 'Flank', 'on'));
    expect(added).toContain('override_bindable:\n  Flank: true\n');
    expect(added).toContain('override_ping_wheel_bindable: {}');
    expect(parseChatWheelYaml(added).overrideBindable).toEqual({ Flank: true });
  });

  it('reads the three override states', () => {
    expect(overrideStateFor(undefined, 'Flank')).toBe('inherit');
    expect(overrideStateFor({}, 'Flank')).toBe('inherit');
    expect(overrideStateFor({ Flank: true }, 'Flank')).toBe('on');
    expect(overrideStateFor({ Flank: false }, 'Flank')).toBe('off');
  });

  it('applies the three override states without mutating the model', () => {
    const model = parseChatWheelYaml(starter);
    const on = applyOverride(model, 'bindable', 'Flank', 'on');
    expect(on.overrideBindable).toEqual({ Flank: true });
    expect(model.overrideBindable).toEqual({});

    const off = applyOverride(on, 'pingWheel', 'Flank', 'off');
    expect(off.overridePingWheelBindable).toEqual({ Flank: false });
    expect(off.overrideBindable).toEqual({ Flank: true });

    const cleared = applyOverride(off, 'bindable', 'Flank', 'inherit');
    expect(cleared.overrideBindable).toEqual({});
    expect(cleared.overrideBindable).toBeDefined();
    expect(on.overrideBindable).toEqual({ Flank: true });
  });

  it('creates a map on first override and leaves an absent map absent on inherit', () => {
    const model = parsed();
    expect(applyOverride(model, 'pingWheel', 'Flank', 'on').overridePingWheelBindable).toEqual({ Flank: true });
    expect(applyOverride(model, 'pingWheel', 'Flank', 'inherit').overridePingWheelBindable).toBeUndefined();
    expect(applyOverride(model, 'bindable', 'Never Set', 'inherit').overrideBindable).toEqual(model.overrideBindable);
    expect(Object.keys(applyOverride(model, 'bindable', 'Totally Unknown Cmd', 'inherit').overrideBindable ?? {})).toEqual([
      'Good Game (Post Game) - All Chat',
      'Well Played (Post Game) - All Chat',
      "You're Welcome",
    ]);
  });
});
