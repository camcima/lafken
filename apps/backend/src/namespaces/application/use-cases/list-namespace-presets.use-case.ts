import { Injectable } from "@nestjs/common";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

@Injectable()
export class ListNamespacePresetsUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  async execute(input: { slug: string }): Promise<NamespacePreset[]> {
    const namespace = await this.repository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    return this.repository.listPresets(namespace.props.id);
  }
}
