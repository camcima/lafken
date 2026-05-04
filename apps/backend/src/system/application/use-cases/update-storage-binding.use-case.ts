import { Injectable } from "@nestjs/common";

import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import {
  type IStorageBindingConfigViolation,
  InvalidStorageBindingConfigError,
} from "@/system/domain/errors/invalid-storage-binding-config.error";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";
import { gcsBindingConfigSchema } from "@/system/domain/schemas/gcs-binding-config.schema";
import { BucketExistsCheckerPort } from "@/system/domain/services/bucket-exists-checker.service.port";

interface IUpdateStorageBindingInput {
  name: string;
  config: unknown;
}

@Injectable()
export class UpdateStorageBindingUseCase {
  constructor(
    private readonly queryRepository: StorageBindingQueryRepositoryPort,
    private readonly writeRepository: StorageBindingWriteRepositoryPort,
    private readonly bucketExistsChecker: BucketExistsCheckerPort,
  ) {}

  async execute(input: IUpdateStorageBindingInput): Promise<StorageBinding> {
    const existing: StorageBinding | null = await this.queryRepository.findByName(input.name);
    if (!existing) {
      throw new StorageBindingNotFoundError({ name: input.name });
    }

    const parsed = gcsBindingConfigSchema.safeParse(input.config);
    if (!parsed.success) {
      const violations: IStorageBindingConfigViolation[] = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));
      throw new InvalidStorageBindingConfigError({ violations });
    }

    await this.bucketExistsChecker.checkBucketExists({
      adapterType: existing.props.adapterType,
      config: parsed.data,
    });

    const updated: StorageBinding = StorageBinding.fromProps({
      ...existing.props,
      config: parsed.data,
      updatedAt: new Date(),
    });

    return this.writeRepository.update(updated);
  }
}
