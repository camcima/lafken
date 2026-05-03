import { Injectable } from "@nestjs/common";

import {
  AuditPage,
  AuditQueryRepositoryPort,
  ListAuditInput,
} from "@/audit/domain/repositories/audit-query.repository.port";

@Injectable()
export class ListAuditEntriesUseCase {
  constructor(private readonly repository: AuditQueryRepositoryPort) {}

  async execute(input: ListAuditInput): Promise<AuditPage> {
    return this.repository.list(input);
  }
}
