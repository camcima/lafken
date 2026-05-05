# Lafken Web

## Configuration

The Web application uses runtime configuration loaded from `public/config.js`, which sets `globalThis.__APP_CONFIG__` — a frozen, Zod-validated object accessed via `getRuntimeValue(key)` from `src/config/app-config.ts`.

### Local Development

In dev, a Vite plugin (`vite-dev-runtime-config`) automatically generates `public/config.js` from `VITE_*` variables in `.env.local`. The `VITE_` prefix is stripped to match the `__APP_CONFIG__` keys:

```
VITE_API_URL=http://localhost:3000  →  API_URL: "http://localhost:3000"
```

Setup:

```bash
cp .env.example .env.local   # then edit values as needed
pnpm dev                      # config.js is generated automatically
```

Changes to `.env.local` require a dev server restart.

### Production

At container startup, `entrypoint.sh` runs `envsubst` on `public/config.js.template` to generate `config.js` from Cloud Run environment variables.

### Environment Variables

**Build-time** (Vite, `import.meta.env`):

- `VITE_MOCKED_API` — Enables MSW mock API (`"true"` to enable)
- `VITE_DEMO_DATA` — Enables typed demo-data fallbacks (`"true"` to enable)

**Runtime** (`__APP_CONFIG__` via `.env.local` in dev, environment in prod):

| Variable                         | Required  | Description                |
| -------------------------------- | --------- | -------------------------- |
| `ENVIRONMENT`                    | Yes       | `intg` or `prod`           |
| `AUTH_PROVIDER`                  | Yes       | `mock` or `oidc`           |
| `API_URL`                        | Yes       | Backend API URL            |
| `MONITORING_URL`                 | No        | Grafana Faro collector URL |
| `OIDC_AUTHORITY`                 | OIDC only | OIDC issuer URL            |
| `OIDC_CLIENT_ID`                 | OIDC only | OIDC client ID             |
| `OIDC_AUDIENCE`                  | OIDC only | API audience               |
| `OIDC_REDIRECT_URI`              | OIDC only | OAuth redirect URI         |
| `AZURE_POST_LOGOUT_REDIRECT_URI` | MSAL only | Post-logout redirect URI   |

See [`app-config.ts`](./src/config/app-config.ts) for the Zod schema and validation.

## Local Development

### Development Commands

```bash
cd .. && pnpm install && pnpm build
pnpm install

# development with watch mode (port 5173)
pnpm dev

# development with host access (accessible from network)
pnpm dev:host

# production build
pnpm build

# preview production build (port 4173)
pnpm preview
```

### Storybook

View and develop components in isolation:

```bash
# Start Storybook dev server (port 6006)
pnpm storybook

# Build Storybook for static hosting
pnpm build-storybook
```

### Run tests

```bash
# Run unit tests
pnpm unit/test
# Run unit tests with watch mode
pnpm unit/test:watch

# Run integration tests
pnpm integration/test

# Run all tests
pnpm test
```

#### Generating Code Coverage

In order to generate a code coverage report that covers all the kind of tests even if they are not running together, run these commands:

```bash
pnpm test:cov
```

The folder `coverage` will be generated after this.

### Linting and Formatting

```bash
# check and fix code formatting/linting
pnpm lint:fix

# lint CSS files
pnpm lint:css
pnpm lint:css:fix

# format code
pnpm format
```

### Type Checking

```bash
# Type check without emitting files
pnpm type-check
```

### Quick Start

1. Clone the repository and navigate to the project directory
2. Install dependencies:

   ```bash
   cd .. && pnpm install && pnpm build
   cd apps/web && pnpm install
   ```

3. Create local configuration:

   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

5. Verify the application is running:

   ```bash
   curl http://localhost:5173
   ```

## E2E Testing

The Web E2E tests use Playwright. The current suite is a **web-only smoke**:
it boots the web preview server, exercises public routes and the auth gate,
and verifies runtime config loads — no backend or database is required.

Full-stack E2E coverage (Web → Backend → Database) is not yet included in
the template; teams that need it should extend `shared/web-tests/` with
their own backend boot strategy.

### Prerequisites

1. **Playwright browsers** installed:
   ```bash
   cd shared/web-tests
   pnpm exec playwright install --with-deps chromium firefox webkit
   ```
2. **Web runtime config** for the preview build. The smoke suite uses
   `generate-test-config.js` to write `apps/web/dist/config.js`, so a
   prior `pnpm -F web build` is required.

### Quick Setup

```bash
# 1. Build the web app
pnpm -F web build

# 2. Install Playwright browsers (first run only)
cd shared/web-tests && pnpm exec playwright install --with-deps

# 3. Run the smoke suite (Playwright auto-starts pnpm preview)
pnpm test:e2e
```

### Test Commands

```bash
# Run E2E tests (preview mode - recommended)
cd shared/web-tests
pnpm test:e2e

# Run E2E tests in development mode (against pnpm dev)
pnpm test:dev

# Headed mode (see the browser)
pnpm test:e2e --headed

# Debug mode
pnpm test:e2e --debug
```

### Test Configuration

- **Test Location**: `shared/web-tests/e2e/`
- **Base URL**: `http://localhost:5173` (dev) or `http://localhost:4173` (preview)
- **Browsers**: Chromium, Firefox, WebKit
- **Server boot**: Playwright starts only the web server. The backend is
  not started; tests do not exercise backend-dependent flows.
- **Parallel Execution**: Tests run in parallel by default (2 workers in
  CI, auto-detect locally)

### Troubleshooting

**Error**: `Runtime config not loaded`

- Ensure `.env.local` exists with the required `VITE_*` variables (dev mode)
- Restart the dev server after creating/modifying `.env.local`
- For preview mode, ensure `pnpm -F web build` ran and
  `generate-test-config.js` produced `apps/web/dist/config.js`

**Error**: `Web service not responding`

- Verify Web is running: `curl http://localhost:4173`
- Check Web build: `pnpm -F web build`

**Error**: `Mock authentication not working`

- Verify `VITE_AUTH_PROVIDER=mock` is set in `.env.local` (mock auth is
  intended for local development and the smoke suite only)
