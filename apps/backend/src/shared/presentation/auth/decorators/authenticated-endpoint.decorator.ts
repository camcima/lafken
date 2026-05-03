import { applyDecorators, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";

import { UnauthorizedErrorResponseDTO } from "../dto/unauthorized-error.dto";
import { OidcBearerAuthnGuard } from "../oidc/oidc-bearer-authn.guard";

/**
 * Use this in controller methods that are only accessible to authenticated users
 * via OIDC Bearer authentication strategy.
 */
export const AuthenticatedEndpoint = () => {
  // eslint-disable-next-line no-process-env
  const IS_CLOUD_ENDPOINT_DEFINITION = process.env.CLOUD_ENDPOINT_DEFINITION === "true";

  return applyDecorators(
    UseGuards(OidcBearerAuthnGuard),
    IS_CLOUD_ENDPOINT_DEFINITION ? () => {} : ApiBearerAuth(),
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
