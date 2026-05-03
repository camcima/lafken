---
name: find-dead-code
description: >
  Detects unused code (exports, files, dependencies, types) in the project using `pnpm find-dead-code` (Knip under the hood)
  and scopes the results to what's relevant to the current session's changes. Use this skill whenever you finish
  a coding session, after removing or refactoring code, when the user mentions dead code, unused exports,
  unused dependencies, or cleaning up after changes. Also trigger proactively at the end of any significant
  refactor or deletion work — leftover dead code is easy to miss and this catches it.
---

# Find Dead Code

Detect unused code scoped to the current session's changes, then offer to clean it up.

## Why this exists

When you add, refactor, or delete code during a session, you often leave behind orphaned exports, unused imports, stale dependencies, or files that nothing references anymore. These accumulate as tech debt. This skill runs Knip and cross-references its findings with what changed in the session, so you only surface dead code the user actually caused or can act on — not the entire backlog.

## Workflow

### 1. Determine the session's change scope

Figure out which files were touched in the current session. Use git to identify the boundary:

```bash
git diff --name-only HEAD   # unstaged + staged changes
git diff --name-only --cached  # staged only
```

If there are recent commits that are part of this session (commits ahead of the remote or the base branch), include those too:

```bash
git log --oneline --name-only origin/main..HEAD  # files changed in session commits
```

Collect all changed file paths into a set — this is the **session scope**.

### 2. Run Knip with JSON output

```bash
pnpm find-dead-code --reporter json
```

This returns structured JSON with issues grouped by file. Each file entry can contain:

- `dependencies` — unused packages in package.json
- `exports` — exported symbols that nothing imports
- `types` — exported types that nothing imports
- `files` — entire files that are unreferenced
- `duplicates` — duplicate exports across files
- `unlisted` — used but not listed in package.json
- `unresolved` — imports that can't be resolved

### 3. Filter to session scope

Cross-reference the Knip results against the session scope:

- **Unused exports/types**: include if the file containing the export is in the session scope, OR if the only consumers were in session-scope files (i.e., you removed the last import)
- **Unused files**: include if the file is in the session scope, or if the file was only referenced by session-scope files
- **Unused dependencies**: include if any session-scope file previously imported the dependency (check `git diff` content for removed import lines referencing the package)
- **Unlisted/unresolved**: always include if the referencing file is in the session scope

If the filtering leaves zero results, tell the user: "No dead code found related to this session's changes." and stop.

### 4. Present findings to the user

Group results by category and present them clearly. For each finding, show:

- What is unused (the export name, file path, or dependency)
- Where it lives (file and line number)
- Why it's likely related to this session (e.g., "you modified this file" or "you removed the last import of this export")

Example presentation:

```
Dead code found related to your session changes:

**Unused exports** (2):
- `formatUserName` in `apps/backend/src/user/presentation/mappers/user-response.mapper.ts:14`
  → You modified this file; this export has no remaining consumers
- `UserStatus` type in `apps/backend/src/user/domain/entities/user.entity.ts:8`
  → The only import was in a file you deleted

**Unused dependencies** (1):
- `dayjs` in `apps/backend/package.json`
  → You removed the last import of this package (was in `date-utils.ts`)

Would you like me to remove these? I can handle them all, or you can pick specific ones.
```

### 5. Wait for confirmation

Do not remove anything without explicit user approval. The user may:

- Approve all removals
- Cherry-pick which ones to remove
- Decline entirely (the code might be intentionally kept for future use)

### 6. Apply removals

For approved items:

- **Unused exports**: remove the `export` keyword (or the entire declaration if nothing else references it internally)
- **Unused files**: delete the file
- **Unused dependencies**: remove from the relevant `package.json` and run `pnpm install` to update the lockfile
- **Unused types**: remove the type export (or entire declaration if unreferenced internally)

After removals, re-run `pnpm find-dead-code` scoped to the same files to verify no new dead code was introduced by the cleanup itself (cascading removals).

## Important notes

- Never remove code that's clearly kept for future use (e.g., has a TODO comment, or the user explains why it's there)
- If Knip reports something in `knip.jsonc`'s `ignoreDependencies` or `ignoreWorkspaces`, it's already been triaged — skip it
- The `--production` flag means devDependencies are not checked — this is intentional
- If `pnpm find-dead-code` fails to run, check that dependencies are installed (`pnpm install`)
