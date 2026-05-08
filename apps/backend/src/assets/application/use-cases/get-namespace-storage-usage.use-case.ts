import { Injectable } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

export interface IGetNamespaceStorageUsageInput {
  namespaceSlug: string;
}

export interface IGetNamespaceStorageUsageResult {
  namespaceSlug: string;
  totalBytes: bigint;
  assetCount: number;
}

@Injectable()
export class GetNamespaceStorageUsageUseCase {
  constructor(
    private readonly assetQueryRepository: AssetQueryRepositoryPort,
    private readonly namespaceQueryRepository: NamespaceQueryRepositoryPort,
  ) {}

  async execute(input: IGetNamespaceStorageUsageInput): Promise<IGetNamespaceStorageUsageResult> {
    const namespace = await this.namespaceQueryRepository.findBySlug(input.namespaceSlug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.namespaceSlug });
    }

    const usage = await this.assetQueryRepository.getNamespaceStorageUsage(namespace.props.id);

    return {
      namespaceSlug: input.namespaceSlug,
      totalBytes: usage.totalBytes,
      assetCount: usage.assetCount,
    };
  }
}
