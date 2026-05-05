import { ApiProperty } from "@nestjs/swagger";

export class PreviewUrlResponseDTO {
  @ApiProperty({
    description: "Fully-signed imgproxy URL the browser can fetch directly.",
  })
  url!: string;
}
