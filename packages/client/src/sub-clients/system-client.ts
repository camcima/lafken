import type {
  CreateStorageBindingRequestDTO,
  IntegrationStatusResponseDTO,
  StorageBindingResponseDTO,
  SystemHealthResponseDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";

import type { Transport } from "../transport";

export class SystemClient {
  constructor(private readonly t: Transport) {}

  listStorageBindings(): Promise<StorageBindingResponseDTO[]> {
    return this.t.request<StorageBindingResponseDTO[]>("GET", "/v1/system/storage-bindings");
  }

  getStorageBinding(name: string): Promise<StorageBindingResponseDTO> {
    return this.t.request<StorageBindingResponseDTO>(
      "GET",
      `/v1/system/storage-bindings/${encodeURIComponent(name)}`,
    );
  }

  createStorageBinding(input: CreateStorageBindingRequestDTO): Promise<StorageBindingResponseDTO> {
    return this.t.request<StorageBindingResponseDTO>(
      "POST",
      "/v1/system/storage-bindings",
      input,
    );
  }

  updateStorageBinding(
    name: string,
    patch: UpdateStorageBindingRequestDTO,
  ): Promise<StorageBindingResponseDTO> {
    return this.t.request<StorageBindingResponseDTO>(
      "PATCH",
      `/v1/system/storage-bindings/${encodeURIComponent(name)}`,
      patch,
    );
  }

  deleteStorageBinding(name: string): Promise<void> {
    return this.t.request<void>(
      "DELETE",
      `/v1/system/storage-bindings/${encodeURIComponent(name)}`,
    );
  }

  listIntegrations(): Promise<IntegrationStatusResponseDTO[]> {
    return this.t.request<IntegrationStatusResponseDTO[]>("GET", "/v1/system/integrations");
  }

  getHealth(): Promise<SystemHealthResponseDTO> {
    return this.t.request<SystemHealthResponseDTO>("GET", "/v1/system/health");
  }
}
