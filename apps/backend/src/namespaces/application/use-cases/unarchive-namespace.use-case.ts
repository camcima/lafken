import { Injectable } from "@nestjs/common";

import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";

@Injectable()
export class UnarchiveNamespaceUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
  ) {}

  async execute(input: { slug: string }): Promise<NamespaceWithMetadata> {
    const existing = await this.queryRepository.findBySlug(input.slug);
    if (!existing) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const namespace: Namespace =
      existing.props.archivedAt === null
        ? existing
        : await this.writeRepository.unarchive(input.slug);

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
