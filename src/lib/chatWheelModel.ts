export interface ChatWheelMenu {
  name: string;
  icon: string;
  items: string[];
}

export interface ChatWheelModel {
  name: string;
  menus: ChatWheelMenu[];
  /** Present only when the YAML carries an `override_bindable:` block; `{}` for an empty one. */
  overrideBindable?: Record<string, boolean>;
  /** Present only when the YAML carries an `override_ping_wheel_bindable:` block; `{}` for an empty one. */
  overridePingWheelBindable?: Record<string, boolean>;
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, '$2');
const quote = (value: string) => (/^[A-Za-z0-9 _.-]+$/.test(value) ? value : JSON.stringify(value));

const OVERRIDE_MAPS = {
  bindable: 'override_bindable',
  pingWheel: 'override_ping_wheel_bindable',
} as const;

/** An override entry line we own: indented `key: true|false` with an optional trailing comment. */
const ENTRY = /^(\s+)(\S.*?)(:\s+)(true|false)(\s*(?:#.*)?)$/;
/** A comment line can look like an entry (`  # note: true`); it is never one. */
const isComment = (line: string) => line.trim().startsWith('#');

const headerRe = (root: string) => new RegExp(`^${root}:\\s*(.*)$`);

/**
 * Serialize a key for a NEW override entry. Deliberately not `quote()`: that
 * helper excludes parentheses and apostrophes, so it would double-quote every
 * post-game command and break byte preservation for keys we do not own.
 * Reserved YAML 1.1 scalars are quoted because the loader's YAML version is
 * unverified and `Yes`/`No` are real command ids there.
 */
function overrideKey(key: string): string {
  const plain = /^[A-Za-z0-9(]([A-Za-z0-9 _.'()/-]*[A-Za-z0-9_.')-])?$/.test(key);
  const reserved = /^(?:y|n|yes|no|true|false|on|off|null|~)$/i.test(key);
  const numeric = /^[0-9]+(?:\.[0-9]+)?$/.test(key);
  return plain && !reserved && !numeric ? key : JSON.stringify(key);
}

/**
 * The exclusive end of a block that starts at `start`: one past the last
 * INDENTED NON-BLANK line. Indented comments stay inside (customMenusBlock
 * emits one as a placeholder), while column-0 trailing comments and the
 * file-final blank line stay outside and survive a splice.
 */
function blockEnd(lines: string[], start: number): number {
  let end = start + 1;
  let last = start + 1;
  while (end < lines.length && (!/^\S/.test(lines[end]) || lines[end].startsWith('#'))) {
    if (/^\s+\S/.test(lines[end])) last = end + 1;
    end += 1;
  }
  return last;
}

function parseOverrideMap(lines: string[], root: string): Record<string, boolean> | undefined {
  const re = headerRe(root);
  const start = lines.findIndex((line) => re.test(line));
  if (start === -1) return undefined;
  const rest = (lines[start].match(re)?.[1] ?? '').replace(/\s*#.*$/, '').trim();
  const map: Record<string, boolean> = {};
  if (rest !== '') return map;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && !line.startsWith('#')) break;
    const entry = isComment(line) ? null : line.match(ENTRY);
    if (entry) map[unquote(entry[2])] = entry[4] === 'true';
  }
  return map;
}

/**
 * Read the small, documented ChatLane surface used by the form editor. This is
 * intentionally not a general YAML parser: Advanced YAML remains the source of
 * truth and all text outside the fields owned below is retained byte-for-byte.
 */
export function parseChatWheelYaml(yaml: string): ChatWheelModel {
  const lines = yaml.replace(/\r\n/g, '\n').split('\n');
  const name = lines.find((line) => /^name:\s*/.test(line))?.replace(/^name:\s*/, '') ?? '';
  const menus: ChatWheelMenu[] = [];
  const overrideBindable = parseOverrideMap(lines, OVERRIDE_MAPS.bindable);
  const overridePingWheelBindable = parseOverrideMap(lines, OVERRIDE_MAPS.pingWheel);
  const model = (): ChatWheelModel => {
    const built: ChatWheelModel = { name: unquote(name), menus };
    if (overrideBindable) built.overrideBindable = overrideBindable;
    if (overridePingWheelBindable) built.overridePingWheelBindable = overridePingWheelBindable;
    return built;
  };
  const start = lines.findIndex((line) => /^custom_menus:\s*(?:#.*)?$/.test(line));
  if (start === -1) return model();

  let menu: ChatWheelMenu | undefined;
  let inItems = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && !line.startsWith('#')) break;
    const menuName = line.match(/^\s{2}-\s+name:\s*(.+?)\s*$/);
    if (menuName) {
      menu = { name: unquote(menuName[1]), icon: '', items: [] };
      menus.push(menu);
      inItems = false;
      continue;
    }
    if (!menu) continue;
    const icon = line.match(/^\s{4}icon:\s*(.+?)\s*$/);
    if (icon) {
      menu.icon = unquote(icon[1]);
      continue;
    }
    if (/^\s{4}items:\s*(?:#.*)?$/.test(line)) {
      inItems = true;
      continue;
    }
    const item = line.match(/^\s{6}-\s+(.+?)\s*$/);
    if (inItems && item) menu.items.push(unquote(item[1]));
  }
  return model();
}

function customMenusBlock(menus: ChatWheelMenu[]): string[] {
  return [
    'custom_menus:',
    ...menus.flatMap((menu) => [
      `  - name: ${quote(menu.name || 'Untitled menu')}`,
      `    icon: ${quote(menu.icon || 'quick')}`,
      '    items:',
      ...(menu.items.length ? menu.items.map((item) => `      - ${quote(item)}`) : ['      # Add a command below']),
    ]),
  ];
}

const overrideEntryLines = (map: Record<string, boolean>) =>
  Object.keys(map).map((key) => `  ${overrideKey(key)}: ${map[key] ? 'true' : 'false'}`);

/**
 * Write one override map back in place. Entry lines we did not parse (odd
 * casing, comments, anchors) are outside the model's ownership: they are never
 * rewritten and never deleted, and a changed entry keeps its original key text.
 */
function applyOverrideBlock(lines: string[], root: string, desired: Record<string, boolean> | undefined): void {
  const re = headerRe(root);
  const start = lines.findIndex((line) => re.test(line));

  if (start === -1) {
    if (!desired) return;
    let at = lines.length;
    while (at > 0 && lines[at - 1] === '') at -= 1;
    const keys = Object.keys(desired);
    const block = keys.length ? [`${root}:`, ...overrideEntryLines(desired)] : [`${root}: {}`];
    lines.splice(at, 0, ...(at > 0 ? [''] : []), ...block);
    return;
  }

  const rest = (lines[start].match(re)?.[1] ?? '').replace(/\s*#.*$/, '').trim();
  const inline = rest !== '';
  const end = inline ? start + 1 : blockEnd(lines, start);

  if (!desired) {
    lines.splice(start, end - start);
    return;
  }

  if (inline) {
    const keys = Object.keys(desired);
    if (!keys.length) return;
    lines.splice(start, 1, `${root}:`, ...overrideEntryLines(desired));
    return;
  }

  const header = lines[start];
  const body: string[] = [];
  const seen = new Set<string>();
  let lastEntry = -1;
  let preserved = false;
  for (const line of lines.slice(start + 1, end)) {
    const entry = isComment(line) ? null : line.match(ENTRY);
    if (!entry) {
      body.push(line);
      if (line.trim() !== '') preserved = true;
      continue;
    }
    const key = unquote(entry[2]);
    if (!(key in desired)) continue;
    seen.add(key);
    body.push(`${entry[1]}${entry[2]}${entry[3]}${desired[key] ? 'true' : 'false'}${entry[5]}`);
    lastEntry = body.length - 1;
  }

  const added = Object.keys(desired).filter((key) => !seen.has(key));
  if (added.length) {
    const at = lastEntry >= 0 ? lastEntry + 1 : body.length;
    body.splice(at, 0, ...overrideEntryLines(Object.fromEntries(added.map((key) => [key, desired[key]]))));
  }

  if (!body.some((line) => !isComment(line) && ENTRY.test(line)) && !preserved) {
    lines.splice(start, end - start, `${root}: {}`);
    return;
  }
  lines.splice(start, end - start, header, ...body);
}

/** Apply form changes while leaving unknown root fields and comments untouched. */
export function updateChatWheelYaml(yaml: string, model: ChatWheelModel): string {
  const lines = yaml.replace(/\r\n/g, '\n').split('\n');
  const nameIndex = lines.findIndex((line) => /^name:\s*/.test(line));
  if (nameIndex >= 0) lines[nameIndex] = `name: ${quote(model.name || 'My Chat Wheel')}`;
  else lines.unshift(`name: ${quote(model.name || 'My Chat Wheel')}`);

  const start = lines.findIndex((line) => /^custom_menus:\s*(?:#.*)?$/.test(line));
  const block = customMenusBlock(model.menus);
  if (start < 0) {
    if (lines.length && lines.at(-1) !== '') lines.push('');
    lines.push(...block);
  } else {
    lines.splice(start, blockEnd(lines, start) - start, ...block);
  }

  applyOverrideBlock(lines, OVERRIDE_MAPS.bindable, model.overrideBindable);
  applyOverrideBlock(lines, OVERRIDE_MAPS.pingWheel, model.overridePingWheelBindable);
  return lines.join('\n');
}

export type OverrideState = 'inherit' | 'on' | 'off';

/** Three-state read of one command's override: no entry means it inherits the game default. */
export function overrideStateFor(map: Record<string, boolean> | undefined, id: string): OverrideState {
  if (!map || !(id in map)) return 'inherit';
  return map[id] ? 'on' : 'off';
}

/**
 * Set or clear one override entry. Never mutates its input. Clearing the last
 * key leaves an empty map (a present, empty block), never `undefined`: absent
 * and empty are different states in the wire format.
 */
export function applyOverride(
  model: ChatWheelModel,
  map: keyof typeof OVERRIDE_MAPS,
  id: string,
  state: OverrideState,
): ChatWheelModel {
  const current = map === 'bindable' ? model.overrideBindable : model.overridePingWheelBindable;
  let next: Record<string, boolean> | undefined;
  if (state === 'inherit') {
    if (!current) return { ...model };
    next = { ...current };
    delete next[id];
  } else {
    next = { ...(current ?? {}) };
    next[id] = state === 'on';
  }
  return map === 'bindable' ? { ...model, overrideBindable: next } : { ...model, overridePingWheelBindable: next };
}
