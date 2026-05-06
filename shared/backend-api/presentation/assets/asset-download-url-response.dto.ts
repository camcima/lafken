import { ApiProperty } from "@nestjs/swagger";

export class AssetDownloadUrlResponseDTO {
  @ApiProperty({
    description:
      "Fully-signed GCS read URL the browser can fetch directly to download the original asset bytes. Valid for ~5 minutes.",
  })
  url!: string;
}
