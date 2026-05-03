import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiExtraModels, ApiForbiddenResponse, getSchemaPath } from "@nestjs/swagger";

import type { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { ForbiddenErrorResponseDTO } from "../dto/forbidden-error.dto";
import { OidcRoles, OidcRolesAuthzGuard } from "../oidc/oidc-roles-authz.guard";
import { AuthenticatedEndpoint } from "./authenticated-endpoint.decorator";

/**
 * Use this decorator to mark the roles required to access a given endpoint.
 * If no roles are specified, the endpoint is accessible to all authenticated users.
 * If the current authenticated user has at least one of the required roles,
 * access is granted.
 *
 * This will also loads the `AuthenticatedEndpoint` as the authentication is
 * a pre-step to authorization.
 */
export const EndpointRequiredRoles = (roles: ApplicationRole[]) =>
  applyDecorators(
    AuthenticatedEndpoint(),
    UseGuards(OidcRolesAuthzGuard),
    OidcRoles(roles),
    ApiExtraModels(ForbiddenErrorResponseDTO),
    ApiForbiddenResponse({
      content: {
        "application/problem+json": {
          schema: {
            $ref: getSchemaPath(ForbiddenErrorResponseDTO),
          },
        },
      },
    }),
  );
