import { applyDecorators, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";

import { AzureAdBearerAuthnGuard } from "../azure-ad/azure-ad-bearer-authn.guard";
import { UnauthorizedErrorResponseDTO } from "../dto/unauthorized-error.dto";

/**
 * Use this in controller methods that are only accessible to authenticated users
 * via Azure AD Bearer authentication strategy.
 */
export const AuthenticatedEndpoint = () => {
  // eslint-disable-next-line no-process-env
  const IS_CLOUD_ENDPOINT_DEFINITION = process.env.CLOUD_ENDPOINT_DEFINITION === "true";

  return applyDecorators(
    UseGuards(AzureAdBearerAuthnGuard),
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
