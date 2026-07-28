import { describe, expect, it } from 'vitest';
import { getGameBananaImportHandoff, parseGameBananaImportHandoff } from './browserImportHandoff';

describe('GameBanana browser import handoffs', () => {
  it('routes recognized item pages through Browse without starting a download', () => {
    expect(getGameBananaImportHandoff('https://gamebanana.com/mods/610813?ref=browser')).toEqual({
      item: { id: 610813, section: 'Mod' },
      route: '/browse?item=Mod%3A610813',
    });
  });

  it('does not offer a handoff for direct downloads or unrecognized pages', () => {
    expect(getGameBananaImportHandoff('https://gamebanana.com/mods/download/610813')).toBeNull();
    expect(getGameBananaImportHandoff('https://example.com/mods/610813')).toBeNull();
  });

  it('accepts only the query values this app can safely open', () => {
    expect(parseGameBananaImportHandoff('Sound:123')).toEqual({ id: 123, section: 'Sound' });
    expect(parseGameBananaImportHandoff('Collection:123')).toBeNull();
    expect(parseGameBananaImportHandoff('Mod:0')).toBeNull();
  });
});
