---
name: backend-git-commit
description: Creates git commits following the Conventional Commits specification. Covers commit message format, type prefixes, scopes, breaking changes, and integration with release-it for automated versioning and changelogs. Use when committing code changes, writing commit messages, or preparing releases.
---

# Git Commit - Conventional Commits

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type       | Description                         | Bumps |
| ---------- | ----------------------------------- | ----- |
| `feat`     | New feature                         | Minor |
| `fix`      | Bug fix                             | Patch |
| `docs`     | Documentation only                  | -     |
| `style`    | Code style (formatting, semicolons) | -     |
| `refactor` | Code change (no feature/fix)        | -     |
| `perf`     | Performance improvement             | Patch |
| `test`     | Adding/fixing tests                 | -     |
| `build`    | Build system or dependencies        | -     |
| `ci`       | CI configuration                    | -     |
| `chore`    | Other changes                       | -     |

## Scopes

Use the bounded context or app name:

```
feat(user-profile): add register user endpoint
test(work-center): add e2e tests for pagination
docs(backend): update API documentation
chore(infra): update terraform modules
```

## Breaking Changes

Add `!` after type/scope and a `BREAKING CHANGE:` footer:

```
feat(user-profile)!: change user ID format to UUIDv7

BREAKING CHANGE: All user IDs are now UUIDv7 format instead of auto-increment.
Existing API consumers must update their ID handling.
```

## Examples

```bash
# Feature
git commit -m "feat(user-profile): add register user endpoint"

# Bug fix
git commit -m "fix(work-center): correct pagination offset calculation"

# Test
git commit -m "test(user-profile): add e2e tests for user registration"

# Refactor
git commit -m "refactor(backend): extract base repository class"

# Documentation
git commit -m "docs(backend): add ADR for Kysely adoption"

# Chore
git commit -m "chore: update dependencies"
```

## Pre-Commit Quality Gate

Before committing, ensure ALL checks pass:

```bash
pnpm --filter backend test          # All tests pass
pnpm --filter backend dep-check     # Hexagonal boundaries verified
pnpm --filter backend lint           # No lint errors
pnpm --filter backend type-check    # No type errors
```

## Release Management (release-it)

The project uses `release-it` for automated releases:

```bash
# From apps/backend directory:
pnpm release          # Creates version, tag, changelog
pnpm release --dry-run # Preview without executing
```

`release-it` automatically:

- Determines version bump from conventional commit types
- Generates `CHANGELOG.md` from commit messages
- Creates git tag (e.g., `v1.2.3`)
- Configuration in `.release-it.json`
