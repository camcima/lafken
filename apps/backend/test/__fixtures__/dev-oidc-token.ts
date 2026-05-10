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

const DEV_OIDC_BASE_URL = "http://localhost:8095";
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

const tokenCache = new Map<string, string>();

const CODE_VERIFIER_BYTE_LENGTH = 32;
const STATE_BYTE_LENGTH = 8;

function generateCodeVerifier(): string {
  return randomBytes(CODE_VERIFIER_BYTE_LENGTH).toString("base64url");
}

function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Performs a headless PKCE authorization_code flow against the local dev-oidc
 * container and returns the access token for the given profile. Results are
 * cached for the lifetime of the test process.
 */
export async function mintDevOidcToken(input: IDevOidcTokenInput): Promise<string> {
  const cacheKey = input.profileId;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

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

  const tokenBody2 = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenBody2.access_token) {
    throw new Error("dev-oidc /token response did not include an access_token");
  }

  tokenCache.set(cacheKey, tokenBody2.access_token);
  return tokenBody2.access_token;
}
