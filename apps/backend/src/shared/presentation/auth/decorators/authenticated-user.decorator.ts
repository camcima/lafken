import { createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";

/**
 * Parameter decorator that extracts the currently authenticated user.
 * This requires the usage of `AuthenticatedEndpoint` or `EndpointRequiredRoles`
 * decorators on the controller or in its method to ensure that the user is
 * authenticated.
 */
export const AuthenticatedUser = createParamDecorator<never>((_, ctx) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = request.user;
  return user;
});

export type AuthenticatedUser = CurrentAuthenticatedUserDTO;
