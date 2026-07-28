export interface ChatWheelMenu {
  name: string;
  icon: string;
  items: string[];
}

export interface ChatWheelModel {
  name: string;
  menus: ChatWheelMenu[];
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, '$2');
const quote = (value: string) => (/^[A-Za-z0-9 _.-]+$/.test(value) ? value : JSON.stringify(value));

/**
 * Read the small, documented ChatLane surface used by the form editor. This is
 * intentionally not a general YAML parser: Advanced YAML remains the source of
 * truth and all text outside the fields owned below is retained byte-for-byte.
 */
export function parseChatWheelYaml(yaml: string): ChatWheelModel {
  const lines = yaml.replace(/\r\n/g, '\n').split('\n');
  const name = lines.find((line) => /^name:\s*/.test(line))?.replace(/^name:\s*/, '') ?? '';
  const menus: ChatWheelMenu[] = [];
  const start = lines.findIndex((line) => /^custom_menus:\s*(?:#.*)?$/.test(line));
  if (start === -1) return { name: unquote(name), menus };

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
  return { name: unquote(name), menus };
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
    return lines.join('\n');
  }
  let end = start + 1;
  while (end < lines.length && (!/^\S/.test(lines[end]) || lines[end].startsWith('#'))) end += 1;
  lines.splice(start, end - start, ...block);
  return lines.join('\n');
}
