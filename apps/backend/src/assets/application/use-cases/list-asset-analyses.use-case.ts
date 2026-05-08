import { Injectable } from "@nestjs/common";

import type { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

@Injectable()
export class ListAssetAnalysesUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: { id: string }): Promise<AssetAnalysis[]> {
    const asset = await this.repository.findById(input.id);

    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.id });
    }

    return this.repository.listAnalyses(asset.props.id);
  }
}
