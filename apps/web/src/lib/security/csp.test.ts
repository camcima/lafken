import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const nginxConf = readFileSync(resolve(__dirname, "../../../nginx.conf"), "utf8");

function extractCspHeader(conf: string): string {
  const match = conf.match(/add_header Content-Security-Policy "([^"]+)"/);
  if (!match) throw new Error("CSP header not found in nginx.conf");
  return match[1];
}

describe("nginx Content-Security-Policy", () => {
  const csp = extractCspHeader(nginxConf);

  it("sets default-src to self", () => {
    expect(csp).toMatch(/\bdefault-src 'self'/);
  });

  it("does not allow unsafe-inline or unsafe-eval for scripts", () => {
    const scriptSrc = csp.match(/script-src[^;]+/)?.[0] ?? "";
    expect(scriptSrc).not.toMatch(/'unsafe-inline'/);
    expect(scriptSrc).not.toMatch(/'unsafe-eval'/);
  });

  it("uses a per-request nonce for script-src", () => {
    expect(csp).toMatch(/script-src[^;]*'nonce-\$csp_nonce'/);
  });

  it("denies framing via frame-ancestors 'none'", () => {
    expect(csp).toMatch(/\bframe-ancestors 'none'/);
  });

  it("disallows plugins via object-src 'none'", () => {
    expect(csp).toMatch(/\bobject-src 'none'/);
  });

  it("locks base-uri to self", () => {
    expect(csp).toMatch(/\bbase-uri 'self'/);
  });

  it("restricts form-action to self", () => {
    expect(csp).toMatch(/\bform-action 'self'/);
  });
});
