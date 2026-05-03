import { ApiProperty } from "@nestjs/swagger";

import { AssetResponseDTO } from "../assets/asset-response.dto";

export class QuarantinedAssetResponseDTO extends AssetResponseDTO {
  @ApiProperty({ enum: ["virus", "moderation"] })
  quarantineKind!: "virus" | "moderation";

  @ApiProperty({ required: false, type: String })
  flaggedAnalyzer?: string;

  @ApiProperty({ required: false, type: String })
  flaggedCategory?: string;

  @ApiProperty({ required: false, type: Number })
  flaggedScore?: number;

  @ApiProperty()
  flaggedAt!: string;
}
