import { ApiProperty } from "@nestjs/swagger";

export class StorageBindingResponseDTO {
  @ApiProperty({ description: "UUIDv7 storage binding ID" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["gcs"] })
  adapterType!: "gcs";

  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}
