import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface IArchiveNamespaceInput {
  slug: string;
  occurredBy: string | null;
}

@Injectable()
export class ArchiveNamespaceUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
  ) {}

  async execute(input: IArchiveNamespaceInput): Promise<NamespaceWithMetadata> {
    const existing = await this.queryRepository.findBySlug(input.slug);
    if (!existing) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const wasArchived: boolean = existing.props.archivedAt !== null;
    const namespace: Namespace = wasArchived
      ? existing
      : await this.writeRepository.archive(input.slug);

    const [storageBindingName, currentPolicyVersion] = await Promise.all([
      this.queryRepository.findStorageBindingName(namespace.props.storageBindingId),
      this.queryRepository.findCurrentPolicyVersion(namespace.props.id),
    ]);

    if (!wasArchived) {
      await this.auditWriteRepo.record({
        entityType: "namespace",
        entityId: namespace.props.slug.value,
        action: "archive",
        occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
        beforeState: { archivedAt: null },
        afterState: { archivedAt: namespace.props.archivedAt?.toISOString() ?? null },
      });
    }

    return {
      namespace,
      storageBindingName: storageBindingName ?? "unknown",
      currentPolicyVersion: currentPolicyVersion ?? 0,
    };
  }
}
