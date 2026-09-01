// Runs before every test file, in whatever environment that file declared.
//
// Node 26 added its own `localStorage` global. It is gated behind
// `--localstorage-file` and its getter returns `undefined` without that flag,
// and because vitest's jsdom environment makes `globalThis` serve as `window`,
// Node's getter occupies the slot jsdom would have installed its own Storage
// into. jsdom's instance is then unreachable: `window.localStorage`,
// `globalThis.localStorage`, and `document.defaultView.localStorage` are one
// property, and it is Node's. The result is that every storage-touching test
// fails on Node 26 and passes on Node 20, which is what CI runs. That split was
// invisible for a month because the failures were absorbed into a remembered
// baseline count. See .planning/WINDOWS.md entry 5.
//
// `sessionStorage` is not shadowed, because Node has no native one, so it is a
// genuine jsdom Storage: its methods come from `Storage.prototype`, which keeps
// `vi.spyOn(Storage.prototype, ...)` working the way the tests written against
// Node 20 expect. Nothing in src/ or electron/ uses `sessionStorage`, so
// pointing `localStorage` at it costs no isolation.
//
// This is a no-op on Node 20 and in the node environment.
if (typeof sessionStorage !== 'undefined' && typeof localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: sessionStorage,
    configurable: true,
    // Writable, because several suites install their own stub by assigning to
    // `globalThis.localStorage` and restore the original afterwards. Node's
    // native property was an accessor with a setter, so assignment worked; a
    // read-only data property here would break them.
    writable: true,
  });

  // The `Storage` that vitest publishes as a global is not the class backing
  // this instance: `Object.getPrototypeOf(sessionStorage) !== Storage.prototype`
  // even though both are named Storage. That matters because suites assert
  // failure handling with `vi.spyOn(Storage.prototype, 'getItem')`. Spying on
  // the wrong prototype does not throw, it just never applies, and a test that
  // expects a fallback value would then pass for the wrong reason: the fallback
  // is also what an empty store returns. Republish `Storage` from the live
  // instance so those spies reach the object under test.
  Object.defineProperty(globalThis, 'Storage', {
    value: Object.getPrototypeOf(sessionStorage).constructor,
    configurable: true,
    writable: true,
  });
}
