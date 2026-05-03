# TypeScript 6.0 Migration Plan

> **Current version:** `^5.9.3`
> **Target version:** `^6.0.0`

TypeScript 6.0 is a **transition release** preparing for TypeScript 7.0 (native Go port). Most changes are new defaults and deprecations. Our monorepo is already well-positioned — several breaking defaults are already explicitly set in our configs.

---

## Table of Contents

1. [Impact Assessment](#1-impact-assessment)
2. [Phase 1 — Pre-Migration (on TS 5.9)](#2-phase-1--pre-migration-on-ts-59)
3. [Phase 2 — Upgrade TypeScript](#3-phase-2--upgrade-typescript)
4. [Phase 3 — Fix Deprecated Options](#4-phase-3--fix-deprecated-options)
5. [Phase 4 — Fix Breaking Default Changes](#5-phase-4--fix-breaking-default-changes)
6. [Phase 5 — Clean Up & Quick Wins](#6-phase-5--clean-up--quick-wins)
7. [Phase 6 — Validate](#7-phase-6--validate)
8. [Appendix: Config Diff per File](#appendix-config-diff-per-file)

---

## 1. Impact Assessment

### What's already compliant (no action needed)

| Setting                              | Status       | Where                          |
| ------------------------------------ | ------------ | ------------------------------ |
| `types` explicitly set               | Already done | `nest.json`, `vite.json`       |
| `rootDir` explicitly set             | Already done | All apps + shared packages     |
| `strict: true`                       | Already done | `vite.json` (web)              |
| `noUncheckedSideEffectImports: true` | Already done | `vite.json` (web)              |
| `esModuleInterop: true`              | Already done | `nest.json`, `nest-sonar.json` |
| `allowSyntheticDefaultImports: true` | Already done | `nest.json`, `nest-sonar.json` |
| `moduleResolution: "bundler"`        | Already done | `vite.json` (web)              |

### What needs attention

| Issue                                                         | Severity | Affected Configs                                                                              |
| ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `moduleResolution: "node"` **deprecated**                     | HIGH     | `nest.json`, `nest-sonar.json`, `shared/backend-api`                                          |
| `baseUrl` **deprecated**                                      | HIGH     | `nest.json` (via paths), `apps/backend`, `apps/web`, `shared/backend-api`, `shared/web-tests` |
| `importsNotUsedAsValues: "remove"` **removed**                | HIGH     | `nest.json`, `nest-sonar.json`                                                                |
| No `strict: true` in NestJS configs                           | MEDIUM   | `nest.json`, `nest-sonar.json` (individual strict flags set instead)                          |
| `lib: ["DOM", "DOM.Iterable"]` redundant                      | LOW      | `vite.json`                                                                                   |
| `esModuleInterop`/`allowSyntheticDefaultImports` now defaults | LOW      | `nest.json`, `nest-sonar.json` (can remove, now always true)                                  |

---

## 2. Phase 1 — Pre-Migration (on TS 5.9)

These changes are backwards-compatible and can be done **before** upgrading TypeScript.

### 1.1 Run the automated migration tool

```bash
npx @andrewbranch/ts5to6 --fixBaseUrl .
npx @andrewbranch/ts5to6 --fixRootDir .
```

This will handle `baseUrl` removal and `rootDir` adjustments across the monorepo, following `extends` chains and project references.

### 1.2 Replace `importsNotUsedAsValues` with `verbatimModuleSyntax`

**Files:** `shared/typescript-config/nest.json`, `shared/typescript-config/nest-sonar.json`

`importsNotUsedAsValues` was deprecated in TS 5.0 and will error in TS 6.0. Replace with:

```diff
- "importsNotUsedAsValues": "remove",
+ "verbatimModuleSyntax": false,
```

> **Note:** We set `verbatimModuleSyntax: false` because the NestJS apps use CommonJS + decorators with `emitDecoratorMetadata`, which requires type information at emit time. Setting it to `true` would break decorator metadata emission. This is a known NestJS limitation.

### 1.3 Audit `import * as` patterns in backend

TS 6.0 makes `esModuleInterop: true` the permanent default. Search for `import * as` on CJS packages:

```bash
grep -rn "import \* as" apps/backend/src --include="*.ts" | grep -v "node_modules"
```

Convert any CJS default imports:

```typescript
// Before
import * as express from "express";
// After
import express from "express";
```

This is safe to do now since `esModuleInterop: true` is already set in our config.

---

## 3. Phase 2 — Upgrade TypeScript

### 2.1 Update root `package.json`

```diff
- "typescript": "^5.9.3",
+ "typescript": "^6.0.0",
```

### 2.2 Update related tooling

Check compatibility and upgrade if needed:

| Package                                 | Action                               |
| --------------------------------------- | ------------------------------------ |
| `@typescript-eslint/parser`             | Upgrade to version with TS 6 support |
| `typescript-eslint`                     | Upgrade to version with TS 6 support |
| `@nestjs/cli`                           | Check release notes for TS 6 compat  |
| `tsx`                                   | Upgrade (uses ts internally)         |
| `vitest`                                | Should work, verify                  |
| `@trivago/prettier-plugin-sort-imports` | Check TS 6 compat (uses TS parser)   |

```bash
pnpm update typescript @typescript-eslint/parser typescript-eslint tsx --latest
```

### 2.3 Install and run with `ignoreDeprecations` (temporary escape hatch)

If you need to unblock the team while fixing deprecations, temporarily add to the base configs:

```json
{
  "compilerOptions": {
    "ignoreDeprecations": "6.0"
  }
}
```

> **Remove this before merging to main.** It's only for iterative migration.

---

## 4. Phase 3 — Fix Deprecated Options

### 3.1 `moduleResolution: "node"` → `"node16"`

**Files:** `shared/typescript-config/nest.json`, `shared/typescript-config/nest-sonar.json`, `shared/backend-api/tsconfig.json`

```diff
- "moduleResolution": "node",
+ "moduleResolution": "node16",
```

**Why `node16` and not `nodenext`:** Our backend use `module: "commonjs"`. `node16` is the stable, pinned equivalent of `nodenext` for CJS resolution and won't float to future behaviors. It supports `exports` fields in `package.json` and ESM/CJS distinction.

**Why not `bundler`:** Backend run directly on Node.js (not through a bundler), so `node16` is the semantically correct choice.

**Potential breakage to watch for:**

- Extensionless imports may fail if a dependency lacks proper `exports` in its `package.json`
- Internal relative imports may need `.js` extensions if `verbatimModuleSyntax` is later enabled
- Run `pnpm type-check` and fix any resolution failures

### 3.2 Remove `baseUrl` and inline into `paths`

**Files:** All tsconfig files that use `baseUrl`

The `ts5to6` tool (Phase 1.1) should handle this. Verify the result manually:

**`shared/typescript-config/nest.json`:**

```diff
  "compilerOptions": {
-   "baseUrl": ".",    // (removed by consumer tsconfigs)
    "paths": {
-     "@/*": ["./src/*"]
+     "@/*": ["./src/*"]  // paths now relative to tsconfig location
    }
  }
```

**`apps/backend/tsconfig.json`:**

```diff
  "compilerOptions": {
    "rootDir": ".",
-   "baseUrl": ".",
    "outDir": "./dist",
  }
```

**`apps/web/tsconfig.json`:**

```diff
  "compilerOptions": {
-   "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
```

Apply the same pattern to: `shared/backend-api/tsconfig.json`, `shared/web-tests/tsconfig.json`.

### 3.3 Remove `allowSyntheticDefaultImports` and `esModuleInterop`

**Files:** `shared/typescript-config/nest.json`, `shared/typescript-config/nest-sonar.json`

Both are now **always true** in TS 6.0. Setting them to `false` is a deprecation error; setting them to `true` is redundant.

```diff
- "allowSyntheticDefaultImports": true,
- "esModuleInterop": true,
```

---

## 5. Phase 4 — Fix Breaking Default Changes

### 4.1 `strict` defaulting to `true`

**`vite.json`** — Already has `strict: true`. No change needed.

**`nest.json` / `nest-sonar.json`** — These configs use individual strict flags instead of `strict: true`. Since TS 6 now defaults `strict` to `true`, we have two options:

**Option A (recommended): Adopt `strict: true` and only override what we relax**

```diff
+ "strict": true,
  "strictNullChecks": true,          // redundant with strict, can remove
- "strictPropertyInitialization": false,
+ "strictPropertyInitialization": false,  // keep: NestJS DI requires this
  "strictBindCallApply": true,       // redundant with strict, can remove
- "noImplicitAny": false,
+ "noImplicitAny": false,            // keep: relaxed for gradual adoption
  "noImplicitThis": true,            // redundant with strict, can remove
  "useUnknownInCatchVariables": true, // redundant with strict, can remove
```

Simplified result:

```json
{
  "strict": true,
  "strictPropertyInitialization": false,
  "noImplicitAny": false
}
```

> **Risk:** `strict: true` now also enables `alwaysStrict` and `strictFunctionTypes` which weren't previously set. Run type-check and fix any new errors.

**Option B (conservative): Explicitly set `strict: false` and keep individual flags**

Only if Option A produces too many errors to fix in one pass.

### 4.2 `target` defaulting to `es2025`

- **`nest.json`** has `target: "esnext"` — this will float to es2025+. No change needed.
- **`vite.json`** has `target: "ES2022"` — explicit, no change needed.
- **`shared/backend-api`** have `target: "ES2022"` — explicit, no change needed.

### 4.3 `module` defaulting to `es2022`

All our configs explicitly set `module` (`commonjs` or `ESNext`). No change needed.

### 4.4 `types` defaulting to `[]`

- **`nest.json`** has `types: ["node", "vitest/globals"]` — explicit, good.
- **`vite.json`** has `types: ["vite/client", "vitest/globals", "@testing-library/jest-dom", "node"]` — explicit, good.
- **`shared/backend-api`** — **Missing `types`!** They rely on auto-discovery. Fix:

```diff
  "compilerOptions": {
+   "types": ["node"],
    "target": "ES2022",
```

- **`shared/web-tests`** — **Missing `types`!** Fix:

```diff
  "compilerOptions": {
+   "types": ["node"],
    "baseUrl": ".",
```

---

## 6. Phase 5 — Clean Up & Quick Wins

### 5.1 Simplify `lib` in `vite.json`

`DOM.Iterable` is now merged into `DOM` in TS 6.0:

```diff
- "lib": ["ES2022", "DOM", "DOM.Iterable"],
+ "lib": ["ES2022", "DOM"],
```

### 5.2 Remove redundant strict sub-flags

After adopting `strict: true` in `nest.json` / `nest-sonar.json`, remove flags that are implied:

- `strictNullChecks: true` (implied by `strict`)
- `strictBindCallApply: true` (implied by `strict`)
- `noImplicitThis: true` (implied by `strict`)
- `useUnknownInCatchVariables: true` (implied by `strict`)

### 5.3 Consider upgrading `target` in shared packages

`shared/backend-api` use `target: "ES2022"`. Since we require Node >= 22 (supports ES2024+), consider upgrading:

```diff
- "target": "ES2022",
+ "target": "ES2024",
```

This is optional and low priority.

### 5.4 Replace `import ... assert` with `import ... with` (if any)

```bash
grep -rn "assert {" apps/ shared/ --include="*.ts" --include="*.tsx"
```

```typescript
// Before
import data from "./data.json" assert { type: "json" };
// After
import data from "./data.json" with { type: "json" };
```

### 5.5 Replace `module` keyword with `namespace` (if any)

```bash
grep -rn "^module " apps/ shared/ --include="*.ts" | grep -v "declare module"
```

---

## 7. Phase 6 — Validate

### 6.1 Full type-check

```bash
pnpm type-check
```

### 6.2 Full test suite

```bash
pnpm test
```

### 6.3 Build all apps

```bash
pnpm build
```

### 6.4 Lint

```bash
pnpm lint
```

### 6.5 Verify runtime behavior

- Start backend, and web locally
- Run E2E tests
- Verify decorator metadata still works (NestJS DI, Swagger)

### 6.6 Remove `ignoreDeprecations` if used

Ensure no tsconfig contains `"ignoreDeprecations": "6.0"` before merging.

---

## Appendix: Config Diff per File

### `shared/typescript-config/nest.json`

```diff
 {
   "compilerOptions": {
-    "importsNotUsedAsValues": "remove",
+    "verbatimModuleSyntax": false,
-    "allowSyntheticDefaultImports": true,
-    "esModuleInterop": true,
+    "strict": true,
+    "strictPropertyInitialization": false,
+    "noImplicitAny": false,
-    "strictNullChecks": true,
-    "strictPropertyInitialization": false,
-    "strictBindCallApply": true,
-    "noImplicitAny": false,
-    "noImplicitThis": true,
-    "useUnknownInCatchVariables": true,
-    "moduleResolution": "node",
+    "moduleResolution": "node16",
   }
 }
```

### `shared/typescript-config/nest-sonar.json`

Same changes as `nest.json`.

### `shared/typescript-config/vite.json`

```diff
 {
   "compilerOptions": {
-    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "lib": ["ES2022", "DOM"],
   }
 }
```

### `shared/backend-api/tsconfig.json`

```diff
 {
   "compilerOptions": {
+    "types": ["node"],
-    "moduleResolution": "node",
+    "moduleResolution": "node16",
-    "baseUrl": ".",
   }
 }
```

### `apps/backend/tsconfig.json`

```diff
 {
   "compilerOptions": {
     "rootDir": ".",
-    "baseUrl": ".",
     "outDir": "./dist",
   }
 }
```

### `apps/web/tsconfig.json`

```diff
 {
   "compilerOptions": {
-    "baseUrl": ".",
     "paths": {
       "@/*": ["./src/*"]
     }
   }
 }
```

### `shared/web-tests/tsconfig.json`

```diff
 {
   "compilerOptions": {
+    "types": ["node"],
-    "baseUrl": ".",
   }
 }
```

---

## Preparing for TypeScript 7.0

TS 6.0 is explicitly a bridge to TS 7.0 (native Go port). Everything deprecated in 6.0 becomes a **hard removal** in 7.0. After this migration:

- All deprecated options will be removed
- All configs will use explicit values for changed defaults
- The `--stableTypeOrdering` flag can be optionally tested to preview TS 7.0 type ordering behavior (adds ~25% slowdown, diagnostic only)
- Watch for `@nestjs/*` and `vitest` announcements regarding TS 7.0 native compatibility
