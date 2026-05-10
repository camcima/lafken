import { z } from "zod";

/**
 * Runtime configuration schema.
 *
 * Values are injected at container startup via `envsubst` into `config.js`,
 * which guards against pre-definition attacks and writes a frozen, non-configurable
 * object to `globalThis.__APP_CONFIG__` via `Object.defineProperty` before React boots.
 *
 * Validated once on first access, then cached for the lifetime of the page.
 */
const AppConfigSchema = z.object({
  ENVIRONMENT: z.enum(["intg", "prod"]),
  AUTH_PROVIDER: z.literal("oidc"),
  OIDC_AUTHORITY: z.union([z.url(), z.literal("")]),
  OIDC_CLIENT_ID: z.union([z.string(), z.literal("")]),
  OIDC_AUDIENCE: z.union([z.string(), z.literal("")]),
  OIDC_REDIRECT_URI: z.union([z.url(), z.literal("")]),
  OIDC_POST_LOGOUT_REDIRECT_URI: z.union([z.url(), z.literal("")]),
  OIDC_SCOPES: z.string().default("openid profile email"),
  API_URL: z.url(),
  MONITORING_URL: z.union([z.url(), z.literal("")]),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

let _cached: AppConfig | null = null;

/**
 * Parses + validates the full runtime config on first call, then returns
 * the cached result. Throws immediately if config.js was not loaded or
 * any value is invalid — this is intentional to fail fast at startup.
 */
export function getAppConfig(): AppConfig {
  if (_cached) return _cached;

  const raw: unknown = (globalThis as Record<string, unknown>).__APP_CONFIG__;

  if (!raw || typeof raw !== "object") {
    throw new Error(
      'Runtime config not loaded. Ensure <script src="/config.js"></script> is in index.html before the app module.',
    );
  }

  _cached = AppConfigSchema.parse(raw);
  return _cached;
}

/**
 * Convenience accessor for a single config key.
 *
 * Prefer this over accessing the config object directly so that
 * validation is guaranteed to have run.
 */
export function getRuntimeValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return getAppConfig()[key];
}
