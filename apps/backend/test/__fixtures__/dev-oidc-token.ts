/* eslint-disable no-process-env */
import { createHash, randomBytes } from "node:crypto";

/**
 * dev-oidc token minting via headless PKCE (authorization_code grant).
 *
 * dev-oidc v0.3.1 supports only `authorization_code` + `refresh_token` grants
 * (verified via `.well-known/openid-configuration`). There is no `password`
 * grant. This helper drives the full PKCE flow in three steps:
 *
 *   1. GET /authorize  → capture `pendingAuthId` from the HTML response.
 *   2. POST /authorize/complete  → select profile; capture `code` from the
 *      Location redirect header.
 *   3. POST /token  → exchange code + code_verifier for an `access_token`.
 *
 * The test redirect URI `http://localhost:8095/test-callback` is registered in
 * `apps/backend/dev-oidc.config.json` so dev-oidc accepts it during the flow.
 */

const DEV_OIDC_BASE_URL = process.env["DEV_OIDC_BASE_URL"] ?? "http://localhost:8095";
const DEV_OIDC_CLIENT_ID = "lafken-web";
/**
 * Redirect URI registered in dev-oidc.config.json for headless test flows.
 * It doesn't need to resolve to a real server — dev-oidc redirects to it and
 * we capture the code from the Location header before following.
 */
const DEV_OIDC_TEST_REDIRECT_URI = `${DEV_OIDC_BASE_URL}/test-callback`;

export interface IDevOidcTokenInput {
  /**
   * dev-oidc profile id from `apps/backend/dev-oidc.config.json`.
   * Available profiles:
   *   - "carlos.cima"       → roles: [lafken_platform_operator, lafken_namespace_admin]
   *   - "legal-hold-admin"  → roles: [lafken_legal_hold_admin]
   *   - "content-reviewer"  → roles: [lafken_content_reviewer]
   *   - "asset-deleter"     → roles: [lafken_asset_deleter]
   */
  profileId: string;
}

interface ICachedToken {
  accessToken: string;
  /** Absolute epoch-ms after which this cached token must be re-minted. */
  expiresAtMs: number;
}

const tokenCache = new Map<string, ICachedToken>();

const CODE_VERIFIER_BYTE_LENGTH = 32;
const STATE_BYTE_LENGTH = 8;

/**
 * dev-oidc access tokens have a 15-minute TTL (`tokenTtlSeconds: 900`). A full
 * E2E run can exceed that, so a token minted early and cached for the whole
 * process would expire mid-suite and make late specs 401. Re-mint whenever the
 * cached token has less than this much life left — the margin must exceed the
 * longest single test file (~2 min here) so a token handed out at the start of
 * a file survives every request in it.
 */
const TOKEN_REMINT_MARGIN_MS = 180_000;
const MS_PER_SECOND = 1000;
/** Fallback TTL if dev-oidc ever omits `expires_in` (it currently returns 900). */
const DEFAULT_TOKEN_TTL_SECONDS = 900;

function generateCodeVerifier(): string {
  return randomBytes(CODE_VERIFIER_BYTE_LENGTH).toString("base64url");
}

function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Performs a headless PKCE authorization_code flow against the local dev-oidc
 * container and returns the access token for the given profile. Tokens are
 * cached per profile and re-minted before they expire, so a long-running suite
 * never sends a token that has aged past its TTL.
 */
export async function mintDevOidcToken(input: IDevOidcTokenInput): Promise<string> {
  const cacheKey = input.profileId;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) return cached.accessToken;

  // Step 1: GET /authorize → capture pendingAuthId from HTML
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = computeCodeChallenge(codeVerifier);
  const state = randomBytes(STATE_BYTE_LENGTH).toString("hex");

  const authorizeUrl = new URL(`${DEV_OIDC_BASE_URL}/authorize`);
  authorizeUrl.searchParams.set("client_id", DEV_OIDC_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", DEV_OIDC_TEST_REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);

  const authorizeResponse = await fetch(authorizeUrl.toString());
  if (!authorizeResponse.ok) {
    throw new Error(
      `dev-oidc /authorize returned ${authorizeResponse.status}: ${await authorizeResponse.text()}`,
    );
  }
  const authorizeHtml = await authorizeResponse.text();
  const pendingAuthIdMatch = /name="pendingAuthId" value="([^"]+)"/.exec(authorizeHtml);
  if (!pendingAuthIdMatch) {
    throw new Error("dev-oidc /authorize response did not contain a pendingAuthId field");
  }
  const pendingAuthId = pendingAuthIdMatch[1];

  // Step 2: POST /authorize/complete → get redirect Location with code
  const completeBody = new URLSearchParams({
    pendingAuthId,
    profileId: input.profileId,
  });

  const completeResponse = await fetch(`${DEV_OIDC_BASE_URL}/authorize/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: completeBody.toString(),
    redirect: "manual",
  });

  const location = completeResponse.headers.get("location");
  if (!location) {
    throw new Error(
      `dev-oidc /authorize/complete returned ${completeResponse.status} without a Location header`,
    );
  }
  const locationUrl = new URL(location);
  const code = locationUrl.searchParams.get("code");
  if (!code) {
    throw new Error(`dev-oidc redirect Location did not contain a code: ${location}`);
  }

  // Step 3: POST /token → exchange code for access_token
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: DEV_OIDC_TEST_REDIRECT_URI,
    client_id: DEV_OIDC_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const tokenResponse = await fetch(`${DEV_OIDC_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error(
      `dev-oidc /token returned ${tokenResponse.status}: ${await tokenResponse.text()}`,
    );
  }

  const tokenBody2 = (await tokenResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenBody2.access_token) {
    throw new Error("dev-oidc /token response did not include an access_token");
  }

  const ttlSeconds = tokenBody2.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS;
  const expiresAtMs = Date.now() + ttlSeconds * MS_PER_SECOND - TOKEN_REMINT_MARGIN_MS;
  tokenCache.set(cacheKey, { accessToken: tokenBody2.access_token, expiresAtMs });
  return tokenBody2.access_token;
}
