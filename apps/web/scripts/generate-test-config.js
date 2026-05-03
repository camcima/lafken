#!/usr/bin/env node
/**
 * Generates config.js from environment variables for preview/E2E testing.
 * This script replicates the functionality of entrypoint.sh for non-container environments.
 */
/* eslint-env node */
/* eslint-disable unicorn/prefer-string-replace-all, unicorn/string-content */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Validates that a value is one of the allowed enum values.
 */
function validateEnum(value, name, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(", ")}. Got: ${value}`);
  }
}

/**
 * Validates basic URL format (for E2E testing - catches configuration mistakes).
 */
function validateUrl(value, name) {
  if (!value) {
    return;
  }

  // Basic format check: must start with http:// or https://
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`${name} must be a valid URL starting with http:// or https://: ${value}`);
  }
}

/**
 * Validates UUID format.
 */
function validateUuid(value, name) {
  if (!value) {
    return;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error(`${name} must be a valid UUID format: ${value}`);
  }
}

// Read environment variables with defaults
const environment = process.env.ENVIRONMENT || "intg";
const authProvider = process.env.AUTH_PROVIDER || "mock";
const azureClientId = process.env.AZURE_CLIENT_ID || "";
const azureRedirectUri = process.env.AZURE_REDIRECT_URI || "";
const azureTenantId = process.env.AZURE_TENANT_ID || "";
const azurePostLogoutRedirectUri = process.env.AZURE_POST_LOGOUT_REDIRECT_URI || "";
const monitoringUrl = process.env.MONITORING_URL || "";
const apiUrl = process.env.API_URL || "";

// Validate required variables
if (!environment) {
  throw new Error("ENVIRONMENT is required");
}
if (!authProvider) {
  throw new Error("AUTH_PROVIDER is required");
}

// Validate enum values
validateEnum(environment, "ENVIRONMENT", ["intg", "prod"]);
validateEnum(authProvider, "AUTH_PROVIDER", ["mock", "msal"]);

// Validate URLs if provided
if (azureRedirectUri) {
  validateUrl(azureRedirectUri, "AZURE_REDIRECT_URI");
}
if (azurePostLogoutRedirectUri) {
  validateUrl(azurePostLogoutRedirectUri, "AZURE_POST_LOGOUT_REDIRECT_URI");
}
if (monitoringUrl) {
  validateUrl(monitoringUrl, "MONITORING_URL");
}
if (apiUrl) {
  validateUrl(apiUrl, "API_URL");
}

// Validate UUIDs if provided and AUTH_PROVIDER is msal
if (authProvider === "msal") {
  if (azureClientId) {
    validateUuid(azureClientId, "AZURE_CLIENT_ID");
  }
  if (azureTenantId) {
    validateUuid(azureTenantId, "AZURE_TENANT_ID");
  }
}

// Read template file
const templatePath = join(process.cwd(), "public", "config.js.template");
const template = readFileSync(templatePath, "utf-8");

// Replace template variables with environment values
// Uses generic regex to match any default value (e.g., ${VAR:-default} or ${VAR:-})
const configJs = template
  .replace(/\$\{ENVIRONMENT:-[^}]*\}/g, environment)
  .replace(/\$\{AUTH_PROVIDER:-[^}]*\}/g, authProvider)
  .replace(/\$\{AZURE_CLIENT_ID:-[^}]*\}/g, azureClientId)
  .replace(/\$\{AZURE_REDIRECT_URI:-[^}]*\}/g, azureRedirectUri)
  .replace(/\$\{AZURE_TENANT_ID:-[^}]*\}/g, azureTenantId)
  .replace(/\$\{AZURE_POST_LOGOUT_REDIRECT_URI:-[^}]*\}/g, azurePostLogoutRedirectUri)
  .replace(/\$\{MONITORING_URL:-[^}]*\}/g, monitoringUrl)
  .replace(/\$\{API_URL:-[^}]*\}/g, apiUrl);

// Write config.js to dist directory (where preview serves from)
const distPath = join(process.cwd(), "dist");
const outputPath = join(distPath, "config.js");

// Ensure dist directory exists
try {
  mkdirSync(distPath, { recursive: true });
} catch {
  // Directory might already exist, ignore error
}

writeFileSync(outputPath, configJs, "utf-8");

// Generate health check file (for preview mode - nginx handles it in production)
const healthPath = join(distPath, "health");
writeFileSync(healthPath, "healthy\n", "utf-8");

console.log(`✅ Generated config.js for environment: ${environment}, auth: ${authProvider}`);
console.log(`✅ Generated health check file`);