import { Injectable } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { AssetsNotFoundForLegalHoldError } from "@/legal-holds/domain/errors/assets-not-found-for-legal-hold.error";
import { EmptyAssetSelectionError } from "@/legal-holds/domain/errors/empty-asset-selection.error";
import { LegalHoldWriteRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-write.repository.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

const MAX_NAMESPACE_SLUGS_IN_SUMMARY = 3;

export interface IPlaceLegalHoldUseCaseInput {
  caseReference: string;
  description: string;
  assetIds: string[]; // public ids, possibly with duplicates
  placedBy: string;
  requestIp: string | null;
}

@Injectable()
export class PlaceLegalHoldUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly writeRepo: LegalHoldWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: IPlaceLegalHoldUseCaseInput): Promise<LegalHold> {
    const dedupedPublicIds = [...new Set(input.assetIds)];
    if (dedupedPublicIds.length === 0) {
      throw new EmptyAssetSelectionError();
    }

    const resolved =
      await this.assetQueryRepo.findInternalIdsAndNamespaceSlugsByPublicIds(dedupedPublicIds);

    if (resolved.length !== dedupedPublicIds.length) {
      const foundPublicIds = new Set(resolved.map((resolution) => resolution.publicId));
      const missingPublicIds = dedupedPublicIds.filter((publicId) => !foundPublicIds.has(publicId));
      throw new AssetsNotFoundForLegalHoldError({ missingPublicIds });
    }

    const scopeSummary = buildScopeSummary({
      assetCount: resolved.length,
      namespaceSlugs: resolved.map((resolution) => resolution.namespaceSlug),
    });

    return this.unitOfWork.execute(async () => {
      const hold: LegalHold = await this.writeRepo.placeHold({
        caseReference: input.caseReference,
        description: input.description,
        scopeSummary,
        placedBy: input.placedBy,
        assetInternalIds: resolved.map((resolution) => resolution.id),
      });

      await this.auditWriteRepo.record({
        entityType: "legal_hold",
        entityId: hold.props.id,
        action: "place",
        occurredBy: input.placedBy,
        requestIp: input.requestIp,
        afterState: {
          caseReference: hold.props.caseReference,
          scopeSummary: hold.props.scopeSummary,
          assetCount: resolved.length,
        },
      });

      return hold;
    });
  }
}

function buildScopeSummary(args: { assetCount: number; namespaceSlugs: string[] }): string {
  const uniqueSlugs = [...new Set(args.namespaceSlugs)].sort((a, b) => a.localeCompare(b));
  const head = uniqueSlugs.slice(0, MAX_NAMESPACE_SLUGS_IN_SUMMARY).join(", ");
  const remainder = uniqueSlugs.length - MAX_NAMESPACE_SLUGS_IN_SUMMARY;
  const suffix = remainder > 0 ? `, …and ${remainder} more` : "";
  return `${args.assetCount} asset(s) across namespace ${head}${suffix}`;
}
