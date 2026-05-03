import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Type,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { Mock } from "vitest";
import { mock } from "vitest-mock-extended";

import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";
import {
  CatchAllExceptionsForHttp,
  IProblemDetailsJsonBody,
} from "@/shared/presentation/middlewares/catch-all-exceptions.filter";

function setupFactory() {
  const argumentsHostMock = mock<ArgumentsHost>();
  const httpCtxMock = mock<ReturnType<ArgumentsHost["switchToHttp"]>>({
    getResponse: vi.fn().mockReturnValue(mock()),
  });
  argumentsHostMock.switchToHttp.mockReturnValue(httpCtxMock);

  return {
    argumentsHostMock,
    httpCtxMock,
  };
}

describe("CatchAllExceptionsForHttp", () => {
  let moduleFixture: TestingModule;
  let httpAdapterSetHeaderSpy: Mock<HttpAdapterHost["httpAdapter"]["setHeader"]>;
  let httpAdapterReplySpy: Mock<HttpAdapterHost["httpAdapter"]["reply"]>;

  beforeEach(async () => {
    httpAdapterSetHeaderSpy = vi.fn();
    httpAdapterReplySpy = vi.fn();

    moduleFixture = await Test.createTestingModule({
      imports: [],
      providers: [CatchAllExceptionsForHttp],
    })
      .overrideProvider(HttpAdapterHost)
      .useValue(
        mock<HttpAdapterHost>({
          httpAdapter: {
            setHeader: httpAdapterSetHeaderSpy,
            reply: httpAdapterReplySpy,
          },
        }),
      )
      .useMocker(() => mock<unknown>())
      .compile();
  });

  describe("#catch()", () => {
    describe("When supplying a `BadRequestException` exception with no `cause` defined", () => {
      it("should invoke `HttpAdapter#reply()` with the right values", () => {
        const exceptionFilter = moduleFixture.get(CatchAllExceptionsForHttp);
        const { argumentsHostMock } = setupFactory();
        const caughtException = new BadRequestException("My error message here");

        const expectedResponseStatus = 400;

        const exceptionFilterResult = exceptionFilter.catch(caughtException, argumentsHostMock);

        const expectedResponseBody: IProblemDetailsJsonBody = {
          type: "about:blank",
          title: BadRequestException.name,
          status: expectedResponseStatus,
          detail: "My error message here",
          errors: ["My error message here"],
        };

        expect(exceptionFilterResult).toBeUndefined();
        expect(httpAdapterReplySpy).toHaveBeenCalledTimes(1);
        expect(httpAdapterSetHeaderSpy).toHaveBeenCalled();

        expect(httpAdapterReplySpy.mock.calls[0][1]).toEqual(expectedResponseBody);
        expect(httpAdapterReplySpy.mock.calls[0][2]).toEqual(expectedResponseStatus);
      });
    });

    describe("When supplying a `HttpException` exception with no `cause` defined", () => {
      it.each([
        [NotFoundException, 404],
        [UnauthorizedException, 401],
        [ForbiddenException, 403],
        [InternalServerErrorException, 500],
      ])(
        "should invoke `HttpAdapter#reply()` with the right values",
        (ExceptionClass: Type<HttpException>, expectedResponseStatus: number) => {
          const exceptionFilter = moduleFixture.get(CatchAllExceptionsForHttp);
          const { argumentsHostMock } = setupFactory();
          const caughtException = new ExceptionClass("My error message here");

          const exceptionFilterResult = exceptionFilter.catch(caughtException, argumentsHostMock);

          const expectedResponseBody: IProblemDetailsJsonBody = {
            type: "about:blank",
            title: ExceptionClass.name,
            status: expectedResponseStatus,
            detail: "My error message here",
          };

          expect(exceptionFilterResult).toBeUndefined();
          expect(httpAdapterReplySpy).toHaveBeenCalledTimes(1);
          expect(httpAdapterSetHeaderSpy).toHaveBeenCalled();

          expect(httpAdapterReplySpy.mock.calls[0][1]).toEqual(expectedResponseBody);
          expect(httpAdapterReplySpy.mock.calls[0][2]).toEqual(expectedResponseStatus);
        },
      );
    });

    describe("When supplying a `HttpException` exception with a `DomainError` as a `cause`", () => {
      it.each([
        [NotFoundException, 404],
        [BadRequestException, 400],
        [UnauthorizedException, 401],
        [ForbiddenException, 403],
        [InternalServerErrorException, 500],
      ])(
        "should invoke `HttpAdapter#reply()` with the right values",
        (ExceptionClass: Type<HttpException>, expectedResponseStatus: number) => {
          const exceptionFilter = moduleFixture.get(CatchAllExceptionsForHttp);
          const { argumentsHostMock } = setupFactory();

          class MyDomainError extends DomainError {
            constructor() {
              super({
                message: "My domain error message",
              });
            }
          }

          const caughtException = new ExceptionClass("My error message here", {
            cause: new MyDomainError(),
          });

          const exceptionFilterResult = exceptionFilter.catch(caughtException, argumentsHostMock);

          const expectedResponseBody: IProblemDetailsJsonBody = {
            type: "about:blank",
            code: "MyDomainError",
            title: "MyDomainError",
            status: expectedResponseStatus,
            detail: "My domain error message",
          };

          expect(exceptionFilterResult).toBeUndefined();
          expect(httpAdapterReplySpy).toHaveBeenCalledTimes(1);
          expect(httpAdapterSetHeaderSpy).toHaveBeenCalled();

          expect(httpAdapterReplySpy.mock.calls[0][1]).toEqual(expectedResponseBody);
          expect(httpAdapterReplySpy.mock.calls[0][2]).toEqual(expectedResponseStatus);
        },
      );
    });
  });
});
