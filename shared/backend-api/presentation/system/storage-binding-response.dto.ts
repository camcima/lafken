import { ApiProperty } from "@nestjs/swagger";

export class StorageBindingResponseDTO {
  @ApiProperty({ description: "Numeric ID as string for bigint-safety" })
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
