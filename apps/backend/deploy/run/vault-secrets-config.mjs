const env = process.env['ENV'];

const projectKey = "emx-tmpl";
const projectName = "lafken";

if (!env) {
  throw new Error('ENV environment variable is not set. It should be: "dev", "intg" or "prod"');
}

const projectKeySnakeCase = projectKey.replaceAll('-', '_');

export default {
  role: `${projectKeySnakeCase}_vault_gcp_auth_${env}`,
  secretPath: `/v1/${projectKey}/data/${env}/${projectName}/secrets`,
  audience: `http://vault/${projectKeySnakeCase}_vault_gcp_auth_${env}`,
  loginPath: `/v1/auth/gcp/emx/${env}/login`,
  vaultAddr: "https://emx-vault.appslatam.com",
};