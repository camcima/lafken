import { Injectable } from "@nestjs/common";

import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

@Injectable()
export class ListAssetStateTransitionsUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: { publicId: string }): Promise<AssetStateTransition[]> {
    const asset = await this.repository.findByPublicId(input.publicId);

    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    return this.repository.listStateTransitions(asset.props.id);
  }
}
