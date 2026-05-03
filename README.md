# Monorepo Template

## Use [LATAM's Artifact Registry](https://artifactoryrepo1.appslatam.com)

To use that JFrog registry, go to the file [`.npmrc`](.npmrc) and uncomment the line 3 and run `npm login` (once) to address the error of unauthorized access to the registry.

## Turborepo tasks

The commands below are available as shortcuts in running commands in the root of the project.

| Task                | Description                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`          | Run all apps in development mode                                                                                                     |
| `pnpm build`        | Build all apps and packages                                                                                                          |
| `pnpm lint`         | Lint all apps                                                                                                                        |
| `pnpm format`       | Fix formatting issues in all apps                                                                                                    |
| `pnpm format-check` | Check formatting issues in all apps                                                                                                  |
| `pnpm type-check`   | Type checking all apps without generating a build                                                                                    |
| `pnpm test`         | Run all tests in all apps. For `backend` app only the unit tests will run. For `web` app all the unit and integration tests will run |
| `pnpm test:cov`     | The same as `pnpm test` but generating code coverage.                                                                                |

## CI/CD

Pipelines run on **non-draft Merge Requests** (any target branch), **push to the default branch**, and **tag**. **INTG** deploys on merge to the default branch; **PROD** deploys on git tag (placeholder until prod is available). See [docs/CI_CD.md](docs/CI_CD.md) for details and required variables.

## Tech Stack

- **Package Manager**: PNPM (workspaces)
- **Build System**: Turborepo
- **Backend**: Nest.js + Express.js
- **Frontend**: Vite + React + TypeScript
- **Code Quality**: ESLint, Prettier, TypeScript
- **Testing**: Vitest, Playwright
- **Git Hooks**: Lefthook

## Structure

```text
.
├── infra/
├── apps/
│   ├── backend/
│   └── web/
├── shared/
│   ├── backend-api/
│   ├── style-config/
│   ├── typescript-config/
│   └── web-tests/
└── package.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io)

If you're using [NVM](https://github.com/nvm-sh/nvm), just run `nvm install` or `nvm use` once to ensure that you'll use the correct version of Node.js.

### Installation

```bash
pnpm install
# Ensure that Git Hooks are enable
pnpm lefthook install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter web dev
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm --filter web build
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Type check all packages
pnpm type-check

# Format code
pnpm format  # (if you add this script)
```

### Testing

```bash
# Run all tests
pnpm turbo run test

# Run tests for specific app
pnpm --filter web test
```

## Internal Packages

### `@shared/typescript-config`

Shared TypeScript configuration files that are supposed to be used across apps:

- `base.json` - Base configuration
- `vite.json` - Vite-specific configuration

### `@shared/style-config`

Shared ESLint configuration for consistent code styling across all files within this monorepo.

### `@shared/backend-api`

Where the public interfaces (or Data Transfer Objects AKA DTOs) from the `apps/backend` are implemented.  
This package was meant to be the source of truth about how the input and output of that REST API are defined so that we don't have to duplicate their code when consuming the endpoints from the `apps/web` side (using `import type` only).

## Shared Dependencies

The production/development dependencies that could be used in many apps must be listed at the [`package.json`](./package.json).

## Git Hooks

Lefthook is configured with the following hooks:

- **pre-commit**: Runs linting and formatting and stage files if they changed after this step.
- **pre-push**: Runs test (only the faster ones, ie, unit tests); ensure that the apps does not have any TypeScript.
- **commit-msg**: Validates if the commit messages are compliant to the [Conventional Commit specification](https://www.conventionalcommits.org) with the rule configured at [`commitlint.config.js`](./commitlint.config.js) file.

## Infrastructure

This monorepo includes automated deployment pipelines for Cloud Run services and Cloud Endpoints configuration. The deployment is handled via GitLab CI/CD components configured in `.gitlab-ci.yml` files.

## License
