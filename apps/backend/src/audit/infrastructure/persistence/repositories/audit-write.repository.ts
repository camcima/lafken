import { Injectable } from "@nestjs/common";

import {
  AuditWriteRepositoryPort,
  type IRecordAuditInput,
} from "@/audit/domain/repositories/audit-write.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";

// Best-effort writer: failures are logged but never thrown so a transient audit
// issue can't roll back the business mutation that already committed.
@Injectable()
export class AuditWriteRepository extends AuditWriteRepositoryPort {
  constructor(
    private readonly resolver: ConnectionResolver,
    private readonly logger: AppLoggerPort,
  ) {
    super();
    this.logger.setContext(AuditWriteRepository.name);
  }

  async record(input: IRecordAuditInput): Promise<void> {
    try {
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
