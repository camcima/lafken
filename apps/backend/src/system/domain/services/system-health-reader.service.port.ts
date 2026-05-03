import type { IIntegrationStatus } from "./integration-status-reader.service.port";

export type HealthStatusValue = "ok" | "degraded" | "failing" | "unknown";

export interface ISystemHealthIndicator {
  name: string;
  status: HealthStatusValue;
  detail: string | null;
}

export interface ISystemHealthSnapshot {
  overall: HealthStatusValue;
  indicators: ISystemHealthIndicator[];
  integrations: IIntegrationStatus[];
}

export abstract class SystemHealthReader {
  abstract read(): Promise<ISystemHealthSnapshot>;
}
