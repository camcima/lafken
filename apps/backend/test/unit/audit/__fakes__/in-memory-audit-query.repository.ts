import type { AuditEntry } from "@/audit/domain/entities/audit-entry.entity";
import {
  AuditPage,
  AuditQueryRepositoryPort,
  ListAuditInput,
} from "@/audit/domain/repositories/audit-query.repository.port";

export class InMemoryAuditQueryRepository implements AuditQueryRepositoryPort {
  private entries: AuditEntry[] = [];

  seed(entries: AuditEntry[]): void {
    this.entries = entries;
  }

  list(input: ListAuditInput): Promise<AuditPage> {
    const total = this.entries.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: this.entries.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }
}
