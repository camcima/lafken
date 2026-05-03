import { PassportStrategy } from "@nestjs/passport";
import { BearerStrategy } from "passport-azure-ad";
import { z } from "zod";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";

export const STRATEGY_KEY = "azure-ad-bearer-authz";

const azurePayloadObjSchema = z
  .object({
    oid: z.string(),
    sub: z.string(),
    name: z.string().optional(),
    preferred_username: z.string(),
    roles: z.array(z.string()).optional(),
    bp: z.string(),
  })
  .loose();
export type AzureAdPayload = z.infer<typeof azurePayloadObjSchema>;

export class AzureAdBearerAuthnStrategy extends PassportStrategy(BearerStrategy, STRATEGY_KEY) {
  constructor() {
    const tenantId = environmentConfiguration.AUTH_TENANT_ID ?? "";
    const clientId = environmentConfiguration.AUTH_CLIENT_ID ?? "";

    const identityMetadataUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
    );
    super({
      validateIssuer: true,
      identityMetadata: identityMetadataUrl.toString(),
      clientID: clientId,
      passReqToCallback: false,
    });
  }

  validate(payload: unknown): CurrentAuthenticatedUserDTO {
    const parsedPayload = azurePayloadObjSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new Error("Invalid Azure AD payload structure", {
        cause: parsedPayload.error,
      });
    }

    const validatedPayload = parsedPayload.data;
    return {
      name: validatedPayload.name,
      emailAddress: validatedPayload.preferred_username,
      roles: validatedPayload.roles || [],
      bp: validatedPayload.bp,
    };
  }
}
