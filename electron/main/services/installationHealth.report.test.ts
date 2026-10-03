import { describe, expect, it, vi } from 'vitest';
import { buildReportText } from './diagnostics';

vi.mock('electron-log', () => ({ default: { transports: { file: { getFile: () => ({ path: '/missing/main.log' }) } } } }));
vi.mock('electron', () => ({ app: { getVersion: () => 'test', isPackaged: true } }));
vi.mock('./updater', () => ({ getInstallSource: () => 'test' }));
vi.mock('./syncService', () => ({ getSyncStatus: () => ({}), isSyncInProgress: () => false, needsSync: () => false }));
vi.mock('./modDatabase', () => ({ getModCount: () => 0 }));

describe('installation health diagnostic report', () => {
  it('redacts usernames and secrets in the serialized snapshot and user description', async () => {
    const snapshot = JSON.stringify({ gamePath: String.raw`C:\Users\Alice\Games\Deadlock`, issues: [{ modName: 'Skin by alice@example.com' }] });
    const report = await buildReportText(`Authorization: Bearer very-secret-token\n${snapshot}`);
    expect(report).not.toContain('Alice');
    expect(report).not.toContain('alice@example.com');
    expect(report).not.toContain('very-secret-token');
    expect(report).toContain('<user>');
    expect(report).toContain('<email>');
    expect(report).toContain('<token>');
  });
});
