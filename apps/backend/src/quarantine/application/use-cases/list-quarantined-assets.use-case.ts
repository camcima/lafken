import { Injectable } from "@nestjs/common";

import {
  ListQuarantineInput,
  QuarantinedAssetPage,
  QuarantineQueryRepositoryPort,
} from "@/quarantine/domain/repositories/quarantine-query.repository.port";

@Injectable()
export class ListQuarantinedAssetsUseCase {
  constructor(private readonly repository: QuarantineQueryRepositoryPort) {}

  async execute(input: ListQuarantineInput): Promise<QuarantinedAssetPage> {
    return this.repository.list(input);
  }
}
