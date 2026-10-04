import { createHash } from 'crypto';
import { existsSync, readFileSync, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { CONFIG_KEY_INDEX, CONFIG_KEY_BY_NAME } from './configKeyIndex';
import { getGameinfoPath } from './deadlock';
import { getAutoexecPath, getManualAutoexecCommands, readAutoexec, writeAutoexec } from './autoexec';
import { getPerformanceConfigStatus, setConfigConvars, validateConfigConvars } from './performanceConfig';
import { loadSettings, saveSettings } from './settings';
import { runExclusiveModMutation } from './mods';
import { createRecoveryJournal, journalRecoveryPaths, journalLaunchOptions, beginRecoveryMutation, clearRecoveryJournal } from './recoveryJournal';
import { retainRecoveryFile, placeRecoveryFile } from './recoveryBackup';
import type { ConfigBundle, ConfigUnknownEntry, ConfigWorkspaceSnapshot, ConfigWorkspaceUpdate } from '../../../src/types/configWorkspace';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 1024 * 1024;

function readOptional(path: string): string | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path);
  if (content.length > MAX_FILE_BYTES) throw new Error('Configuration exceeds the workspace size limit.');
  return content.toString('utf8');
}

/** Read top-level ConVars only, ignoring nested constraints and quoted braces. */
export function readGameinfoConvars(text: string): ConfigUnknownEntry[] {
  const tokens: Array<{ value: string; line: number; quoted: boolean }> = [];
  const expression = /\/\/[^\n]*|"((?:\\.|[^"\\])*)"|([{}])|([^\s{}"]+)/g;
  let match: RegExpExecArray | null;
  let line = 1;
  let previous = 0;
  while ((match = expression.exec(text))) {
    line += (text.slice(previous, match.index).match(/\n/g) ?? []).length;
    previous = expression.lastIndex;
    if (match[0].startsWith('//')) continue;
    tokens.push({ value: match[1] ?? match[2] ?? match[3], line, quoted: match[1] !== undefined });
  }
  const start = tokens.findIndex((token, index) => token.value === 'ConVars' && tokens[index + 1]?.value === '{');
  if (start < 0) return [];
  const result: ConfigUnknownEntry[] = [];
  let depth = 0;
  for (let i = start + 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.quoted && token.value === '{') { depth++; continue; }
    if (!token.quoted && token.value === '}') { if (depth-- === 0) break; continue; }
    const value = tokens[i + 1];
    if (depth === 0 && value && (value.quoted || !['{', '}'].includes(value.value))) {
      result.push({ key: token.value, value: value.value, line: token.line, file: 'gameinfo.gi' });
      i++;
    }
  }
  return result;
}

function unknownAutoexec(text: string): ConfigUnknownEntry[] {
  return text.split('\n').flatMap((raw, index) => {
    const match = /^\s*"?([A-Za-z_][\w.]*)"?\s+("[^"]*"|[^\s;]+)\s*(?:\/\/.*)?$/.exec(raw);
    if (!match || CONFIG_KEY_BY_NAME.has(match[1])) return [];
    return [{ key: match[1], value: match[2].replace(/^"|"$/g, ''), file: 'autoexec.cfg' as const, line: index + 1 }];
  });
}

export function getConfigWorkspace(deadlockPath: string | null): ConfigWorkspaceSnapshot {
  const performance = getPerformanceConfigStatus(deadlockPath);
  const launchOptions = loadSettings().steamLaunchOptions ?? '';
  const gameinfo = deadlockPath ? readOptional(getGameinfoPath(deadlockPath)) : null;
  const autoexec = deadlockPath ? readOptional(getAutoexecPath(deadlockPath)) : null;
  const sidecar = deadlockPath ? readOptional(join(dirname(getGameinfoPath(deadlockPath)), 'grimoire-performance.json')) : null;
  const data = deadlockPath ? readAutoexec(deadlockPath) : null;
  const reviewToken = createHash('sha256').update(JSON.stringify({ deadlockPath, gameinfo, autoexec, sidecar, launchOptions })).digest('hex');
  return {
    workspaceId: createHash('sha256').update(deadlockPath ?? '').digest('hex'),
    available: !!deadlockPath && gameinfo !== null && performance.state !== 'error', reviewToken,
    definitions: CONFIG_KEY_INDEX, performance, launchOptions,
    unknown: [...readGameinfoConvars(gameinfo ?? '').filter(entry => !CONFIG_KEY_BY_NAME.has(entry.key)), ...unknownAutoexec(autoexec ?? '')],
    autoexecCommands: data?.commands ?? [], manualCommands: data ? getManualAutoexecCommands(data) : [],
  };
}

function validateCommands(commands: unknown): asserts commands is string[] {
  if (!Array.isArray(commands) || commands.length > 2000 || commands.some(command =>
    typeof command !== 'string' || !command.trim() || command.length > 2048 || /[\r\n\0]/.test(command) || /^\s*\/\//.test(command))) {
    throw new Error('Invalid autoexec command list.');
  }
}
function validateLaunchOptions(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 8192 || /[\r\n\0]/.test(value)) throw new Error('Invalid launch options.');
}

export function parseConfigBundle(text: string): ConfigBundle {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_BUNDLE_BYTES) throw new Error('Configuration bundle is too large.');
  const bundle = JSON.parse(text) as ConfigBundle;
  if (!bundle || bundle.format !== 'grimoire-config' || bundle.version !== 1 || Object.keys(bundle).some(key => !['format', 'version', 'gameinfo', 'autoexecCommands', 'launchOptions'].includes(key))) {
    throw new Error('Unsupported configuration bundle.');
  }
  bundle.gameinfo = validateConfigConvars(bundle.gameinfo);
  validateCommands(bundle.autoexecCommands);
  validateLaunchOptions(bundle.launchOptions);
  return bundle;
}

export function exportConfigBundle(snapshot: ConfigWorkspaceSnapshot): ConfigBundle {
  const gameinfo: Record<string, string> = {};
  for (const [key, state] of Object.entries(snapshot.performance.convarStates ?? {})) {
    if (state.value === null) continue;
    try { Object.assign(gameinfo, validateConfigConvars({ [key]: state.value })); } catch { /* Unsupported hand edits stay local. */ }
  }
  return { format: 'grimoire-config', version: 1, gameinfo, autoexecCommands: snapshot.autoexecCommands, launchOptions: snapshot.launchOptions };
}

/** Validate the entire write set before any file changes; preserve manual sections. */
export async function applyConfigWorkspace(deadlockPath: string | null, update: ConfigWorkspaceUpdate): Promise<ConfigWorkspaceSnapshot> {
  if (!deadlockPath) throw new Error('No Deadlock path configured.');
  if (!update || typeof update !== 'object') throw new Error('Invalid configuration request.');
  const gameinfo = update.gameinfo === undefined ? undefined : validateConfigConvars(update.gameinfo);
  if (update.autoexecCommands !== undefined) validateCommands(update.autoexecCommands);
  if (update.launchOptions !== undefined) validateLaunchOptions(update.launchOptions);
  return runExclusiveModMutation(async () => {
    const before = getConfigWorkspace(deadlockPath);
    if (!before.available || !update.reviewToken || update.reviewToken !== before.reviewToken) throw new Error('Configuration changed since review. Refresh and review again.');
    const gameinfoPath = getGameinfoPath(deadlockPath);
    const original = { gameinfo: readOptional(gameinfoPath), sidecar: readOptional(join(dirname(gameinfoPath), 'grimoire-performance.json')), autoexec: readOptional(getAutoexecPath(deadlockPath)) };
    const staging = await fs.mkdtemp(join(await fs.realpath(tmpdir()), 'grimoire-config-stage-'));
    let journalCreated = false;
    try {
      // Compute the whole write set away from the game before recording allowed bytes.
      const targets = [gameinfoPath, join(dirname(gameinfoPath), 'grimoire-performance.json'), getAutoexecPath(deadlockPath)];
      const staged = [getGameinfoPath(staging), join(dirname(getGameinfoPath(staging)), 'grimoire-performance.json'), getAutoexecPath(staging)];
      const originals = [original.gameinfo, original.sidecar, original.autoexec];
      for (let i = 0; i < staged.length; i++) if (originals[i] !== null) {
        await fs.mkdir(dirname(staged[i]), { recursive: true });
        await fs.writeFile(staged[i], originals[i]!);
      }
      if (gameinfo && Object.keys(gameinfo).length) {
        const result = setConfigConvars(staging, gameinfo);
        if (result.state === 'error') throw new Error(result.message);
      }
      if (update.autoexecCommands !== undefined) {
        const data = readAutoexec(staging); data.commands = update.autoexecCommands;
        writeAutoexec(staging, data);
      }
      if (getConfigWorkspace(deadlockPath).reviewToken !== before.reviewToken) throw new Error('Configuration changed during preparation. Review again.');
      const journal = await createRecoveryJournal(deadlockPath, loadSettings().activeProfileId ?? null);
      journalCreated = true;
      const writes: Array<{ target: string; hash: string | null; before: string | null }> = [];
      for (let i = 0; i < staged.length; i++) {
        const next = readOptional(staged[i]);
        if (next === originals[i]) continue;
        const hash = next === null ? null : await retainRecoveryFile(staged[i]);
        const previousHash = originals[i] === null ? null : createHash('sha256').update(originals[i]!).digest('hex');
        await journalRecoveryPaths(journal, [{ path: targets[i], hash: hash ?? undefined, expectedBefore: previousHash }]);
        writes.push({ target: targets[i], hash, before: originals[i] });
      }
      if (update.launchOptions !== undefined) await journalLaunchOptions(journal, before.launchOptions, update.launchOptions);
      await beginRecoveryMutation(journal);
      for (const write of writes) {
        const validate = async () => { if (readOptional(write.target) !== write.before) throw new Error('Configuration changed before placement'); };
        if (write.hash) await placeRecoveryFile(write.hash, write.target, validate);
        else { await validate(); await fs.unlink(write.target); }
      }
      if (update.launchOptions !== undefined) saveSettings({ ...loadSettings(), steamLaunchOptions: update.launchOptions });
      const result = getConfigWorkspace(deadlockPath);
      await clearRecoveryJournal();
      return result;
    } catch (error) {
      if (!journalCreated) throw new Error(`${String(error)}; previous configuration restored.`);
      // Use the journal's reviewed rollback so external edits are never overwritten.
      const { recoverInterruptedUnlocked } = await import('./profileRecovery');
      try { await recoverInterruptedUnlocked(deadlockPath); }
      catch (failure) { throw new Error(`${String(error)}; rollback incomplete: ${String(failure)}`); }
      throw new Error(`${String(error)}; previous configuration restored.`);
    } finally { await fs.rm(staging, { recursive: true, force: true }); }
  });
}
