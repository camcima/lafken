import { ApiProperty } from "@nestjs/swagger";

export class CreateUploadIntentResponseDTO {
  @ApiProperty()
  publicId!: string;

  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty({ type: Object, additionalProperties: { type: "string" } })
  uploadHeaders!: Record<string, string>;

  @ApiProperty({ description: "ISO-8601 timestamp when the URL expires" })
  expiresAt!: string;
}
