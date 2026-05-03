import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetQueryRepositoryPort,
  ListAssetsInput,
} from "@/assets/domain/repositories/asset-query.repository.port";

export interface AssetWithMetadata {
  asset: Asset;
  namespaceSlug: string;
  policyVersion: number;
}

export interface AssetWithMetadataPage {
  data: AssetWithMetadata[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

@Injectable()
export class ListAssetsUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: ListAssetsInput): Promise<AssetWithMetadataPage> {
    const page = await this.repository.list(input);

    const data = await Promise.all(
      page.data.map(async (asset) => {
        const [namespaceSlug, policyVersion] = await Promise.all([
          this.repository.findNamespaceSlug(asset.props.namespaceId),
          this.repository.findPolicyVersion(asset.props.policyVersionId),
        ]);
        return {
          asset,
          namespaceSlug: namespaceSlug ?? "unknown",
          policyVersion: policyVersion ?? 0,
        };
      }),
    );

    return {
      data,
      total: page.total,
      page: page.page,
      limit: page.limit,
      lastPage: page.lastPage,
    };
  }
}
