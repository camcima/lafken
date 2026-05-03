export type IntegrationStatusValue = "configured" | "not_configured";

export interface IIntegrationStatus {
  port: string;
  adapter: string;
  status: IntegrationStatusValue;
  detail: string | null;
}

export abstract class IntegrationStatusReader {
  abstract read(): Promise<IIntegrationStatus[]>;
}
