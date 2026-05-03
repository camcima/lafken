import { Injectable } from "@nestjs/common";

import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import { LegalHoldQueryRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";

import type { LegalHoldWithMetadata } from "./list-legal-holds.use-case";

@Injectable()
export class GetLegalHoldByIdUseCase {
  constructor(private readonly repository: LegalHoldQueryRepositoryPort) {}

  async execute(input: { id: string }): Promise<LegalHoldWithMetadata> {
    let id: bigint;
    try {
      id = BigInt(input.id);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new LegalHoldNotFoundError({ id: input.id });
      }
      throw err;
    }

    const legalHold = await this.repository.findById(id);
    if (!legalHold) {
      throw new LegalHoldNotFoundError({ id: input.id });
    }

    const affectedAssetCount = await this.repository.countAffectedAssets(legalHold.props.id);

    return { legalHold, affectedAssetCount };
  }
}
