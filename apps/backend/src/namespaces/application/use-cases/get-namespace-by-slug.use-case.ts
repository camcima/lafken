import { Injectable } from "@nestjs/common";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

@Injectable()
export class GetNamespaceBySlugUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  async execute(input: { slug: string }): Promise<Namespace> {
    const namespace = await this.repository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    return namespace;
  }
}
