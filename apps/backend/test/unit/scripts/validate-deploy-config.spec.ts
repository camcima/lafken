import { describe, expect, it } from "vitest";

import { parseSetEnvVars, validateBackendDeployConfig } from "@/scripts/validate-deploy-config";

const VALID_YAML = `
set-env-vars: ENV=intg,APP_PORT=3000,NODE_ENV=production,DB_NAME=lafken-intg,DB_USER=lafken,DB_HOST=10.0.0.1,DB_PORT=5432,AUTH_PROVIDER=oidc,OIDC_ISSUER=https://example.com/oidc,OIDC_AUDIENCE=lafken-api
port: 3000
service-account: x@y.iam.gserviceaccount.com
project: x
region: us-east1
`;

// Prod-style YAML with REPLACE_ME_PROD_ placeholders — Zod validation is intentionally skipped.
const PROD_REPLACE_ME_YAML = `
set-env-vars: ENV=prod,APP_PORT=3000,NODE_ENV=production,DB_NAME=REPLACE_ME_PROD_DB_NAME,DB_USER=REPLACE_ME_PROD_DB_USER,DB_HOST=REPLACE_ME_PROD_DB_HOST,DB_PORT=5432,AUTH_PROVIDER=oidc,OIDC_ISSUER=REPLACE_ME_PROD_OIDC_ISSUER,OIDC_AUDIENCE=REPLACE_ME_PROD_OIDC_AUDIENCE,OIDC_PRINCIPAL_CLAIM=preferred_username,OIDC_ROLES_CLAIM=roles
port: 3000
service-account: lafken-backend-sa@emx-prod-63eb.iam.gserviceaccount.com
project: emx-prod-63eb
region: us-east1
labels: cmdb-lafken=lafken,iac=false
`;

// Same prod YAML but with a stale msal residue — should still be caught.
const PROD_REPLACE_ME_WITH_MSAL_YAML = PROD_REPLACE_ME_YAML.replace(
  "AUTH_PROVIDER=oidc",
  "AUTH_PROVIDER=msal",
);

const INVALID_AUTH_YAML = VALID_YAML.replace("AUTH_PROVIDER=oidc", "AUTH_PROVIDER=msal");

const TEMPLATE_RESIDUE_YAML = VALID_YAML.replace("DB_NAME=lafken-intg", "DB_NAME=emx-tmpl-intg");

describe("parseSetEnvVars", () => {
  it("converts a comma-separated set-env-vars string to a Record", () => {
    const result = parseSetEnvVars("A=1,B=hello,C=https://x.example.com/p");
    expect(result).toEqual({ A: "1", B: "hello", C: "https://x.example.com/p" });
  });

  it("preserves DB_PASSWORD-less env (DB_PASSWORD comes from secrets at runtime)", () => {
    const result = parseSetEnvVars("DB_NAME=foo");
    expect(result).toEqual({ DB_NAME: "foo" });
  });
});

describe("validateBackendDeployConfig", () => {
  it("accepts a valid OIDC-based intg config (DB_PASSWORD injected from secrets)", () => {
    expect(() =>
      validateBackendDeployConfig(VALID_YAML, { extraEnv: { DB_PASSWORD: "x" } }),
    ).not.toThrow();
  });

  it("rejects AUTH_PROVIDER=msal", () => {
    expect(() =>
      validateBackendDeployConfig(INVALID_AUTH_YAML, { extraEnv: { DB_PASSWORD: "x" } }),
    ).toThrow(/AUTH_PROVIDER|msal|template residue/);
  });

  it("rejects template-residual strings like 'emx-tmpl' anywhere in the env", () => {
    expect(() =>
      validateBackendDeployConfig(TEMPLATE_RESIDUE_YAML, { extraEnv: { DB_PASSWORD: "x" } }),
    ).toThrow(/template residue|emx-tmpl|template-emantto/);
  });

  it("accepts a prod YAML with REPLACE_ME_PROD_ placeholders without requiring real secrets (Zod skipped)", () => {
    // Zod parse is intentionally bypassed for placeholder YAMLs — DB_PASSWORD is not needed.
    expect(() => validateBackendDeployConfig(PROD_REPLACE_ME_YAML)).not.toThrow();
  });

  it("rejects a prod YAML with REPLACE_ME_PROD_ placeholders that also contains msal residue", () => {
    // Residue sweep still runs even when Zod is skipped.
    expect(() => validateBackendDeployConfig(PROD_REPLACE_ME_WITH_MSAL_YAML)).toThrow(
      /template residue|msal/,
    );
  });
});
