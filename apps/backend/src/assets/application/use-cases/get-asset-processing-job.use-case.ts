import { Injectable } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { ProcessingJobNotFoundError } from "@/assets/domain/errors/processing-job-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

@Injectable()
export class GetAssetProcessingJobUseCase {
  constructor(private readonly repository: AssetQueryRepositoryPort) {}

  async execute(input: { publicId: string }): Promise<ProcessingJob> {
    const asset = await this.repository.findByPublicId(input.publicId);

    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    const job = await this.repository.findProcessingJob(asset.props.id);

    if (!job) {
      throw new ProcessingJobNotFoundError({ publicId: input.publicId });
    }

    return job;
  }
}
