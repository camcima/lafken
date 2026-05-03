import { Injectable } from "@nestjs/common";

import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

@Injectable()
export class ListNamespacePoliciesUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  async execute(input: { slug: string }): Promise<NamespacePolicy[]> {
    const namespace = await this.repository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    return this.repository.listPolicies(namespace.props.id);
  }
}
