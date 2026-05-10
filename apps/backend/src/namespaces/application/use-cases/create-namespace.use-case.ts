import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { NamespaceWithMetadata } from "@/namespaces/application/namespace-with-metadata.type";
import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import {
  ICreateNamespaceInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface ICreateNamespaceUseCaseInput extends ICreateNamespaceInput {
  requestIp: string | null;
}

@Injectable()
export class CreateNamespaceUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: ICreateNamespaceUseCaseInput): Promise<NamespaceWithMetadata> {
    new Slug(input.slug);

    const existing = await this.queryRepository.findBySlug(input.slug);
    if (existing) {
      throw new NamespaceAlreadyExistsError({ slug: input.slug });
    }

    return this.unitOfWork.execute(async () => {
      const namespace = await this.writeRepository.createWithInitialPolicy(input);

      const [storageBindingName, currentPolicyVersion] = await Promise.all([
        this.queryRepository.findStorageBindingName(namespace.props.storageBindingId),
        this.queryRepository.findCurrentPolicyVersion(namespace.props.id),
      ]);

      await this.auditWriteRepo.record({
        entityType: "namespace",
        entityId: namespace.props.slug.value,
        action: "create",
        occurredBy: input.createdBy ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        afterState: {
          slug: namespace.props.slug.value,
          displayName: namespace.props.displayName,
          description: namespace.props.description,
          storageBinding: storageBindingName ?? null,
        },
      });

      return {
        namespace,
        storageBindingName: storageBindingName ?? "unknown",
        currentPolicyVersion: currentPolicyVersion ?? 0,
      };
    });
  }
}
