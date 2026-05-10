import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface IUnarchiveNamespaceInput {
  slug: string;
  occurredBy: string | null;
  requestIp: string | null;
}

@Injectable()
export class UnarchiveNamespaceUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: IUnarchiveNamespaceInput): Promise<NamespaceWithMetadata> {
    const existing = await this.queryRepository.findBySlug(input.slug);
    if (!existing) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const wasArchived: boolean = existing.props.archivedAt !== null;

    const [storageBindingName, currentPolicyVersion] = await Promise.all([
      this.queryRepository.findStorageBindingName(existing.props.storageBindingId),
      this.queryRepository.findCurrentPolicyVersion(existing.props.id),
    ]);

    if (!wasArchived) {
      return {
        namespace: existing,
        storageBindingName: storageBindingName ?? "unknown",
        currentPolicyVersion: currentPolicyVersion ?? 0,
      };
    }

    const namespace: Namespace = await this.unitOfWork.execute(async () => {
      const unarchived = await this.writeRepository.unarchive(input.slug);

      await this.auditWriteRepo.record({
        entityType: "namespace",
        entityId: unarchived.props.slug.value,
        action: "unarchive",
        occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        beforeState: { archivedAt: existing.props.archivedAt?.toISOString() ?? null },
        afterState: { archivedAt: null },
      });

      return unarchived;
    });

    return {
      namespace,
      storageBindingName: storageBindingName ?? "unknown",
      currentPolicyVersion: currentPolicyVersion ?? 0,
    };
  }
}
