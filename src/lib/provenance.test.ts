import { describe, expect, it } from 'vitest';
import { focusModPath } from './provenance';

function queryParams(path: string): URLSearchParams {
  const question = path.indexOf('?');
  return new URLSearchParams(question === -1 ? '' : path.slice(question + 1));
}

describe('focusModPath', () => {
  it('returns a root-relative path carrying an ordinary mod id in exactly one focusMod parameter', () => {
    const path = focusModPath('mod-123');
    expect(path.startsWith('/')).toBe(true);
    expect([...queryParams(path).entries()]).toEqual([['focusMod', 'mod-123']]);
  });

  it('percent-encodes a space, an ampersand or a question mark so the id survives a URLSearchParams round trip as one parameter', () => {
    const tricky = 'weird & id?';
    const path = focusModPath(tricky);
    expect([...queryParams(path).entries()]).toEqual([['focusMod', tricky]]);
  });

  it('cannot inject a second query parameter from an id that already looks like a query fragment', () => {
    const params = queryParams(focusModPath('modA=1&injected=true'));
    expect([...params.entries()].length).toBe(1);
    expect(params.get('injected')).toBeNull();
  });

  it('always returns a root-relative path with no scheme and no host, so no id can turn a provenance click into an off-app navigation', () => {
    const path = focusModPath('https://evil.example/path?q=1');
    expect(path.startsWith('/')).toBe(true);
    expect(path.startsWith('//')).toBe(false);
    expect(path).not.toContain('://');
  });

  it('returns a path with an empty parameter value for an empty id instead of throwing', () => {
    const path = focusModPath('');
    expect(path.startsWith('/')).toBe(true);
    expect(queryParams(path).get('focusMod')).toBe('');
  });
});
