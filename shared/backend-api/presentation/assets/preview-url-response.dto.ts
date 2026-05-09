import { ApiProperty } from "@nestjs/swagger";

export class PreviewUrlResponseDTO {
  @ApiProperty({
    description: "Fully-signed imgproxy URL the browser can fetch directly.",
  })
  url!: string;

  @ApiProperty({
    description:
      "ISO timestamp at which the URL stops being valid (matches the underlying source-url TTL).",
    format: "date-time",
  })
  expiresAt!: string;
}
