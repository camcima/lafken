import { Test } from "@nestjs/testing";

import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";
import { TelemetryModule } from "@/shared/infrastructure/telemetry/telemetry.module";

import { NoopDatabaseModuleMock } from "../../../__mocks__/noop-database-module";

describe("TelemetryModule (without database connection)", () => {
  test("should be inialized with no dependencies errors", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TelemetryModule],
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
