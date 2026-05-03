import type {
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
  PaginatedResult,
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
}
