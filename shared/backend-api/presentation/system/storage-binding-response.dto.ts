import { ApiProperty } from "@nestjs/swagger";

export class StorageBindingResponseDTO {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["gcs", "s3", "local"] })
  adapterType!: "gcs" | "s3" | "local";

  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;

  @ApiProperty()
  encryptedCredsPresent!: boolean;

  @ApiProperty()
  createdAt!: string;
}
