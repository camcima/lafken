/* eslint-disable */

process.env.NODE_ENV = "test";
process.env.APP_PORT = "3000";
process.env.LOG_LEVEL = "info";
process.env.PRETTY_LOGS = "false";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "5432";
process.env.DB_USER = "";
process.env.DB_NAME = "";
process.env.DB_PASSWORD = "";
process.env.AUTH_PROVIDER = "oidc";
process.env.OIDC_ISSUER = "http://localhost:8095";
process.env.OIDC_AUDIENCE = "lafken-api";

import fs from "node:fs";
import path from "node:path";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../app.module";
import { DatabaseClient } from "../shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "../shared/infrastructure/persistence/database-unit-of-work";
import {
  DatabaseModule,
} from "../shared/infrastructure/persistence/database.module";
import { setupApp } from "../setup-main-app";
import { DatabaseAsyncLocalStorage } from "../shared/infrastructure/persistence/database-async-local-storage";

const LOCAL_OPENAPI_DEFINITION_FILE_PATH = "docs/be-openapi.yaml";
const CLOUD_ENDPOINT_OPENAPI_DEFINITION_FILE_PATH = "deploy/endpoints/openapi.yaml.erb";

@Module({
  providers: [
    {
      provide: DatabaseClient,
      useFactory: () => {
        return new Proxy({}, {});
      },
    },
    {
      provide: DatabaseUnitOfWork,
      useFactory: () => {
        return new Proxy({}, {});
      },
    },
    {
      provide: DatabaseAsyncLocalStorage,
      useFactory: () => {
        return new Proxy({}, {});
      },
    },
  ],
  exports: [DatabaseClient, DatabaseUnitOfWork, DatabaseAsyncLocalStorage],
})
class NoopDatabaseModule {}

async function generateOpenApiSpec(filePath: string) {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(DatabaseModule)
    .useModule(NoopDatabaseModule)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  setupApp(app);

  const res = await request(app.getHttpServer()).get("/openapi.yaml").expect(200);
  await app.close();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, res.text);
  console.info(`OpenAPI spec. generated at ${filePath}`);
}

// Only if the script is run directly (not imported as a module)
if (require.main === module) {
  const openApiFilePath = process.env.CLOUD_ENDPOINT_DEFINITION === "true"
    ? CLOUD_ENDPOINT_OPENAPI_DEFINITION_FILE_PATH
    : LOCAL_OPENAPI_DEFINITION_FILE_PATH;
  void generateOpenApiSpec(openApiFilePath).catch((error) => {
    console.error("Error generating OpenAPI spec:", error);
    process.exitCode = 1;
  });
}
