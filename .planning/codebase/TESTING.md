# Testing Patterns

**Analysis Date:** 2026-08-05

## Test Framework

**Runner:**
- Vitest 4.1.9
- Config: `vitest.config.ts`
- Environment: `node` (no DOM — both UI and main-process tests run in plain Node environment)

**Assertion Library:**
- Built-in Vitest assertions: `expect()`, `toEqual()`, `toBe()`, `toBeCloseTo()`, etc.
- No external assertion library (Chai, Jest matchers) — native Vitest only

**Run Commands:**
```bash
pnpm test                 # Run all tests once
pnpm test:watch          # Watch mode, re-run on file changes
pnpm exec vitest run     # Equivalent to pnpm test
```

## Test File Organization

**Location:**
- Co-located with source: `src/lib/clothMath.ts` → `src/lib/clothMath.test.ts`
- Same file structure for electron main-process tests: `electron/main/services/vpkIdentity.ts` → `electron/main/services/vpkIdentity.test.ts`

**Naming:**
- `*.test.ts` for TypeScript files
- `*.test.tsx` for React components (e.g., `src/components/common/HeroSelect.test.tsx`)
- Test file must have `.test` suffix (vitest glob pattern: `**/*.test.ts` and `**/*.test.tsx`)

**Coverage:**
- No enforced coverage target (none detected in config)
- Tests concentrated on complex logic: math libraries, data structure transformations, state management
- Pattern observed: ~80 test files covering `src/lib/` (3D math, parsing, state recovery), `electron/main/services/` (business logic), components (complex calculations only)

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from './module';

describe('functionUnderTest', () => {
  it('does something specific', () => {
    // Arrange
    const input = { /* setup */ };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });

  it('handles edge case', () => {
    expect(functionUnderTest(edge)).toThrow(Error);
  });
});
```

**Key Patterns:**
- `describe()` wraps related tests; typically one `describe` per function/component
- `it()` one behavioral assertion per test
- Arrange-Act-Assert structure implicit; no extra comments needed for simple cases
- Complex setup extracted to helpers (see Factory Functions below)

**Example** (from `src/lib/clothMath.test.ts`):
```typescript
describe('recoverSimilarity', () => {
  it('recovers a synthetic model-to-preview similarity', () => {
    const source: Vec3[] = [
      [1, 2, 3],
      [-1, 5, 2],
      [4, 0, 2],
      [3, 2, -2],
      [0, 1, 0],
      [2, -3, 1],
    ];
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -0.2, 0.6)).normalize();
    const scale = 0.0254;
    const translation = new THREE.Vector3(0.5, -1.25, 2.0);
    const matrix = new THREE.Matrix4().compose(translation, rotation, new THREE.Vector3(scale, scale, scale));
    const target = source.map((p) => {
      const v = new THREE.Vector3(...p).applyMatrix4(matrix);
      return [v.x, v.y, v.z] as Vec3;
    });

    const fit = recoverSimilarity(source, target);

    expect(fit.rmse).toBeLessThan(1e-9);
    expect(fit.scale).toBeCloseTo(scale, 10);
    for (let i = 0; i < source.length; i++) {
      const actual = new THREE.Vector3(...source[i]).applyMatrix4(fit.matrix);
      expect(actual.distanceTo(new THREE.Vector3(...target[i]))).toBeLessThan(1e-9);
    }
  });
});
```

## Parametrized Tests

**it.each() for variants:**
```typescript
it.each(['1.25.167', '1.25.167-beta.1', '1.25.167+build.42'])('accepts %s', (version) => {
  expect(isValidSemver(version)).toBe(true);
});

it.each(['1.25.1v67', 'v1.25.167', '1.25', '01.25.167'])('rejects %s', (version) => {
  expect(isValidSemver(version)).toBe(false);
});
```

From `electron/main/services/version.test.ts`: tests multiple inputs with same assertion pattern in a single `it.each()`.

## Fixtures and Factories

**Test Data Builders:**
- Factory functions create realistic test objects with minimal boilerplate
- Overrideable fields for test-specific customization

**Example** (from `src/lib/lockerUtils.test.ts`):
```typescript
function mod(over: Partial<Mod> & { id: string; metaKey: string; priority: number }): Mod {
  return {
    name: over.id,
    fileName: `pak${String(over.priority).padStart(2, '0')}_dir.vpk`,
    path: `/addons/${over.id}.vpk`,
    enabled: true,
    size: 0,
    installedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

// Usage in tests:
const global = mod({ id: 'g', metaKey: 'grimoire/pak99_dir.vpk', priority: 99 });
const base = mod({ id: 'b', metaKey: 'pak01_dir.vpk', priority: 1 });
```

**Fixture Data:**
- Large test fixtures defined inline with comments explaining context
- Example (from `src/lib/feModel.test.ts`): 40-line raw FeModel fixture with inline field explanations

**Location:**
- Fixtures stay in test files; no separate `fixtures/` directory (keeps related logic close)
- Reusable helpers extracted to test utilities if needed (none observed in current tests)

## Mocking

**Framework:**
- No external mocking library; Vitest provides `vi` but it's rarely used
- Manual mocks via factories and dependency injection preferred

**Patterns:**

**Manual Mocking via Overrides:**
```typescript
const mod = (over: Partial<Mod> & { id: string; ... }): Mod => {
  return { /* defaults */ ...over };
};
```

**I/O Mocking (IPC):**
- Electron tests run in Node environment; no actual IPC or file system calls in the test suite
- Tests mock the file system implicitly by not touching it; services tested in isolation
- Example: `electron/main/services/vpkIdentity.test.ts` tests VPK parsing without touching disk

**No `vi.mock()`:**
- Not observed in any test files; tests avoid mocking at the module level
- Instead: pass dependencies as parameters or use factories

**What to Mock:**
- External APIs: none observed; tests avoid network calls
- Electron app methods (e.g., `app.getPath()`) mocked where needed by not calling them (services accept paths as params)
- Time-based operations: if needed, use `vi.useFakeTimers()` (not observed in current tests)

**What NOT to Mock:**
- Core logic (math, parsing, state reconciliation)
- Data transformations
- Utility functions

## Async Testing

**Promise Handling:**
```typescript
it('handles async operations', async () => {
  const result = await functionReturningPromise();
  expect(result).toBe(expected);
});
```

**Not Observed:**
- `async/await` not used in most tests (heavy focus on pure logic)
- When needed, test functions marked `async` and await results
- No `setTimeout`, `beforeEach`, or `afterEach` hooks observed

## Error Testing

**Throwing Functions:**
```typescript
it('throws on invalid input', () => {
  expect(() => parseFeModel(null)).not.toThrow();
  expect(parseFeModel({})).toBeNull();
  expect(parseFeModel({ m_CtrlName: 'nope' })).toBeNull();
});
```

**Returning null on parse failure:**
```typescript
it('returns null for a non-FeModel payload', () => {
  expect(parseFeModel(null)).toBeNull();
  expect(parseFeModel({})).toBeNull();
});
```

**Explicit error messages tested in assertions:**
```typescript
// If a function throws, test the message:
expect(() => {
  validateInput('');
}).toThrow('A staged sound edit needs an id');
```

## Common Test Scenarios

**Mathematical Functions:**
- Compare results to expected values with `toBeCloseTo()` for floating-point: `.toBeCloseTo(scale, 10)` (10 decimal places)
- Use `toBeLessThan(1e-9)` for precision-critical code
- Vectors/matrices validated element-wise

**State Transformations:**
- Input → output validation; no mutation checks
- Example: `modLoadOrder(global) < modLoadOrder(base)` tests ordering rules

**Parsing/Decoding:**
- Valid inputs parse correctly
- Invalid inputs return `null` or throw
- Edge cases tested explicitly

**Type Guards:**
```typescript
it('folds collision radius/friction by DYNAMIC slot', () => {
  const m = parseFeModel(raw)!;  // Assert non-null
  expect(m.nodes[0].collideRadius).toBe(0);
  expect(m.nodes[1].collideRadius).toBeCloseTo(1.5, 5);
});
```

## Coverage Goals

**Observed Focus Areas:**
- `src/lib/` — 3D preview (FeModel parser, cloth math, material reconstruction): HIGH coverage
- `electron/main/services/` — business logic (VPK handling, mod identity, conflict detection): HIGH coverage
- `src/components/` — mostly not tested; only complex calculators like `soundTuning.test.ts`, `portraitFamily.test.ts` have tests
- `src/stores/` — selective testing (e.g., `appStore.solo.test.ts` for solo restore)

**Quality Relies On:**
- TypeScript strict mode (catches many errors at compile time)
- ESLint (unused vars, unreachable code)
- Manual testing via dev driver (`scripts/dev-driver.mjs`) for UI workflows

## Running Tests

**All tests:**
```bash
pnpm test
```

**Specific file:**
```bash
pnpm exec vitest run src/lib/clothMath.test.ts
```

**Watch mode:**
```bash
pnpm test:watch
```

**Coverage (if enabled):**
```bash
pnpm exec vitest run --coverage
```
(Coverage configuration not currently enforced)

## Test Patterns Summary

| Pattern | Example | Files |
|---------|---------|-------|
| Factory function | `mod(over: Partial<Mod>)` | `src/lib/lockerUtils.test.ts` |
| Parametrized tests | `it.each([...])` | `electron/main/services/version.test.ts` |
| Math validation | `toBeCloseTo()`, `toBeLessThan()` | `src/lib/clothMath.test.ts` |
| Parse validation | `expect(parse(x)).toBeNull()` | `src/lib/feModel.test.ts` |
| State ordering | `expect(order(a)).toBeLessThan(order(b))` | `src/lib/lockerUtils.test.ts` |

---

*Testing analysis: 2026-08-05*
