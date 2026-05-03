import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../../src/app.module";
import { setupApp } from "../../../src/setup-main-app";
import { AppLoggerPort } from "../../../src/shared/application/app-logger.port";
import { DatabaseClient } from "../../../src/shared/infrastructure/persistence/database-client";
import { NoopApplicationWithErrorLoggerMock } from "../../__mocks__/noop-app-logger.service";

/**
 * Creates a new instance of the `AppModule` with real database connection but
 * that does not generate logs but does for the error level.
 * And optionally not relying on real external services if their base URL is set
 * to `https://mock.com`.
 */
export async function createAppModuleForE2ETest() {
  const moduleFixtureBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    // Not relying on the real app logger to avoid polluting the test output
    .overrideProvider(AppLoggerPort)
    .useClass(NoopApplicationWithErrorLoggerMock);

  const moduleFixture = await moduleFixtureBuilder.compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    abortOnError: false,
    autoFlushLogs: false,
  });
  setupApp(app);
  app.useLogger(false); // ensure logs are disabled

  return {
    moduleFixture: moduleFixtureBuilder,
    appFixture: app,
    getDatabaseClient: () => app.get(DatabaseClient),
  };
}
