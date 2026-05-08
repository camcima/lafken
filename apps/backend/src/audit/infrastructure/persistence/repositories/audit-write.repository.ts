import { Injectable } from "@nestjs/common";

import {
  AuditWriteRepositoryPort,
  type IRecordAuditInput,
} from "@/audit/domain/repositories/audit-write.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

/**
 * Writes config-mutating events to `configuration_audit_log`. Failures here
 * are logged at error level but do not throw — the audit log is best-effort
 * relative to the underlying mutation that already committed. We never want
 * a transient audit-table issue to mask a successful business operation.
 */
@Injectable()
export class AuditWriteRepository extends AuditWriteRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: AppLoggerPort,
  ) {
    super();
    this.logger.setContext(AuditWriteRepository.name);
  }

  async record(input: IRecordAuditInput): Promise<void> {
    try {
      await this.db.connection
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
    } catch (err) {
      this.logger.error(
        {
          err: err instanceof Error ? err.message : String(err),
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
        },
        "audit write failed",
      );
    }
  }
}
