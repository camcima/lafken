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

import type { Transport } from "../transport";

export interface IListNamespacesQuery {
  page?: number;
  limit?: number;
}

export class NamespacesClient {
  constructor(private readonly t: Transport) {}

  list(q: IListNamespacesQuery = {}): Promise<PaginatedResult<NamespaceResponseDTO>> {
    const url = this.t.buildUrl("/v1/namespaces");
    if (q.page !== undefined) url.searchParams.set("page", String(q.page));
    if (q.limit !== undefined) url.searchParams.set("limit", String(q.limit));
    return this.t.request<PaginatedResult<NamespaceResponseDTO>>("GET", url.toString());
  }

  get(slug: string): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>(
      "GET",
      `/v1/namespaces/${encodeURIComponent(slug)}`,
    );
  }

  create(input: CreateNamespaceRequestDTO): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>("POST", "/v1/namespaces", input);
  }

  updateMetadata(
    slug: string,
    patch: UpdateNamespaceMetadataRequestDTO,
  ): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>(
      "PATCH",
      `/v1/namespaces/${encodeURIComponent(slug)}`,
      patch,
    );
  }

  archive(slug: string): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>(
      "POST",
      `/v1/namespaces/${encodeURIComponent(slug)}/archive`,
      {},
    );
  }

  unarchive(slug: string): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>(
      "POST",
      `/v1/namespaces/${encodeURIComponent(slug)}/unarchive`,
      {},
    );
  }

  listPolicies(slug: string): Promise<NamespacePolicyResponseDTO[]> {
    return this.t.request<NamespacePolicyResponseDTO[]>(
      "GET",
      `/v1/namespaces/${encodeURIComponent(slug)}/policies`,
    );
  }

  createPolicyVersion(
    slug: string,
    input: CreatePolicyVersionRequestDTO,
  ): Promise<NamespaceResponseDTO> {
    return this.t.request<NamespaceResponseDTO>(
      "POST",
      `/v1/namespaces/${encodeURIComponent(slug)}/policy-versions`,
      input,
    );
  }

  listPresets(slug: string): Promise<NamespacePresetResponseDTO[]> {
    return this.t.request<NamespacePresetResponseDTO[]>(
      "GET",
      `/v1/namespaces/${encodeURIComponent(slug)}/presets`,
    );
  }

  createPreset(slug: string, input: CreatePresetRequestDTO): Promise<NamespacePresetResponseDTO> {
    return this.t.request<NamespacePresetResponseDTO>(
      "POST",
      `/v1/namespaces/${encodeURIComponent(slug)}/presets`,
      input,
    );
  }

  updatePresetVersion(
    slug: string,
    name: string,
    input: UpdatePresetVersionRequestDTO,
  ): Promise<NamespacePresetResponseDTO> {
    return this.t.request<NamespacePresetResponseDTO>(
      "POST",
      `/v1/namespaces/${encodeURIComponent(slug)}/presets/${encodeURIComponent(name)}/versions`,
      input,
    );
  }

  setPresetActive(
    slug: string,
    name: string,
    body: SetPresetActiveRequestDTO,
  ): Promise<NamespacePresetResponseDTO> {
    return this.t.request<NamespacePresetResponseDTO>(
      "PATCH",
      `/v1/namespaces/${encodeURIComponent(slug)}/presets/${encodeURIComponent(name)}`,
      body,
    );
  }
}
