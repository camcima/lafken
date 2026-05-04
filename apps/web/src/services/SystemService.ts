import type {
  CreateStorageBindingRequestDTO,
  IntegrationStatusResponseDTO,
  StorageBindingResponseDTO,
  SystemHealthResponseDTO,
  UpdateStorageBindingRequestDTO,
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
      this.getServiceUrl(`${this.basePath}/storage-bindings/${encodeURIComponent(name)}`),
    );
  }

  async createStorageBinding(
    input: CreateStorageBindingRequestDTO,
  ): Promise<StorageBindingResponseDTO> {
    return this.getApiClient().post<CreateStorageBindingRequestDTO, StorageBindingResponseDTO>(
      this.getServiceUrl(`${this.basePath}/storage-bindings`),
      input,
    );
  }

  async updateStorageBinding(
    name: string,
    input: UpdateStorageBindingRequestDTO,
  ): Promise<StorageBindingResponseDTO> {
    return this.getApiClient().patch<UpdateStorageBindingRequestDTO, StorageBindingResponseDTO>(
      this.getServiceUrl(`${this.basePath}/storage-bindings/${encodeURIComponent(name)}`),
      input,
    );
  }

  async deleteStorageBinding(name: string): Promise<void> {
    await this.getApiClient().delete(
      this.getServiceUrl(`${this.basePath}/storage-bindings/${encodeURIComponent(name)}`),
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
