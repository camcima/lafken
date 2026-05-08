import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNameAlreadyExistsError } from "@/namespaces/domain/errors/preset-name-already-exists.error";
import { ReservedPresetNameError } from "@/namespaces/domain/errors/reserved-preset-name.error";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import type { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { SYSTEM_PRESET_NAME_PREFIX } from "@/shared/kernel/domain/preset-naming";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface ICreatePresetInput {
  slug: string;
  name: string;
  params: PresetParams;
  createdBy: string | null;
  requestIp: string | null;
}

@Injectable()
export class CreatePresetUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespacePresetWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
  ) {}

  async execute(input: ICreatePresetInput): Promise<NamespacePreset> {
    if (input.name.toLowerCase().startsWith(SYSTEM_PRESET_NAME_PREFIX)) {
      throw new ReservedPresetNameError({
        presetName: input.name,
        reservedPrefix: SYSTEM_PRESET_NAME_PREFIX,
      });
    }

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
      const preset = await this.writeRepository.createPreset({
        namespaceId: namespace.props.id,
        name: input.name,
        params: input.params,
        createdBy: input.createdBy,
      });
      await this.auditWriteRepo.record({
        entityType: "namespace_preset",
        entityId: `${namespace.props.slug.value}/${preset.props.name}`,
        action: "create",
        occurredBy: input.createdBy ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        afterState: {
          namespace: namespace.props.slug.value,
          name: preset.props.name,
          version: preset.props.version,
        },
      });
      return preset;
    } catch (err) {
      if (err instanceof PresetNameAlreadyExistsError) {
        throw new PresetNameAlreadyExistsError({ slug: input.slug, name: input.name });
      }
      throw err;
    }
  }
}
