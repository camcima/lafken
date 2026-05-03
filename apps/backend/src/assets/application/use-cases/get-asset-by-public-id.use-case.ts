import { Injectable } from "@nestjs/common";

import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

import type { AssetWithMetadata } from "./list-assets.use-case";

@Injectable()
export class GetAssetByPublicIdUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: { publicId: string }): Promise<AssetWithMetadata> {
    const asset = await this.repository.findByPublicId(input.publicId);

    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    const [namespaceSlug, policyVersion] = await Promise.all([
      this.repository.findNamespaceSlug(asset.props.namespaceId),
      this.repository.findPolicyVersion(asset.props.policyVersionId),
    ]);

    return {
      asset,
      namespaceSlug: namespaceSlug ?? "unknown",
      policyVersion: policyVersion ?? 0,
    };
  }
}
