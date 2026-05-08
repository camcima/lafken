import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface ISetPresetActiveInput {
  slug: string;
  name: string;
  active: boolean;
  occurredBy: string | null;
  requestIp: string | null;
}

@Injectable()
export class SetPresetActiveUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespacePresetWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
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
    const updated = await this.writeRepository.setActive({
      namespaceId: namespace.props.id,
      name: input.name,
      active: input.active,
    });

    if (existing.props.active !== updated.props.active) {
      await this.auditWriteRepo.record({
        entityType: "namespace_preset",
        entityId: `${namespace.props.slug.value}/${updated.props.name}`,
        action: "update",
        occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        beforeState: { active: existing.props.active },
        afterState: { active: updated.props.active },
      });
    }

    return updated;
  }
}
