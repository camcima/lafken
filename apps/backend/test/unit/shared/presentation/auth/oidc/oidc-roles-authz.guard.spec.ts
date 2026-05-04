import { ArgumentsHost, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { mock } from "vitest-mock-extended";

import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedUser } from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import {
  OidcRoles,
  OidcRolesAuthzGuard,
} from "@/shared/presentation/auth/oidc/oidc-roles-authz.guard";

/** Utility */
function makeHttpCtxMock(authenticatedUser: AuthenticatedUser) {
  const httpCtxMock = mock<ReturnType<ArgumentsHost["switchToHttp"]>>({
    getResponse: vi.fn().mockReturnValue(mock()),
    getRequest: vi.fn().mockReturnValue({
      user: authenticatedUser,
    }),
  });
  return httpCtxMock;
}

describe("OidcRolesAuthzGuard for HTTP handlers", () => {
  let reflector: Reflector;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [],
    }).compile();

    reflector = moduleFixture.get(Reflector);
  });

  describe("#canActivate()", () => {
    describe("When the route has no required roles", () => {
      it("should return `true`", () => {
        const contextMock = mock<ExecutionContext>();
        const reflectorMock = mock<Reflector>();

        const guardSUT = new OidcRolesAuthzGuard(reflectorMock);

        const canActivateResult = guardSUT.canActivate(contextMock);

        expect(canActivateResult).toBe(true);
        // ensure that metadata was retrieved for both handler and class
        expect(contextMock.getHandler).toHaveBeenCalled();
        expect(contextMock.getClass).toHaveBeenCalled();
      });
    });

    describe("When the route required roles defined at class level with `@OidcRoles()`", () => {
      describe("And the current user has at least one of the required roles", () => {
        it("should return `true`", () => {
          const httpCtxMock = makeHttpCtxMock({
            emailAddress: "foo@gmail.com",
            roles: [ApplicationRole.PLATFORM_OPERATOR, ApplicationRole.CONTENT_REVIEWER],
            bp: "123",
          });
          const contextMock = mock<ExecutionContext>();

          @OidcRoles([ApplicationRole.PLATFORM_OPERATOR])
          class Foo {}

          contextMock.getHandler.mockReturnValue(() => {});
          contextMock.getClass.mockReturnValue(Foo);
          contextMock.switchToHttp.mockReturnValue(httpCtxMock);

          const guardSUT = new OidcRolesAuthzGuard(reflector);

          const canActivateResult = guardSUT.canActivate(contextMock);

          expect(canActivateResult).toBe(true);
        });
      });
    });
  });
});
