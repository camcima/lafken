import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import type { AuthenticatedUser } from "../decorators/authenticated-user.decorator";

/**
 * Marks the roles required to access a given endpoint.
 * If no roles are specified, the endpoint is accessible to all authenticated users.
 * If the current authenticated user has at least one of the required roles,
 * access is granted.
 *
 * Used for `OidcRolesAuthzGuard` guard.
 */
export const OidcRoles = Reflector.createDecorator<ApplicationRole[]>();

@Injectable()
export class OidcRolesAuthzGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride(OidcRoles, [ctx.getHandler(), ctx.getClass()]) || [];

    // If no roles are required for the endpoint or the controller, allow access
    if (requiredRoles.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const currUser = req.user as AuthenticatedUser | undefined;
    // If there is no authenticated user or not `roles` property, deny access
    if (!currUser || !currUser.roles) {
      return false;
    }

    for (const role of requiredRoles) {
      const userHasOneOfRequiredRoles = currUser.roles.includes(role);
      if (userHasOneOfRequiredRoles) {
        return true;
      }
    }

    throw new ForbiddenException("Insufficient permissions");
  }
}
