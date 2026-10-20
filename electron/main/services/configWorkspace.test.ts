import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as autoexec from './autoexec';
import { applyPerformanceConfig, getPerformanceConfigStatus, validateConfigConvars } from './performanceConfig';
import { applyConfigWorkspace, exportConfigBundle, getConfigWorkspace, parseConfigBundle, readGameinfoConvars } from './configWorkspace';
const settings = vi.hoisted(() => ({ value: { steamLaunchOptions: '-old', unrelated: 7 } }));
const disk = vi.hoisted(() => ({ failSidecar: false }));
vi.mock('fs', async original => {
  const actual = await original<typeof import('fs')>();
  return { ...actual, renameSync: (from: import('fs').PathLike, to: import('fs').PathLike) => {
    if (disk.failSidecar && String(to).endsWith('grimoire-performance.json')) throw new Error('simulated sidecar failure');
    return actual.renameSync(from, to);
  } };
});
vi.mock('./settings', () => ({ loadSettings: () => ({ ...settings.value }), saveSettings: (next: typeof settings.value) => { settings.value = next; } }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => join(root, 'userdata') }));
vi.mock('./mods', () => ({ runExclusiveModMutation: async (operation: () => unknown) => operation() }));
const stock = readFileSync(join(__dirname, '__fixtures__/stock-gameinfo.gi'), 'utf8');
let root: string;
let gameinfo: string;
beforeEach(() => {
  root = mkdtempSync(join(realpathSync(tmpdir()), 'grimoire-config-'));
  gameinfo = join(root, 'game/citadel/gameinfo.gi');
  mkdirSync(join(root, 'game/citadel/cfg'), { recursive: true });
  writeFileSync(gameinfo, stock);
  settings.value = { steamLaunchOptions: '-old', unrelated: 7 };
  disk.failSidecar = false;
});
afterEach(() => { vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });

describe('Config workspace ownership and review', () => {
  it('lists unknown ConVars without nested constraints, comments or quoted brace confusion', () => {
    const entries = readGameinfoConvars('GameInfo { ConVars {\n"custom_key" "} value" // comment\nrate { min 5 default 10 }\n// fake 2\nunknown 7\n} }');
    expect(entries).toEqual([
      { key: 'custom_key', value: '} value', line: 2, file: 'gameinfo.gi' },
      { key: 'unknown', value: '7', line: 5, file: 'gameinfo.gi' },
    ]);
  });
  it('rejects unknown keys and injected or invalid typed values before writing', async () => {
    const snapshot = getConfigWorkspace(root);
    expect(() => validateConfigConvars({ unsafe_unknown: '1' })).toThrow();
    expect(() => validateConfigConvars({ minimap_update_rate_hz: '10000' })).toThrow();
    expect(() => validateConfigConvars({ citadel_unit_status_use_new: 'true"\n}' })).toThrow();
    await expect(applyConfigWorkspace(root, { reviewToken: snapshot.reviewToken, gameinfo: { minimap_update_rate_hz: '10000' }, launchOptions: '-new' })).rejects.toThrow();
    expect(readFileSync(gameinfo, 'utf8')).toBe(stock);
    expect(settings.value.steamLaunchOptions).toBe('-old');
  });
  it('rejects a stale file review without touching the settings', async () => {
    const snapshot = getConfigWorkspace(root);
    writeFileSync(gameinfo, stock + '\n// manual edit\n');
    await expect(applyConfigWorkspace(root, { reviewToken: snapshot.reviewToken, launchOptions: '-new' })).rejects.toThrow('changed since review');
    expect(settings.value.steamLaunchOptions).toBe('-old');
  });
  it('uses existing writers and preserves manual config/crosshair and unrelated settings', async () => {
    writeFileSync(autoexec.getAutoexecPath(root), '// my header\necho "Mod Manager initialized"\ncustom_manual 3\n' + autoexec.CROSSHAIR_START + '\ncitadel_crosshair_dot_opacity 1\n' + autoexec.CROSSHAIR_END + '\n');
    const snapshot = getConfigWorkspace(root);
    const next = await applyConfigWorkspace(root, { reviewToken: snapshot.reviewToken, gameinfo: { minimap_update_rate_hz: '25' }, autoexecCommands: ['fps_max 180'], launchOptions: '-high' });
    expect(next.performance.convarStates?.minimap_update_rate_hz.value).toBe('25');
    expect(next.autoexecCommands).toEqual(['fps_max 180']);
    expect(next.manualCommands).toContain('custom_manual 3');
    expect(next.manualCommands).toContain('echo "Mod Manager initialized"');
    expect(readFileSync(autoexec.getAutoexecPath(root), 'utf8')).toContain('citadel_crosshair_dot_opacity 1');
    expect(settings.value).toEqual({ steamLaunchOptions: '-high', unrelated: 7 });
  });
  it('restores exact file and sidecar bytes when another writer fails', async () => {
    const before = getConfigWorkspace(root);
    vi.spyOn(autoexec, 'writeAutoexec').mockImplementation(() => { throw new Error('simulated disk failure'); });
    await expect(applyConfigWorkspace(root, { reviewToken: before.reviewToken, gameinfo: { minimap_update_rate_hz: '25' }, autoexecCommands: ['fps_max 180'] })).rejects.toThrow('previous configuration restored');
    expect(readFileSync(gameinfo, 'utf8')).toBe(stock);
    expect(existsSync(join(root, 'game/citadel/grimoire-performance.json'))).toBe(false);
    expect(existsSync(autoexec.getAutoexecPath(root))).toBe(false);
  });
  it('exports only portable supported values and imports with strict version/domain limits', async () => {
    const before = getConfigWorkspace(root);
    const after = await applyConfigWorkspace(root, { reviewToken: before.reviewToken, gameinfo: { minimap_update_rate_hz: '30' } });
    const bundle = exportConfigBundle(after);
    expect(parseConfigBundle(JSON.stringify(bundle))).toEqual(bundle);
    expect(JSON.stringify(bundle)).not.toContain(root);
    expect(() => parseConfigBundle(JSON.stringify({ ...bundle, version: 2 }))).toThrow('Unsupported');
    expect(() => parseConfigBundle(JSON.stringify({ ...bundle, autoexecCommands: ['echo one\nexec other'] }))).toThrow();
    expect(() => parseConfigBundle(JSON.stringify({ ...bundle, gameinfo: { invented: '5' } }))).toThrow();
  });
  it('preserves the applied preset version during direct edits', async () => {
    const applied = applyPerformanceConfig(root, { presetId: 'sqooky-default', version: '3.3' });
    if (applied.state !== 'applied') throw new Error(applied.message);
    expect(applied.appliedVersion).toBe('3.3');
    const before = getConfigWorkspace(root);
    await applyConfigWorkspace(root, { reviewToken: before.reviewToken, gameinfo: { minimap_update_rate_hz: '25' } });
    expect(getPerformanceConfigStatus(root).appliedVersion).toBe(applied.appliedVersion);
  });
  it('applies an explicitly edited opt-in without enabling unrelated gameplay options', async () => {
    applyPerformanceConfig(root, { presetId: 'sqooky-default', optIns: [] });
    const before = getConfigWorkspace(root);
    const after = await applyConfigWorkspace(root, { reviewToken: before.reviewToken, gameinfo: { citadel_trooper_glow_disabled: '1' } });
    expect(after.performance.convarStates?.citadel_trooper_glow_disabled.value).toBe('1');
    expect(after.performance.appliedOptIns).toEqual(['citadel_trooper_glow_disabled']);
  });
  it('rolls back a gameinfo write if its standing-state sidecar cannot persist', async () => {
    const before = getConfigWorkspace(root);
    disk.failSidecar = true;
    await expect(applyConfigWorkspace(root, { reviewToken: before.reviewToken, gameinfo: { minimap_update_rate_hz: '25' }, autoexecCommands: ['fps_max 180'], launchOptions: '-new' })).rejects.toThrow('sidecar failure');
    expect(readFileSync(gameinfo, 'utf8')).toBe(stock);
    expect(existsSync(autoexec.getAutoexecPath(root))).toBe(false);
    expect(settings.value.steamLaunchOptions).toBe('-old');
  });
});
