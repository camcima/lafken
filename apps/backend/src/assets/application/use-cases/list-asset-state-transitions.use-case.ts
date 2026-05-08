import { Injectable } from "@nestjs/common";

import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

@Injectable()
export class ListAssetStateTransitionsUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: { id: string }): Promise<AssetStateTransition[]> {
    const asset = await this.repository.findById(input.id);

    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.id });
    }

    return this.repository.listStateTransitions(asset.props.id);
  }
}
