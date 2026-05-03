import type { QuarantinedAssetView } from "../entities/quarantined-asset-view.entity";
import type { QuarantineKind } from "../value-objects/quarantine-kind.value-object";

export interface ListQuarantineInput {
  page: number;
  limit: number;
  kind?: QuarantineKind;
  namespaceSlug?: string;
  flaggedFrom?: string;
  flaggedTo?: string;
}

export interface QuarantinedAssetPage {
  data: QuarantinedAssetView[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export abstract class QuarantineQueryRepositoryPort {
  abstract list(input: ListQuarantineInput): Promise<QuarantinedAssetPage>;
}
