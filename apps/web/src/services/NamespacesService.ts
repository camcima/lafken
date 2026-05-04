import type {
  CreateNamespaceRequestDTO,
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
  PaginatedResult,
  UpdateNamespaceMetadataRequestDTO,
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
      this.getServiceUrl(`${this.basePath}/${slug}`),
    );
  }

  async listPolicies(slug: string): Promise<NamespacePolicyResponseDTO[]> {
    return this.getApiClient().get<NamespacePolicyResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${slug}/policies`),
    );
  }

  async listPresets(slug: string): Promise<NamespacePresetResponseDTO[]> {
    return this.getApiClient().get<NamespacePresetResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${slug}/presets`),
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
}
