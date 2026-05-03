export interface IAuditEntryProps {
  id: bigint;
  entityType: string;
  entityId: string;
  action: string;
  occurredBy: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AuditEntry {
  constructor(public readonly props: IAuditEntryProps) {}

  static fromProps(props: IAuditEntryProps): AuditEntry {
    return new AuditEntry(props);
  }
}
