import { Injectable } from "@nestjs/common";

import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import { LegalHoldQueryRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";

import type { LegalHoldWithMetadata } from "./list-legal-holds.use-case";

@Injectable()
export class GetLegalHoldByIdUseCase {
  constructor(private readonly repository: LegalHoldQueryRepositoryPort) {}

  async execute(input: { id: string }): Promise<LegalHoldWithMetadata> {
    const legalHold = await this.repository.findById(input.id);
    if (!legalHold) {
      throw new LegalHoldNotFoundError({ id: input.id });
    }

    const affectedAssetCount = await this.repository.countAffectedAssets(legalHold.props.id);

    return { legalHold, affectedAssetCount };
  }
}
