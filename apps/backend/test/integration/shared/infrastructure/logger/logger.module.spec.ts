import { Test } from "@nestjs/testing";

import { LoggerModule } from "@/shared/infrastructure/logger/logger.module";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { NoopDatabaseModuleMock } from "../../../../__mocks__/noop-database-module";

describe("LoggerModule (without database connection)", () => {
  test("should be inialized with no dependencies errors", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [LoggerModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(NoopDatabaseModuleMock)
      .compile();

    const app = moduleFixture.createNestApplication();

    expect(app).toBeDefined();
    await expect(app.init()).resolves.not.toThrow();

    // tear down
    await app.close();
  });
});
