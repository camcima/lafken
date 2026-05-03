/* v8 ignore file */
import { HttpStatus, Module, RequestMethod, Scope } from "@nestjs/common";
import { LoggerModule as NestjsPinoLoggerModule, PinoLogger } from "nestjs-pino";

import { AppLoggerPort } from "@/shared/application/app-logger.port";

import { environmentConfiguration } from "../environment.configuration";

@Module({
  imports: [
    NestjsPinoLoggerModule.forRootAsync({
      useFactory: () => {
        return {
          forRoutes: [{ method: RequestMethod.ALL, path: "*splat" }],
          pinoHttp: {
            level: environmentConfiguration.LOG_LEVEL,
            redact: ["req.headers.authorization", "req.headers.cookie"],
            serializers: {
              res(value) {
                const statusCode = value?.statusCode;
                // For bad request responses, we will log the response body
                if (statusCode === HttpStatus.BAD_REQUEST) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  return {
                    ...value,
                    responseBody: value?.raw?.locals?.responseBody,
                  };
                } else {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  return value;
                }
              },
            },
            formatters: {
              bindings: (bindings) => ({
                pid: bindings.pid,
              }),
              level: (label: string) => {
                return {
                  level: label,
                };
              },
            },
            transport:
              environmentConfiguration.PRETTY_LOGS === true
                ? {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      translateTime: "SYS:standard",
                      ignore: "pid,hostname",
                    },
                  }
                : undefined,
          },
        };
      },
    }),
  ],
  providers: [
    {
      provide: AppLoggerPort,
      scope: Scope.TRANSIENT,
      useClass: PinoLogger,
    },
  ],
  exports: [AppLoggerPort],
})
export class LoggerModule {}
