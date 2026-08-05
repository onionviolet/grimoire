# Coding Conventions

**Analysis Date:** 2026-08-05

## Naming Patterns

**Files:**
- camelCase for service files: `modMerger.ts`, `feModel.ts`, `vpkIdentity.ts`
- camelCase for UI components and utilities: `HeroSelect.tsx`, `appStore.ts`, `lockerUtils.ts`
- camelCase with descriptive names: `buildTray.ts`, `soundPickConsequence.ts`, `portraitFamily.ts`
- Test files suffix with `.test.ts` or `.test.tsx` in the same directory as the source: `clothMath.test.ts`, `feModel.test.ts`
- IPC handler files grouped in `electron/main/ipc/`: `crosshairPresets.ts`, `conflicts.ts`, `chatWheel.ts`

**Functions:**
- camelCase for all functions: `recoverSimilarity()`, `buildHeroList()`, `generateId()`
- PascalCase for React components: `HeroSelect`, `PortraitEditor`, `SoundBrowse`
- Internal/private functions use camelCase: `renameWithRetry()`, `modTrace()`, `modTraceEnabled()`
- Use descriptive verb-noun combinations: `recoverOffsetSign()`, `parseFeModel()`, `extractVfxLayer()`
- Factory functions have `build`/`plan`/`create` prefix: `buildHeroList()`, `planSoloByKeys()`, `generateId()`

**Variables:**
- camelCase for all variables: `modsGeneration`, `toggleChain`, `prevById`, `totalWeight`
- Single-letter variables acceptable only in mathematical contexts (e.g., matrix math in `clothMath.ts`): `p`, `q`, `m`, `v`, `i`
- Constants use UPPER_SNAKE_CASE: `MAX_ADDON_FOLDERS`, `MIN_VPK_PRIORITY`, `MAX_VPK_PRIORITY`, `ENABLE_LIMIT_MESSAGE`
- Constant prefixes indicate type/scope: `DOWNLOAD_COUNTS_TTL` (time), `SHUFFLE_INCLUDED_KEY` (preference key)
- Use underscore prefix for intentionally unused parameters: `_event`, `_index` (enforced by ESLint)

**Types/Interfaces:**
- PascalCase for all types and interfaces: `Mod`, `AppSettings`, `CrosshairPreset`, `HeroSelectOption`
- Interfaces describe data shapes: `WeightedRigidFit`, `PresetsData`, `MergedModInfo`
- Types and interfaces grouped logically in `src/types/` directory
- Wire types imported from `src/types/electron.ts` and re-exported in IPC modules for single-sourcing: see `electron/main/ipc/crosshairPresets.ts`

**Enums/Unions:**
- Type unions for variants over enums: `kind?: 'mod' | 'custom'`
- Literal string unions for discriminators: `poolMode === 'n-to-n'`
- Function-based discriminators preferred: `generateModId()` returns string key used in sets/maps

## Code Style

**Formatting:**
- ESLint 9 flat config (`eslint.config.js`) — no prettier config present
- 2-space indentation (inferred from source)
- Trailing commas in multiline structures
- Imports organized by ESLint-typescript-eslint + React plugins

**Linting:**
- **TypeScript Strict Mode:** enabled in both `tsconfig.app.json` and `tsconfig.node.json`
  - `strict: true`
  - `noUnusedLocals: true` — all variables must be used
  - `noUnusedParameters: true` — prefix unused with `_` (enforced by ESLint rule)
  - `noFallthroughCasesInSwitch: true` — every switch case must return/break
  - `noUncheckedSideEffectImports: true` — imports must be explicit
  - `erasableSyntaxOnly: true` — no non-erased syntax features
- **ESLint Rules:**
  - `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'` allows underscore-prefixed unused params
  - React Hooks rules enforced: dependencies arrays, hook ordering
  - Recommended TypeScript and ESLint base configs applied
  - JSX automatic runtime (React 19 + Vite)

**Line Length:**
- No explicit hard limit observed; aim for readability (120-140 char typical)

## Import Organization

**Order:**
1. External dependencies (react, third-party libraries): `import { useState } from 'react'`; `import { create } from 'zustand'`
2. Internal absolute imports/path aliases (none configured in this project)
3. Relative imports: `import { getActiveDeadlockPath } from '../lib/appSettings'`
4. Type imports: `import type { Mod, AppSettings } from '../types/mod'`

**Path Aliases:**
- `@grimoire/social-types` — workspace package for social API types (symlinked from `../grimoire-social/packages/social-types/src/schemas.ts`)
- `@grimoire/social-types/heroes` — heroes enum re-export
- All other imports use relative paths

**Practical Example** (from `src/stores/appStore.ts`):
```typescript
import { create } from 'zustand';
import type { Mod, AppSettings, AppearanceSurface, EditLocalModArgs, GlobalModType } from '../types/mod';
import type { ImportCustomModArgs, ImportCustomModResult } from '../types/electron';
import { getActiveDeadlockPath } from '../lib/appSettings';
import { readPref, writePref } from '../lib/uiPrefs';
import { setDateFormat } from '../lib/dateFormat';
import i18n, { applyLanguagePreference } from '../i18n';
import * as api from '../lib/api';
import { showToast } from './toastStore';
```

**Barrel Files:**
- Used sparingly; `src/lib/api.ts` exports named functions only
- Prefer explicit imports over wildcard

## Error Handling

**Throw Strategy:**
- Throw `Error` (not custom classes) with descriptive messages
- Include context in the message when possible: `throw new Error('A staged sound edit needs an id')`
- Use i18n for user-facing error messages: `throw new Error(t('portraitEditor.bakeFailed', "The image couldn't be prepared."))`
- Assertion-style throws for invariants: `if (!confirm) throw new Error('useConfirm must be used inside a ConfirmProvider')`

**Try-Catch:**
- Use try-catch for I/O operations (file reads, IPC): `electron/main/ipc/crosshairPresets.ts` wraps `readFileSync` and `writeFileSync`
- Catch at the boundary; let higher-level handlers propagate if expected
- Logging on catch: `console.error('[ContextName] Error message:', error)`
- Non-critical failures return safe defaults: `modTrace()` and `modTraceEnabled()` swallow all errors to never break mutations

**IPC Error Pattern:**
- Main process IPC handlers catch and log errors; renderer receives error message
- Validation happens in the main process before mutating state
- Invalid input throws descriptive errors: `if (!input.id.trim()) throw new Error('A staged sound edit needs an id')`

## Comments

**When to Comment:**
- Complex algorithms (e.g., Jacobi eigenvalue solver in `clothMath.ts`): algorithm name or reference
- Non-obvious tradeoffs: explaining why a particular approach (retry backoff, TTL caching)
- Context for long blocks (setup/teardown, state reconciliation): "Reuse existing Mod object identities when a rescan returns unchanged data"
- Future-proofing: explaining constraints that might be violated later

**Example** (from `appStore.ts`):
```typescript
// Monotonic generation guard for the mods list. loadMods claims a generation
// before its (async) scan and only writes if it's still current; mutations that
// replace the list (e.g. custom-mod import) bump it. This stops a slow silent
// reload — notably the focus refresh fired when the OS file picker closes — from
// resolving late and clobbering a just-completed mutation with a stale scan
// (the "added a custom mod but can't act on it until I refresh" bug).
let modsGeneration = 0;
```

**JSDoc/TSDoc:**
- Interface/type documentation: explain the "why" and important fields
- Complex return types document expected behavior
- Practical example (from `src/types/mod.ts`):
```typescript
export interface LockerCardSelection {
  heroCodename: string;
  heroName: string;
  /** Variant tokens captured from the source (e.g. ["card","vertical","mm"]).
   *  Informational: the split takes the whole per-hero panorama prefix. */
  variants: string[];
  source: {
    /** Where this card came from. Absent or `"mod"` = an installed mod VPK
     *  (the original behavior). `"custom"` = a user-uploaded PNG set, built into
     *  a persistent staging VPK the rebuild resolves by `heroCodename` rather
     *  than by addon lookup. */
    kind?: 'mod' | 'custom';
    // ...
  };
}
```

## Function Design

**Size:**
- Prefer small, focused functions; most utility functions 10-30 lines
- Complex algorithms (Jacobi solver, mesh fitting) in dedicated modules
- Avoid deeply nested logic; extract conditions to named variables

**Parameters:**
- Positional parameters for small counts (1-3)
- Object parameters for larger option sets or related values
- Type annotations required; never implicit `any`
- Required parameters come before optional

**Return Values:**
- Explicit types required (TypeScript strict mode enforces)
- Nullable returns documented: `function activeLockerSkin(mods: Mod[]): Mod | undefined`
- Void where appropriate: `function modTrace(message: string): void`
- Use `null`/`undefined` consistently; null preferred for "no value found" (e.g., `parseFeModel(raw)` returns `null` for invalid input)

## Module Design

**Exports:**
- Named exports preferred: `export const modLoadOrder = (mod: Mod): number => ...`
- Default exports only for React components: `export function HeroSelect(...) { ... }`
- Types always exported as `export interface` or `export type`
- Wire types single-sourced: defined in `src/types/` and re-exported from IPC modules

**Services (electron/main/services/):**
- Pure business logic files: no direct IPC
- Exported as named functions: `export async function readAutoexec(path: string): Promise<string>`
- IPC handlers call services and return results directly
- No state mutation without explicit function (e.g., `setModMetadata()`)

**Stores (Zustand):**
- Stores defined in `src/stores/` with `.ts` suffix: `appStore.ts`, `crosshairStore.ts`
- Export the hook: `export const useAppStore = create(...)`
- Actions as store methods: `loadMods()`, `enableMod()`, `disableMod()`

## Module-Level State

**Singletons/Globals:**
- Minimized; prefer Zustand stores for UI state
- Example legitimate uses in `src/stores/appStore.ts`:
  - `let modsGeneration = 0` — monotonic counter to guard race conditions
  - `let toggleChain: Promise<unknown>` — serialization guard for toggle operations
- Never assign to globals in hot paths; initialize once at module load

## Import Patterns

**Avoid Circular Imports:**
- Verify with TypeScript strict mode (`noUnusedLocals` + `erasableSyntaxOnly`)
- Common pattern: services import types but not stores; stores import services
- If circular detected: extract shared types to a separate file or refactor dependencies

**Side-Effect Imports:**
- Avoided: `noUncheckedSideEffectImports: true` in tsconfig
- Exception: React component registrations and CSS (if bundled)

---

*Convention analysis: 2026-08-05*
