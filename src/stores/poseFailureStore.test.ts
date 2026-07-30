import { beforeEach, describe, expect, it } from 'vitest';
import { parseStoredBrokenSkins, usePoseFailureStore } from './poseFailureStore';

const STORAGE_KEY = 'grimoire.locker.brokenPoseSkins';

// Tests run in the node environment (see vitest.config.ts), so the store's
// persistence needs a stand-in rather than a jsdom dependency for one file.
function installLocalStorage(): void {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

function reset(): void {
  installLocalStorage();
  usePoseFailureStore.setState({ broken: {} });
}

const state = () => usePoseFailureStore.getState();

describe('poseFailureStore', () => {
  beforeEach(reset);

  it('records the skins a hero failed to pose with', () => {
    state().markBroken('Abrams', ['meta-a', 'meta-b'], 1000);

    expect(state().broken['meta-a']).toEqual({ heroName: 'Abrams', at: 1000 });
    expect(state().broken['meta-b']).toEqual({ heroName: 'Abrams', at: 1000 });
  });

  // The badge has to outlive the panel: the failure is only ever discovered
  // while the viewer is open, so a mark lost on navigation is never seen.
  it('persists marks so the badge survives a reload', () => {
    state().markBroken('Ivy', ['meta-a'], 1000);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      'meta-a': { heroName: 'Ivy', at: 1000 },
    });
  });

  it('heals a mark once the skin poses again', () => {
    state().markBroken('Ivy', ['meta-a', 'meta-b'], 1000);
    state().clearBroken(['meta-a']);

    expect(state().broken['meta-a']).toBeUndefined();
    expect(state().broken['meta-b']).toBeDefined();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      'meta-b': { heroName: 'Ivy', at: 1000 },
    });
  });

  // Every card render reads this map, so a no-op write that returned a new
  // object would re-render the whole grid on each pose attempt.
  it('keeps the same map identity when nothing actually changes', () => {
    state().markBroken('Ivy', ['meta-a'], 1000);
    const first = state().broken;

    state().markBroken('Ivy', ['meta-a'], 2000);
    expect(state().broken).toBe(first);

    state().clearBroken(['never-marked']);
    expect(state().broken).toBe(first);
  });

  it('drops malformed stored entries rather than rendering junk badges', () => {
    const parsed = parseStoredBrokenSkins(
      JSON.stringify({
        good: { heroName: 'Seven', at: 5 },
        missingAt: { heroName: 'Seven' },
        wrongType: { heroName: 7, at: 5 },
        nulled: null,
      })
    );

    expect(parsed).toEqual({ good: { heroName: 'Seven', at: 5 } });
  });

  it('survives absent, corrupt, or wrong-shaped storage', () => {
    expect(parseStoredBrokenSkins(null)).toEqual({});
    expect(parseStoredBrokenSkins('not json{')).toEqual({});
    expect(parseStoredBrokenSkins('[1,2,3]')).toEqual({});
  });
});
