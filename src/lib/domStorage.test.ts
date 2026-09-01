// @vitest-environment jsdom
// Guards the invariant `vitest.setup.ts` exists to keep, so a future Node or
// jsdom bump that breaks it fails here by name instead of scattering confusing
// failures across every storage-touching suite. It holds for different reasons
// on different runtimes: on Node 20 jsdom's own Storage is present, on Node 26
// the setup file repairs the shadow left by Node's native `localStorage`.
import { describe, expect, it, vi } from 'vitest';

describe('the jsdom storage environment', () => {
  it('exposes a usable localStorage', () => {
    expect(typeof localStorage).toBe('object');
    localStorage.clear();
    localStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
    localStorage.removeItem('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('backs it with a real Storage, so Storage.prototype spies reach it', () => {
    // Several suites assert failure handling by throwing from
    // `Storage.prototype`. A plain object stub would silently not be spied on
    // and those suites would assert nothing.
    expect(Object.getPrototypeOf(localStorage)).toBe(Storage.prototype);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => localStorage.getItem('k')).toThrow('denied');
    spy.mockRestore();
  });

  it('leaves the global assignable, because suites install their own stubs', () => {
    const original = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => 'stub' };
    expect((localStorage as unknown as { getItem: () => string }).getItem()).toBe('stub');
    (globalThis as { localStorage?: unknown }).localStorage = original;
    expect(Object.getPrototypeOf(localStorage)).toBe(Storage.prototype);
  });
});
