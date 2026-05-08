import {
  AuditWriteRepositoryPort,
  IRecordAuditInput,
} from "@/audit/domain/repositories/audit-write.repository.port";

export class InMemoryAuditWriteRepository implements AuditWriteRepositoryPort {
  public readonly records: IRecordAuditInput[] = [];

  record(input: IRecordAuditInput): Promise<void> {
    this.records.push(input);
    return Promise.resolve();
  }
}
