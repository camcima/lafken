import { Injectable } from "@nestjs/common";

import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import {
  IUpdateNamespaceMetadataInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";

@Injectable()
export class UpdateNamespaceMetadataUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
  ) {}

  async execute(input: IUpdateNamespaceMetadataInput): Promise<NamespaceWithMetadata> {
    const existing = await this.queryRepository.findBySlug(input.slug);
    if (!existing) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const namespace = await this.writeRepository.updateMetadata(input);

    const [storageBindingName, currentPolicyVersion] = await Promise.all([
      this.queryRepository.findStorageBindingName(namespace.props.storageBindingId),
      this.queryRepository.findCurrentPolicyVersion(namespace.props.id),
    ]);

    return {
      namespace,
      storageBindingName: storageBindingName ?? "unknown",
      currentPolicyVersion: currentPolicyVersion ?? 0,
    };
  }
}
