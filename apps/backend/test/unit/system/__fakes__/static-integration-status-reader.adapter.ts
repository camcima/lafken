import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";
import { IntegrationStatusReader } from "@/system/domain/services/integration-status-reader.service.port";

export class StaticIntegrationStatusReaderAdapter extends IntegrationStatusReader {
  private statuses: IIntegrationStatus[] = [];

  seed(statuses: IIntegrationStatus[]): void {
    this.statuses = statuses;
  }

  read(): Promise<IIntegrationStatus[]> {
    return Promise.resolve([...this.statuses]);
  }
}
