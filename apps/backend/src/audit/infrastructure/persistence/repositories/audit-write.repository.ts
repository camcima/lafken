import { Injectable } from "@nestjs/common";

import {
  AuditWriteRepositoryPort,
  type IRecordAuditInput,
} from "@/audit/domain/repositories/audit-write.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";

@Injectable()
export class AuditWriteRepository extends AuditWriteRepositoryPort {
  constructor(private readonly resolver: ConnectionResolver) {
    super();
  }

  async record(input: IRecordAuditInput): Promise<void> {
    await this.resolver
      .resolve()
      .insertInto("configuration_audit_log")
      .values({
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        occurred_by: input.occurredBy,
        before_state: input.beforeState ?? null,
        after_state: input.afterState ?? null,
        reason: input.reason ?? null,
        request_ip: input.requestIp ?? null,
      })
      .execute();
  }
}
