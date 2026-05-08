import { ApiProperty } from "@nestjs/swagger";

export class NamespaceStorageUsageResponseDTO {
  @ApiProperty({ description: "Slug of the namespace whose usage is reported." })
  namespaceSlug!: string;

  @ApiProperty({
    description:
      "Sum of `size_bytes` over assets currently held in storage (excludes pending, expired, deleted).",
  })
  totalBytes!: number;

  @ApiProperty({
    description: "Number of assets contributing to `totalBytes`.",
  })
  assetCount!: number;
}
