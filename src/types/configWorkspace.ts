import type { ConfigKeyDefinition, PerformanceConfigStatus } from './electron';

export interface ConfigUnknownEntry {
  key: string;
  value: string;
  file: 'gameinfo.gi' | 'autoexec.cfg';
  line: number;
}

export interface ConfigWorkspaceSnapshot {
  workspaceId?: string;
  available: boolean;
  reviewToken: string;
  definitions: readonly ConfigKeyDefinition[];
  performance: PerformanceConfigStatus;
  unknown: ConfigUnknownEntry[];
  autoexecCommands: string[];
  manualCommands: string[];
  launchOptions: string;
}

/** Config bundles contain requested values, never paths or account credentials. */
export interface ConfigBundle {
  format: 'grimoire-config';
  version: 1;
  gameinfo: Record<string, string>;
  autoexecCommands: string[];
  launchOptions: string;
}

export interface ConfigWorkspaceUpdate {
  reviewToken: string;
  gameinfo?: Record<string, string>;
  autoexecCommands?: string[];
  launchOptions?: string;
}
