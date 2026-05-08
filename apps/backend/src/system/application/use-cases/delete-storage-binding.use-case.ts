import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

interface IDeleteStorageBindingInput {
  name: string;
  occurredBy: string | null;
}

@Injectable()
export class DeleteStorageBindingUseCase {
  constructor(
    private readonly queryRepository: StorageBindingQueryRepositoryPort,
    private readonly writeRepository: StorageBindingWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
  ) {}

  async execute(input: IDeleteStorageBindingInput): Promise<void> {
    const existing: StorageBinding | null = await this.queryRepository.findByName(input.name);
    if (!existing) {
      throw new StorageBindingNotFoundError({ name: input.name });
    }

    await this.writeRepository.delete(input.name);

    await this.auditWriteRepo.record({
      entityType: "storage_binding",
      entityId: existing.props.name,
      action: "delete",
      occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
      beforeState: {
        name: existing.props.name,
        adapterType: existing.props.adapterType,
      },
    });
  }
}
