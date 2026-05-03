import type {
  IntegrationStatusResponseDTO,
  StorageBindingResponseDTO,
  SystemHealthResponseDTO,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export class SystemService extends BaseService {
  private readonly basePath = "/system";

  async listStorageBindings(): Promise<StorageBindingResponseDTO[]> {
    return this.getApiClient().get<StorageBindingResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/storage-bindings`),
    );
  }

  async getStorageBindingByName(name: string): Promise<StorageBindingResponseDTO> {
    return this.getApiClient().get<StorageBindingResponseDTO>(
      this.getServiceUrl(`${this.basePath}/storage-bindings/${name}`),
    );
  }

  async listIntegrations(): Promise<IntegrationStatusResponseDTO[]> {
    return this.getApiClient().get<IntegrationStatusResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/integrations`),
    );
  }

  async getHealth(): Promise<SystemHealthResponseDTO> {
    return this.getApiClient().get<SystemHealthResponseDTO>(
      this.getServiceUrl(`${this.basePath}/health`),
    );
  }
}
