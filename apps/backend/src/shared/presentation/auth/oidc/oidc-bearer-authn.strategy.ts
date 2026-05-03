import { UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import jwksRsa from "jwks-rsa";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { z } from "zod";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";

export const STRATEGY_KEY = "oidc-bearer";

const oidcPayloadObjSchema = z
  .object({
    sub: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
    preferred_username: z.string().optional(),
    roles: z.array(z.string()).optional(),
  })
  .loose();

export class OidcBearerAuthnStrategy extends PassportStrategy(JwtStrategy, STRATEGY_KEY) {
  constructor() {
    const issuer: string = environmentConfiguration.OIDC_ISSUER ?? "";
    const audience: string = environmentConfiguration.OIDC_AUDIENCE ?? "";
    if (!issuer || !audience) {
      throw new Error("OIDC_ISSUER and OIDC_AUDIENCE must be set when AUTH_PROVIDER=oidc");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer,
      audience,
      algorithms: ["RS256", "ES256"],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
      }),
      passReqToCallback: false,
    });
  }

  validate(payload: unknown): CurrentAuthenticatedUserDTO {
    const parsed = oidcPayloadObjSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid OIDC token payload");
    }
    const principalClaim = environmentConfiguration.OIDC_PRINCIPAL_CLAIM;
    const rolesClaim = environmentConfiguration.OIDC_ROLES_CLAIM;
    const principalRaw =
      parsed.data[principalClaim] ?? parsed.data.preferred_username ?? parsed.data.sub;
    const rolesRaw = parsed.data[rolesClaim];
    return {
      name: parsed.data.name,
      emailAddress: typeof principalRaw === "string" ? principalRaw : parsed.data.sub,
      roles: Array.isArray(rolesRaw) ? rolesRaw.map(String) : [],
      bp: parsed.data.sub,
    };
  }
}
