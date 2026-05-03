/* v8 ignore file */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-process-env */
import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production", "staging"]).default("production"),
    /** Application's web server port to listen on */
    APP_PORT: z.coerce.number().int(),
    /** Log level to use for logging */
    LOG_LEVEL: z.enum(["debug", "error", "info"]).default("info"),
    /** Whether to use pretty logs */
    PRETTY_LOGS: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .overwrite((val) => {
        // Ensures `PRETTY_LOGS` is only used in case of NODE_ENV is not 'production'
        if (process.env.NODE_ENV === "production" || !process.env.NODE_ENV) {
          return false;
        }
        return val;
      })
      .default(false),

    /**
     * Comma-separated list of allowed CORS origins. Use `*` to allow any origin
     * (NOT recommended outside local development). Empty disables CORS.
     */
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),

    DB_HOST: z.string(),
    DB_PORT: z.coerce.number().int(),
    DB_USER: z.string(),
    DB_NAME: z.string(),
    DB_PASSWORD: z.string(),
    DB_SSL: z
      .string()
      .default("false")
      .refine((value) => value === "true" || value === "false", {
        message: "Value must be 'true' or 'false'",
      })
      .transform((value) => value === "true"),
    /** Minimum number of connections kept in the pool */
    DB_POOL_MIN: z.coerce.number().int().nonnegative().default(1),
    /**
     * Maximum number of connections in the pool. Should be calculated based on
     * Cloud SQL's `max_connections` divided by expected Cloud Run instances.
     */
    DB_POOL_MAX: z.coerce.number().int().positive().default(200),
    /** Time (ms) an idle connection waits before being released from the pool */
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    /** Time (ms) to wait for a connection from the pool before failing */
    DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    /** PostgreSQL `statement_timeout` (ms) — server-side hard ceiling for query duration */
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    /** Client-side `query_timeout` (ms) — must be <= DB_STATEMENT_TIMEOUT_MS */
    DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    /** PostgreSQL `idle_in_transaction_session_timeout` (ms) — kills hung transactions */
    DB_IDLE_IN_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(100_000),

    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),

    /** Whether to generate a Cloud Endpoints-flavoured OpenAPI spec */
    CLOUD_ENDPOINT_DEFINITION: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => val === "true")
      .default(false),

    /** Indicates the authentication provider to use */
    AUTH_PROVIDER: z
      .enum(["msal", "mock"])
      .default("msal")
      .overwrite((data) => {
        // Ensures "mock" is only used in case of 'development' as it was designed for local development purposes
        if (process.env.NODE_ENV === "production" || !process.env.NODE_ENV) {
          return "msal";
        }
        return data;
      })
      .default("msal"),
    // Mandatory configuration when AUTH_PROVIDER is "msal"
    AUTH_TENANT_ID: z.string().nonempty().optional(),
    AUTH_CLIENT_ID: z.string().nonempty().optional(),
  })
  .refine(
    (data) => {
      if (data.OTEL_EXPORTER_OTLP_ENDPOINT) {
        const isAllDefined = data.OTEL_SERVICE_NAME && data.OTEL_RESOURCE_ATTRIBUTES;
        if (!isAllDefined) {
          throw new Error(
            "If `OTEL_EXPORTER_OTLP_ENDPOINT` is defined, then all the other OTEL_* env vars must be also defined",
          );
        }
      }

      return true;
    },
    {
      message:
        "If `OTEL_EXPORTER_OTLP_ENDPOINT` is defined, then all the other OTEL_* env vars must be also defined",
    },
  )
  .refine(
    (data) => {
      // Ensures that AUTH_TENANT_ID and AUTH_CLIENT_ID are provided when AUTH_PROVIDER is "msal"
      if (data.AUTH_PROVIDER === "msal") {
        if (!data.AUTH_TENANT_ID || !data.AUTH_CLIENT_ID) {
          return false;
        }
      }
      return true;
    },
    {
      message: "AUTH_TENANT_ID and AUTH_CLIENT_ID are required when AUTH_PROVIDER is 'msal'",
    },
  )
  .refine((data) => data.DB_POOL_MIN <= data.DB_POOL_MAX, {
    message: "DB_POOL_MIN must be less than or equal to DB_POOL_MAX",
  })
  .refine((data) => data.DB_QUERY_TIMEOUT_MS <= data.DB_STATEMENT_TIMEOUT_MS, {
    message:
      "DB_QUERY_TIMEOUT_MS must be less than or equal to DB_STATEMENT_TIMEOUT_MS (server-side ceiling)",
  });

export const environmentConfiguration = environmentSchema.parse(process.env);
