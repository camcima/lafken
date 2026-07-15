import { applyDecorators, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { UnauthorizedErrorResponseDTO } from "../dto/unauthorized-error.dto";
import { OidcBearerAuthnGuard } from "../oidc/oidc-bearer-authn.guard";

/**
 * Use this in controller methods that are only accessible to authenticated users
 * via OIDC Bearer authentication strategy.
 */
export const AuthenticatedEndpoint = () => {
  const isCloudEndpointDefinition: boolean = environmentConfiguration.CLOUD_ENDPOINT_DEFINITION;

  return applyDecorators(
    UseGuards(OidcBearerAuthnGuard),
    isCloudEndpointDefinition ? () => {} : ApiBearerAuth(),
    ApiExtraModels(UnauthorizedErrorResponseDTO),
    ApiUnauthorizedResponse({
      content: {
        "application/problem+json": {
          schema: {
            $ref: getSchemaPath(UnauthorizedErrorResponseDTO),
          },
        },
      },
    }),
  );
};
