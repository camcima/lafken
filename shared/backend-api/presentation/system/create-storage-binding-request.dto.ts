import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsObject, IsString, Matches } from "class-validator";

export class CreateStorageBindingRequestDTO {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/)
  @ApiProperty({ example: "lafken-prod" })
  name!: string;

  @IsIn(["gcs"])
  @ApiProperty({ enum: ["gcs"] })
  adapterType!: "gcs";

  @IsObject()
  @ApiProperty({ type: Object, example: { bucket: "lafken-dev", projectId: "lafken-prod-1" } })
  config!: Record<string, unknown>;
}
