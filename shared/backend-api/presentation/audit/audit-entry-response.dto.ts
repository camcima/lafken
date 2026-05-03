import { ApiProperty } from "@nestjs/swagger";

export class AuditEntryResponseDTO {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  occurredBy!: string;

  @ApiProperty({ required: false, type: Object })
  beforeState?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  afterState?: Record<string, unknown>;

  @ApiProperty({ required: false, type: String })
  reason?: string;

  @ApiProperty()
  occurredAt!: string;
}
