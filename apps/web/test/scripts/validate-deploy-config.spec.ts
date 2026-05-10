import { describe, expect, it } from "vitest";

import { validateWebDeployConfig } from "../../scripts/validate-deploy-config";

const VALID_YAML = `
set-env-vars: ENVIRONMENT=intg,AUTH_PROVIDER=oidc,API_URL=https://x.example.com/be,OIDC_AUTHORITY=https://x.example.com/oidc,OIDC_CLIENT_ID=lafken-web,OIDC_AUDIENCE=lafken-api,OIDC_REDIRECT_URI=https://x.example.com/auth/callback,OIDC_POST_LOGOUT_REDIRECT_URI=https://x.example.com/auth/login,OIDC_SCOPES=openid profile email,MONITORING_URL=
port: 8080
project: x
`;

// Prod-style YAML with REPLACE_ME_PROD_ placeholders — Zod validation is intentionally skipped.
const PROD_REPLACE_ME_YAML = `
set-env-vars: ENVIRONMENT=prod,AUTH_PROVIDER=oidc,API_URL=https://REPLACE_ME_PROD_HOST/be,OIDC_AUTHORITY=REPLACE_ME_PROD_OIDC_AUTHORITY,OIDC_CLIENT_ID=REPLACE_ME_PROD_OIDC_CLIENT_ID,OIDC_AUDIENCE=REPLACE_ME_PROD_OIDC_AUDIENCE,OIDC_REDIRECT_URI=REPLACE_ME_PROD_OIDC_REDIRECT_URI,OIDC_POST_LOGOUT_REDIRECT_URI=REPLACE_ME_PROD_OIDC_POST_LOGOUT_REDIRECT_URI,OIDC_SCOPES=openid profile email
port: 8080
service-account: lafken-web-sa@emx-prod-63eb.iam.gserviceaccount.com
project: emx-prod-63eb
labels: cmdb-lafken=lafken,iac=false
`;

// Same prod YAML but with a stale msal residue — should still be caught.
const PROD_REPLACE_ME_WITH_MSAL_YAML = PROD_REPLACE_ME_YAML.replace(
  "AUTH_PROVIDER=oidc",
  "AUTH_PROVIDER=msal",
);

const INVALID_AUTH = VALID_YAML.replace("AUTH_PROVIDER=oidc", "AUTH_PROVIDER=msal");
const AZURE_RESIDUE = VALID_YAML.replace("OIDC_CLIENT_ID=lafken-web", "AZURE_CLIENT_ID=12345");

describe("validateWebDeployConfig", () => {
  it("accepts a valid OIDC config", () => {
    expect(() => validateWebDeployConfig(VALID_YAML)).not.toThrow();
  });

  it("rejects AUTH_PROVIDER=msal", () => {
    expect(() => validateWebDeployConfig(INVALID_AUTH)).toThrow();
  });

  it("rejects AZURE_* keys as template residue", () => {
    expect(() => validateWebDeployConfig(AZURE_RESIDUE)).toThrow(/template residue|AZURE_/);
  });

  it("accepts a prod YAML with REPLACE_ME_PROD_ placeholders without requiring real values (Zod skipped)", () => {
    // Zod parse is intentionally bypassed for placeholder YAMLs.
    expect(() => validateWebDeployConfig(PROD_REPLACE_ME_YAML)).not.toThrow();
  });

  it("rejects a prod YAML with REPLACE_ME_PROD_ placeholders that also contains msal residue", () => {
    // Residue sweep still runs even when Zod is skipped.
    expect(() => validateWebDeployConfig(PROD_REPLACE_ME_WITH_MSAL_YAML)).toThrow(
      /template residue|msal/,
    );
  });
});
