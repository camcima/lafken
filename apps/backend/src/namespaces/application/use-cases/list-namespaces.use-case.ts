import { Injectable } from "@nestjs/common";

import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import {
  ListNamespacesInput,
  NamespaceQueryRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-query.repository.port";

export type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";

export interface NamespaceWithMetadataPage {
  data: NamespaceWithMetadata[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

@Injectable()
export class ListNamespacesUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  async execute(input: ListNamespacesInput): Promise<NamespaceWithMetadataPage> {
    const page = await this.repository.list(input);

    const data = await Promise.all(
      page.data.map(async (namespace) => {
        const [storageBindingName, currentPolicyVersion] = await Promise.all([
          this.repository.findStorageBindingName(namespace.props.storageBindingId),
          this.repository.findCurrentPolicyVersion(namespace.props.id),
        ]);
        return {
          namespace,
          storageBindingName: storageBindingName ?? "unknown",
          currentPolicyVersion: currentPolicyVersion ?? 0,
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
