import { ApiProperty } from "@nestjs/swagger";

import { AssetResponseDTO } from "../assets/asset-response.dto";

export class QuarantinedAssetResponseDTO extends AssetResponseDTO {
  @ApiProperty({ enum: ["virus", "moderation", "invalid_format"] })
  quarantineKind!: "virus" | "moderation" | "invalid_format";

  @ApiProperty({ required: false, type: String })
  flaggedAnalyzer?: string;

  @ApiProperty({ required: false, type: String })
  flaggedCategory?: string;

  @ApiProperty({ required: false, type: Number })
  flaggedScore?: number;

  @ApiProperty()
  flaggedAt!: string;
}
