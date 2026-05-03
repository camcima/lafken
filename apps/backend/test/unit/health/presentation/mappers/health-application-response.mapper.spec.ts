import { HealthCheckResultResponseDTO } from "@/health/presentation/dto/health-check-result.dto";
import { HealthApplicationResponseMapper } from "@/health/presentation/mappers/health-application-response.mapper";

describe("HealthApplicationResponseMapper", () => {
  describe(".fromDomain()", () => {
    it("should map HealthCheckResult to HealthCheckResultResponseDTO", () => {
      const dto = HealthApplicationResponseMapper.fromDomain({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: { database: { status: "up" } },
        error: {},
      });

      expect(dto).toEqual<HealthCheckResultResponseDTO>({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: { database: { status: "up" } },
        error: {},
      });
    });

    it("should map HealthCheckResult to HealthCheckResultResponseDTO when no info is provided", () => {
      const dto = HealthApplicationResponseMapper.fromDomain({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: undefined,
        error: {},
      });

      expect(dto).toEqual<HealthCheckResultResponseDTO>({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: {},
        error: {},
      });
    });

    it("should map HealthCheckResult to HealthCheckResultResponseDTO when no error is provided", () => {
      const dto = HealthApplicationResponseMapper.fromDomain({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: {},
        error: undefined,
      });

      expect(dto).toEqual<HealthCheckResultResponseDTO>({
        details: {
          database: { status: "up" },
        },
        status: "ok",
        info: {},
        error: {},
      });
    });
  });
});
