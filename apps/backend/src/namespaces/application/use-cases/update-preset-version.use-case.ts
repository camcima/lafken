import { Injectable } from "@nestjs/common";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetVersionConflictError } from "@/namespaces/domain/errors/preset-version-conflict.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import type { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";

const RETRY_LIMIT = 1;

export interface IUpdatePresetVersionInput {
  slug: string;
  name: string;
  params: PresetParams;
  createdBy: string | null;
}

@Injectable()
export class UpdatePresetVersionUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespacePresetWriteRepositoryPort,
  ) {}

  async execute(input: IUpdatePresetVersionInput): Promise<NamespacePreset> {
    const namespace = await this.queryRepository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    if (namespace.props.archivedAt !== null) {
      throw new NamespaceArchivedError({ slug: input.slug });
    }

    const existing = await this.queryRepository.findPresetByName(
      namespace.props.id,
      input.name,
    );
    if (!existing) {
      throw new PresetNotFoundError({ slug: input.slug, name: input.name });
    }

    let lastConflict: PresetVersionConflictError | null = null;
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
      try {
        return await this.writeRepository.createVersion({
          namespaceId: namespace.props.id,
          name: input.name,
          params: input.params,
          createdBy: input.createdBy,
        });
      } catch (err) {
        if (err instanceof PresetVersionConflictError) {
          lastConflict = err;
          continue;
        }
        throw err;
      }
    }
    if (lastConflict) {
      throw new PresetVersionConflictError({
        slug: input.slug,
        name: input.name,
        attemptedVersion: lastConflict.attemptedVersion,
      });
    }
    throw new Error("UpdatePresetVersionUseCase: unreachable");
  }
}
