import type {
  AssetResponseDTO,
  ListQuarantineQueryDTO,
  PaginatedResult,
  QuarantinedAssetResponseDTO,
  RejectQuarantinedAssetRequestDTO,
  ReleaseQuarantinedAssetRequestDTO,
} from "@shared/backend-api";

import type { Transport } from "../transport";

export class QuarantineClient {
  constructor(private readonly t: Transport) {}

  list(q: Partial<ListQuarantineQueryDTO> = {}): Promise<PaginatedResult<QuarantinedAssetResponseDTO>> {
    const url = this.t.buildUrl("/v1/quarantine");
    const entries = Object.entries(q) as [string, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    return this.t.request<PaginatedResult<QuarantinedAssetResponseDTO>>("GET", url.toString());
  }

  release(publicId: string, body: ReleaseQuarantinedAssetRequestDTO): Promise<AssetResponseDTO> {
    return this.t.request<AssetResponseDTO>(
      "POST",
      `/v1/quarantine/${encodeURIComponent(publicId)}/release`,
      body,
    );
  }

  reject(publicId: string, body: RejectQuarantinedAssetRequestDTO): Promise<AssetResponseDTO> {
    return this.t.request<AssetResponseDTO>(
      "POST",
      `/v1/quarantine/${encodeURIComponent(publicId)}/reject`,
      body,
    );
  }
}
