/* eslint-disable no-console */
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import { GoogleAuth } from "google-auth-library";

const CONFIG = {
  outgoingHttpRequest: {
    timeout: 5 * 60 * 1_000, // 5 minutes
    maxRetries: 1_000,
    exponatialDelay: 1_000, // 1 second as the base delay for exponential backoff
  },
};

/**
 * Converts a flat JSON object to a .env file format string.
 * Note: This function assumes the JSON object is flat and values do not need complex escaping.
 * Nested objects will be stringified as JSON strings.
 *
 * @param {object} jsonObject The JSON object to convert.
 * @returns {string} The formatted .env file string.
 */
function convertJsonToDotEnv(jsonObject) {
  let envFileContent = "";
  for (const [key, value] of Object.entries(jsonObject)) {
    const safeValue = String(value).replace(/'/g, "'\\''");
    envFileContent += `${key}='${safeValue}'\n`;
  }
  return envFileContent;
}

function log(...args) {
  // This is for debug sake and because we cant print to STDOUT we will use STDERR
  console.error(...args);
}

/**
 * @param {string} jwtToken
 * @returns {boolean}
 */
function isJwtExpired(jwtToken) {
  const nowSeconds = Date.now() / 1_000;

  const parseJwt = (jwtToken) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    JSON.parse(Buffer.from(jwtToken.split(".")[1], "base64").toString());

  const jwt = parseJwt(jwtToken);
  if (!jwt.exp || !jwt.iat) {
    // If the token doesn't have exp or iat, we consider it expired to be safe
    log("JWT token is missing 'exp' or 'iat' fields, treating it as expired.");
    return true;
  }

  log(
    `Checking JWT expiration, exp_time=${jwt.exp} issued_at=${jwt.iat} current_time=${nowSeconds}`,
  );
  return jwt.exp < nowSeconds;
}

class VaultService {
  #vaultConfig;
  #auth = new GoogleAuth();
  /** @type {Promise<Record<string, string>> | null} */
  #whenFetchFromVault = null;

  /** @type {Map<'oidc' | 'vault', { issuedAt: Date, ttl: number, value: string }>} */
  // eslint-disable-next-line no-undef
  #inMemoryCacheForAcquiredTokens = new Map();

  constructor(vaultConfig) {
    this.#vaultConfig = vaultConfig;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const httpsAgent = new https.Agent({
      keepAlive: false,
    });

    this.http = axios.create({
      timeout: CONFIG.outgoingHttpRequest.timeout,
      httpsAgent,
    });

    axiosRetry(this.http, {
      retries: CONFIG.outgoingHttpRequest.maxRetries,
      retryDelay: (retryCount, error) =>
        axiosRetry.exponentialDelay(retryCount, error, CONFIG.outgoingHttpRequest.exponatialDelay),
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === "ETIMEDOUT",
    });
  }

  async getSecret() {
    if (this.#whenFetchFromVault === null) {
      this.#whenFetchFromVault = this.#fetchFromVault().finally(() => {
        this.#whenFetchFromVault = null;
      });
    }
    // For optimization, we are reusing the same outgoing promise for all calls
    return this.#whenFetchFromVault;
  }

  async #fetchFromVault() {
    const token = await this.getVaultToken();

    const response = await this.http.get(
      `${this.#vaultConfig.vaultAddr}${this.#vaultConfig.secretPath}`,
      {
        headers: { "X-Vault-Token": token },
      },
    );

    const data = response.data.data.data;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data;
  }

  async getOidcToken() {
    // #region In-memory cache for OIDC token
    const maybeCachedIdToken = this.#inMemoryCacheForAcquiredTokens.get("oidc");
    if (maybeCachedIdToken) {
      const idToken = maybeCachedIdToken.value;
      const isExpired = isJwtExpired(idToken);
      log("[VaultService#getOidcToken] Found cached OIDC token, checking expiration...");
      if (isExpired) {
        log("[VaultService#getOidcToken] Cached OIDC token is expired, removing from cache...");
        this.#inMemoryCacheForAcquiredTokens.delete("oidc");
      } else {
        log("[VaultService#getOidcToken] Cached OIDC token is valid, reusing it.");
        return idToken;
      }
    } else {
      log("[VaultService#getOidcToken] No cached OIDC token found.");
    }
    // #endregion

    log("[VaultService#getOidcToken] No valid cached OIDC token found, acquiring a new one...");
    const client = await this.#auth.getIdTokenClient(this.#vaultConfig.audience);
    const idToken = await client.idTokenProvider.fetchIdToken(this.#vaultConfig.audience);

    log("[VaultService#getOidcToken] Acquired new OIDC token from Google Auth Library.");
    this.#inMemoryCacheForAcquiredTokens.set("oidc", {
      issuedAt: new Date(),
      ttl: Infinity,
      value: idToken,
    });

    return idToken;
  }

  async getVaultToken() {
    const oidc = await this.getOidcToken();

    // #region In-memory cache for Vault token
    const maybeCachedVaultToken = this.#inMemoryCacheForAcquiredTokens.get("vault");
    if (maybeCachedVaultToken) {
      log("[VaultService#getVaultToken] Found cached Vault token, checking expiration...");
      const tokenTTLSeconds = maybeCachedVaultToken.ttl;
      const nowTimestampSeconds = new Date().getTime() / 1_000;
      const issuedAtSeconds = maybeCachedVaultToken.issuedAt.getTime() / 1_000;
      const isExpired = nowTimestampSeconds > issuedAtSeconds + tokenTTLSeconds;
      if (isExpired) {
        this.#inMemoryCacheForAcquiredTokens.delete("vault");
      } else {
        return maybeCachedVaultToken.value;
      }
    } else {
      log("[VaultService#getVaultToken] No cached Vault token found.");
    }
    // #endregion

    log("[VaultService#getVaultToken] No valid cached Vault token found, acquiring a new one...");
    const loginRes = await this.http.post(
      `${this.#vaultConfig.vaultAddr}${this.#vaultConfig.loginPath}`,
      {
        role: this.#vaultConfig.role,
        jwt: oidc,
      },
    );
    if (!loginRes?.data) {
      throw new Error("Failed to login to vault");
    }

    const authData = loginRes.data.auth;
    // Basic JSON structure validation
    if (!authData || !authData.client_token || !authData.lease_duration) {
      throw new Error(
        "Invalid response from Vault login: missing `client_token` or `lease_duration` fields at `auth` field",
      );
    }

    const { client_token, lease_duration } = authData;

    log(
      `[VaultService#getVaultToken] Acquired new Vault token, caching it in memory with TTL=${lease_duration} seconds.`,
    );
    this.#inMemoryCacheForAcquiredTokens.set("vault", {
      issuedAt: new Date(),
      ttl: lease_duration,
      value: client_token,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return client_token;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * It should be like: {...}/apps/backend/deploy/run/vault-secrets-config.js
 * @type {string}
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const FULL_PATH_TO_VAULT_SECRETS_CONFIG_JS = path.join(
  dirname,
  "..",
  "deploy",
  "run",
  "vault-secrets-config.mjs",
);
const { default: vaultSecretsConfig } = await import(FULL_PATH_TO_VAULT_SECRETS_CONFIG_JS);

const vaultService = new VaultService({
  vaultAddr: vaultSecretsConfig.vaultAddr,
  role: vaultSecretsConfig.role,
  secretPath: vaultSecretsConfig.secretPath,
  audience: vaultSecretsConfig.audience,
  loginPath: vaultSecretsConfig.loginPath,
});

await vaultService
  .getSecret()
  .then((secrets) => {
    const dotEnvFileContent = convertJsonToDotEnv(secrets);
    process.stdout.write(dotEnvFileContent);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Vault settings:", {
      vaultAddr: vaultSecretsConfig.vaultAddr,
      role: vaultSecretsConfig.role,
      secretPath: vaultSecretsConfig.secretPath,
      audience: vaultSecretsConfig.audience,
      loginPath: vaultSecretsConfig.loginPath,
    });

    if (err instanceof AxiosError) {
      console.error("Axios error:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        code: err.code,
        data: err.response?.data,
      });
    } else {
      console.error("Error fetching vault secret:", err);
    }
    process.exit(1);
  });
