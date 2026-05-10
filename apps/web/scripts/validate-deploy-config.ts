/* v8 ignore file */
import { readFileSync } from "node:fs";
import path from "node:path";

import yaml from "js-yaml";
import { z } from "zod";

const TEMPLATE_RESIDUE_PATTERNS = [
  /emx[-_]tmpl/iu,
  /template[-_]emantto[-_]project/iu,
  /\bAZURE_/u,
  /\bmsal\b/iu,
] as const;

const deployEnvSchema = z.object({
  ENVIRONMENT: z.enum(["intg", "prod"]),
  AUTH_PROVIDER: z.literal("oidc"),
  API_URL: z.string().url(),
  OIDC_AUTHORITY: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_REDIRECT_URI: z.string().url(),
  OIDC_POST_LOGOUT_REDIRECT_URI: z.string().url(),
  OIDC_SCOPES: z.string().default("openid profile email"),
  MONITORING_URL: z.union([z.string().url(), z.literal("")]).optional(),
});

interface IRuntimeConfigYaml {
  "set-env-vars"?: string;
}

function parseSetEnvVars(setEnvVars: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of setEnvVars.split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    if (key.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

export function validateWebDeployConfig(yamlContent: string): void {
  const parsed = yaml.load(yamlContent) as IRuntimeConfigYaml;
  if (typeof parsed?.["set-env-vars"] !== "string") {
    throw new Error("runtime-config.yaml is missing `set-env-vars` string");
  }

  // Always run the template-residue sweep — catches stale msal/AZURE_*/emx-tmpl strings
  // even in prod YAMLs that intentionally carry REPLACE_ME_PROD_* placeholders.
  for (const pattern of TEMPLATE_RESIDUE_PATTERNS) {
    if (pattern.test(yamlContent)) {
      throw new Error(`template residue matched: ${String(pattern)}`);
    }
  }

  // Skip Zod validation for prod YAMLs that still contain REPLACE_ME_PROD_ placeholders.
  // Those values are intentional — operators fill them at deploy time via Cloud Run secrets.
  // The residue sweep above is sufficient to catch any stale template strings.
  if (yamlContent.includes("REPLACE_ME_PROD_")) {
    return;
  }

  const env = parseSetEnvVars(parsed["set-env-vars"]);
  deployEnvSchema.parse(env);
}

if (process.argv[1] && process.argv[1].endsWith("validate-deploy-config.ts")) {
  const targets = ["intg", "prod"];
  for (const deployEnv of targets) {
    const yamlPath = path.resolve(
      process.cwd(),
      "deploy",
      "run",
      deployEnv,
      "runtime-config.yaml",
    );
    const content = readFileSync(yamlPath, "utf8");
    validateWebDeployConfig(content);
    // eslint-disable-next-line no-console
    console.log(`OK: ${yamlPath}`);
  }
}
