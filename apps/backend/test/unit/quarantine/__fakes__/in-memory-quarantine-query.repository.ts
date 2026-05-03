import type { QuarantinedAssetView } from "@/quarantine/domain/entities/quarantined-asset-view.entity";
import {
  ListQuarantineInput,
  QuarantinedAssetPage,
  QuarantineQueryRepositoryPort,
} from "@/quarantine/domain/repositories/quarantine-query.repository.port";

export class InMemoryQuarantineQueryRepository implements QuarantineQueryRepositoryPort {
  private views: QuarantinedAssetView[] = [];

  seed(views: QuarantinedAssetView[]): void {
    this.views = views;
  }

  list(input: ListQuarantineInput): Promise<QuarantinedAssetPage> {
    const total = this.views.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: this.views.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }
}
