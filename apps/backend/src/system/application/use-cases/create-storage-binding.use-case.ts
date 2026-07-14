import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { NIL_UUID } from "@/shared/kernel/domain/nil-uuid.constant";
import { gcsBindingConfigSchema } from "@/system/application/gcs-binding-config.schema";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { DuplicateStorageBindingNameError } from "@/system/domain/errors/duplicate-storage-binding-name.error";
import {
  InvalidStorageBindingConfigError,
  type IStorageBindingConfigViolation,
} from "@/system/domain/errors/invalid-storage-binding-config.error";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";
import { BucketExistsCheckerPort } from "@/system/domain/services/bucket-exists-checker.service.port";
import { StorageBindingName } from "@/system/domain/value-objects/storage-binding-name.value-object";

const AUDIT_FALLBACK_PRINCIPAL = "system";

interface ICreateStorageBindingInput {
  name: string;
  adapterType: "gcs";
  config: unknown;
  occurredBy: string | null;
  requestIp: string | null;
}

@Injectable()
export class CreateStorageBindingUseCase {
  constructor(
    private readonly queryRepository: StorageBindingQueryRepositoryPort,
    private readonly writeRepository: StorageBindingWriteRepositoryPort,
    private readonly bucketExistsChecker: BucketExistsCheckerPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
  ) {}

  async execute(input: ICreateStorageBindingInput): Promise<StorageBinding> {
    const name: StorageBindingName = StorageBindingName.fromString(input.name);

    const parsed = gcsBindingConfigSchema.safeParse(input.config);
    if (!parsed.success) {
      const violations: IStorageBindingConfigViolation[] = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));
      throw new InvalidStorageBindingConfigError({ violations });
    }

    const existing: StorageBinding | null = await this.queryRepository.findByName(name.value);
    if (existing) {
      throw new DuplicateStorageBindingNameError({ name: name.value });
    }

    await this.bucketExistsChecker.checkBucketExists({
      adapterType: input.adapterType,
      config: parsed.data,
    });

    const now: Date = new Date();
    const binding: StorageBinding = StorageBinding.fromProps({
      id: NIL_UUID,
      name: name.value,
      adapterType: input.adapterType,
      config: parsed.data,
      createdAt: now,
      updatedAt: now,
    });

    const inserted: StorageBinding = await this.writeRepository.insert(binding);

    await this.auditWriteRepo.record({
      entityType: "storage_binding",
      entityId: inserted.props.name,
      action: "create",
      occurredBy: input.occurredBy ?? AUDIT_FALLBACK_PRINCIPAL,
      requestIp: input.requestIp,
      afterState: {
        name: inserted.props.name,
        adapterType: inserted.props.adapterType,
      },
    });

    return inserted;
  }
}
