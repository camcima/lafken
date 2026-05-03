import { HealthIndicatorService } from "@nestjs/terminus";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { DatabaseHealthIndicatorService } from "@/health/application/services/database-health-indicator.service";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

describe("DatabaseHealthIndicatorService", () => {
  let service: DatabaseHealthIndicatorService;
  let loggerMock: ReturnType<typeof mock<AppLoggerPort>>;
  let databaseClientMock: ReturnType<typeof mock<DatabaseClient>>;
  let healthIndicatorServiceMock: ReturnType<typeof mock<HealthIndicatorService>>;

  beforeEach(() => {
    loggerMock = mock<AppLoggerPort>();
    databaseClientMock = mock<DatabaseClient>();
    healthIndicatorServiceMock = mock<HealthIndicatorService>();

    service = new DatabaseHealthIndicatorService(
      loggerMock,
      databaseClientMock,
      healthIndicatorServiceMock,
    );
  });

  describe("isHealthy", () => {
    it("should return up indicator when database connection is healthy", async () => {
      const indicatorMock = {
        key: "database",
        up: vi.fn().mockReturnValue({ database: { status: "up" } }),
        down: vi.fn(),
      };

      healthIndicatorServiceMock.check.mockReturnValue(indicatorMock as any);
      databaseClientMock.isConnected.mockResolvedValue({ ok: true });

      const result = await service.isHealthy();

      expect(result).toEqual({ database: { status: "up" } });
      expect(databaseClientMock.isConnected).toHaveBeenCalledWith({
        retryAttempts: 2,
        retryDelayMs: 2_000,
      });
      expect(indicatorMock.up).toHaveBeenCalled();
      expect(indicatorMock.down).not.toHaveBeenCalled();
      expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it("should return down indicator when database connection fails", async () => {
      const connectionError = new Error("Connection failed");
      const indicatorMock = {
        key: "database",
        up: vi.fn(),
        down: vi
          .fn()
          .mockReturnValue({ database: { status: "down", message: "Database connection failed" } }),
      };

      healthIndicatorServiceMock.check.mockReturnValue(indicatorMock as any);
      databaseClientMock.isConnected.mockResolvedValue({ ok: false, error: connectionError });

      const result = await service.isHealthy();

      expect(result).toEqual({
        database: { status: "down", message: "Database connection failed" },
      });
      expect(indicatorMock.down).toHaveBeenCalledWith({ message: "Database connection failed" });
      expect(loggerMock.error).toHaveBeenCalledWith(connectionError.message);
    });

    it("should return down indicator when database connection throws Error", async () => {
      const connectionError = new Error("Connection timeout");
      const indicatorMock = {
        key: "database",
        up: vi.fn(),
        down: vi
          .fn()
          .mockReturnValue({ database: { status: "down", message: "Database connection failed" } }),
      };

      healthIndicatorServiceMock.check.mockReturnValue(indicatorMock as any);
      databaseClientMock.isConnected.mockRejectedValue(connectionError);

      const result = await service.isHealthy();

      expect(result).toEqual({
        database: { status: "down", message: "Database connection failed" },
      });
      expect(loggerMock.error).toHaveBeenCalledWith("Connection timeout");
    });

    it("should handle unknown error types", async () => {
      const unknownError = "Unknown error";
      const indicatorMock = {
        key: "database",
        up: vi.fn(),
        down: vi
          .fn()
          .mockReturnValue({ database: { status: "down", message: "Database connection failed" } }),
      };

      healthIndicatorServiceMock.check.mockReturnValue(indicatorMock as any);
      databaseClientMock.isConnected.mockRejectedValue(unknownError);

      const result = await service.isHealthy();

      expect(result).toEqual({
        database: { status: "down", message: "Database connection failed" },
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Unknown error during database health check",
        unknownError,
      );
    });
  });
});
