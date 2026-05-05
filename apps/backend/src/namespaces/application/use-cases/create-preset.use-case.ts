import { Injectable } from "@nestjs/common";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNameAlreadyExistsError } from "@/namespaces/domain/errors/preset-name-already-exists.error";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import type { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";

export interface ICreatePresetInput {
  slug: string;
  name: string;
  params: PresetParams;
  createdBy: string | null;
}

@Injectable()
export class CreatePresetUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespacePresetWriteRepositoryPort,
  ) {}

  async execute(input: ICreatePresetInput): Promise<NamespacePreset> {
    const namespace = await this.queryRepository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    if (namespace.props.archivedAt !== null) {
      throw new NamespaceArchivedError({ slug: input.slug });
    }

    const existing = await this.queryRepository.findPresetByName(namespace.props.id, input.name);
    if (existing) {
      throw new PresetNameAlreadyExistsError({ slug: input.slug, name: input.name });
    }

    try {
      return await this.writeRepository.createPreset({
        namespaceId: namespace.props.id,
        name: input.name,
        params: input.params,
        createdBy: input.createdBy,
      });
    } catch (err) {
      if (err instanceof PresetNameAlreadyExistsError) {
        throw new PresetNameAlreadyExistsError({ slug: input.slug, name: input.name });
      }
      throw err;
    }
  }
}
