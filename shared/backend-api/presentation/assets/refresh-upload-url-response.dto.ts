import { ApiProperty } from "@nestjs/swagger";

export class RefreshUploadUrlResponseDTO {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty({ type: Object, additionalProperties: { type: "string" } })
  uploadHeaders!: Record<string, string>;

  @ApiProperty({ description: "ISO-8601 timestamp when the new URL expires" })
  expiresAt!: string;
}
