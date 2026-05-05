import { Injectable } from "@nestjs/common";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

export interface ISetPresetActiveInput {
  slug: string;
  name: string;
  active: boolean;
}

@Injectable()
export class SetPresetActiveUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespacePresetWriteRepositoryPort,
  ) {}

  async execute(input: ISetPresetActiveInput): Promise<NamespacePreset> {
    const namespace = await this.queryRepository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    if (namespace.props.archivedAt !== null) {
      throw new NamespaceArchivedError({ slug: input.slug });
    }
    const existing = await this.queryRepository.findPresetByName(namespace.props.id, input.name);
    if (!existing) {
      throw new PresetNotFoundError({ slug: input.slug, name: input.name });
    }
    return this.writeRepository.setActive({
      namespaceId: namespace.props.id,
      name: input.name,
      active: input.active,
    });
  }
}
