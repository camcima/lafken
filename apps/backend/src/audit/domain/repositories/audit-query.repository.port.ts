import type { AuditEntry } from "../entities/audit-entry.entity";

export interface ListAuditInput {
  page: number;
  limit: number;
  principal?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  occurredFrom?: string;
  occurredTo?: string;
}

export interface AuditPage {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export abstract class AuditQueryRepositoryPort {
  abstract list(input: ListAuditInput): Promise<AuditPage>;
}
