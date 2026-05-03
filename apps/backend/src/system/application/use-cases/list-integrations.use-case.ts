import { Injectable } from "@nestjs/common";

import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";
import { IntegrationStatusReader } from "@/system/domain/services/integration-status-reader.service.port";

@Injectable()
export class ListIntegrationsUseCase {
  constructor(private readonly integrationReader: IntegrationStatusReader) {}

  async execute(): Promise<IIntegrationStatus[]> {
    return this.integrationReader.read();
  }
}
