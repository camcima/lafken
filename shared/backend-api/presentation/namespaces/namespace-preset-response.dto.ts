import { ApiProperty } from "@nestjs/swagger";

export class NamespacePresetResponseDTO {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: Object })
  transformation!: Record<string, unknown>;

  @ApiProperty({ required: false, type: Number })
  cdnMaxAge?: number;

  @ApiProperty({ required: false, type: Number })
  signedUrlTtl?: number;

  @ApiProperty()
  preGenerate!: boolean;

  @ApiProperty({ required: false, type: String })
  requiredPermission?: string;

  @ApiProperty({ required: false, type: String })
  description?: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;
}
