import type {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  CreatePresetRequestDTO,
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
  PaginatedResult,
  SetPresetActiveRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
  UpdatePresetVersionRequestDTO,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export interface ListNamespacesQuery {
  page?: number;
  limit?: number;
}

export class NamespacesService extends BaseService {
  private readonly basePath = "/namespaces";

  async list(query: ListNamespacesQuery = {}): Promise<PaginatedResult<NamespaceResponseDTO>> {
    return this.getApiClient().get<PaginatedResult<NamespaceResponseDTO>>(
      this.getServiceUrl(this.basePath),
      { params: { page: query.page, limit: query.limit } },
    );
  }

  async getBySlug(slug: string): Promise<NamespaceResponseDTO> {
    return this.getApiClient().get<NamespaceResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}`),
    );
  }

  async listPolicies(slug: string): Promise<NamespacePolicyResponseDTO[]> {
    return this.getApiClient().get<NamespacePolicyResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/policies`),
    );
  }

  async listPresets(slug: string): Promise<NamespacePresetResponseDTO[]> {
    return this.getApiClient().get<NamespacePresetResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/presets`),
    );
  }

  async createNamespace(input: CreateNamespaceRequestDTO): Promise<NamespaceResponseDTO> {
    return this.getApiClient().post<CreateNamespaceRequestDTO, NamespaceResponseDTO>(
      this.getServiceUrl(this.basePath),
      input,
    );
  }

  async updateNamespaceMetadata(
    slug: string,
    input: UpdateNamespaceMetadataRequestDTO,
  ): Promise<NamespaceResponseDTO> {
    return this.getApiClient().patch<UpdateNamespaceMetadataRequestDTO, NamespaceResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}`),
      input,
    );
  }

  async archiveNamespace(slug: string): Promise<NamespaceResponseDTO> {
    return this.getApiClient().post<Record<string, never>, NamespaceResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/archive`),
      {},
    );
  }

  async unarchiveNamespace(slug: string): Promise<NamespaceResponseDTO> {
    return this.getApiClient().post<Record<string, never>, NamespaceResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/unarchive`),
      {},
    );
  }

  async updatePolicy(
    slug: string,
    input: CreatePolicyVersionRequestDTO,
  ): Promise<NamespaceResponseDTO> {
    return this.getApiClient().post<CreatePolicyVersionRequestDTO, NamespaceResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/policy-versions`),
      input,
    );
  }

  async createPreset(
    slug: string,
    input: CreatePresetRequestDTO,
  ): Promise<NamespacePresetResponseDTO> {
    return this.getApiClient().post<CreatePresetRequestDTO, NamespacePresetResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${encodeURIComponent(slug)}/presets`),
      input,
    );
  }

  async updatePresetVersion(
    slug: string,
    name: string,
    input: UpdatePresetVersionRequestDTO,
  ): Promise<NamespacePresetResponseDTO> {
    return this.getApiClient().post<UpdatePresetVersionRequestDTO, NamespacePresetResponseDTO>(
      this.getServiceUrl(
        `${this.basePath}/${encodeURIComponent(slug)}/presets/${encodeURIComponent(name)}/versions`,
      ),
      input,
    );
  }

  async setPresetActive(
    slug: string,
    name: string,
    input: SetPresetActiveRequestDTO,
  ): Promise<NamespacePresetResponseDTO> {
    return this.getApiClient().patch<SetPresetActiveRequestDTO, NamespacePresetResponseDTO>(
      this.getServiceUrl(
        `${this.basePath}/${encodeURIComponent(slug)}/presets/${encodeURIComponent(name)}`,
      ),
      input,
    );
  }
}
