import { Injectable } from "@nestjs/common";

import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

import type { NamespaceWithMetadata } from "./list-namespaces.use-case";

@Injectable()
export class GetNamespaceBySlugUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  async execute(input: { slug: string }): Promise<NamespaceWithMetadata> {
    const namespace = await this.repository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const [storageBindingName, currentPolicyVersion] = await Promise.all([
      this.repository.findStorageBindingName(namespace.props.storageBindingId),
      this.repository.findCurrentPolicyVersion(namespace.props.id),
    ]);

    return {
      namespace,
      storageBindingName: storageBindingName ?? "unknown",
      currentPolicyVersion: currentPolicyVersion ?? 0,
    };
  }
}
