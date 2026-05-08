import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import {
  IUpdateNamespaceMetadataInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface IUpdateNamespaceMetadataInputWithActor extends IUpdateNamespaceMetadataInput {
  occurredBy: string | null;
  requestIp: string | null;
}

@Injectable()
export class UpdateNamespaceMetadataUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
  ) {}

  async execute(input: IUpdateNamespaceMetadataInputWithActor): Promise<NamespaceWithMetadata> {
    const existing = await this.queryRepository.findBySlug(input.slug);
    if (!existing) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }

    const namespace = await this.writeRepository.updateMetadata({
      slug: input.slug,
      displayName: input.displayName,
      description: input.description,
    });

    const [storageBindingName, currentPolicyVersion] = await Promise.all([
      this.queryRepository.findStorageBindingName(namespace.props.storageBindingId),
      this.queryRepository.findCurrentPolicyVersion(namespace.props.id),
    ]);

    await this.auditWriteRepo.record({
      entityType: "namespace",
      entityId: namespace.props.slug.value,
      action: "update",
      occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
      requestIp: input.requestIp,
      beforeState: {
        displayName: existing.props.displayName,
        description: existing.props.description,
      },
      afterState: {
        displayName: namespace.props.displayName,
        description: namespace.props.description,
      },
    });

    return {
      namespace,
      storageBindingName: storageBindingName ?? "unknown",
      currentPolicyVersion: currentPolicyVersion ?? 0,
    };
  }
}
