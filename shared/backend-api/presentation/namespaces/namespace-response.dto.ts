import { ApiProperty } from "@nestjs/swagger";

export class NamespaceResponseDTO {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ required: false, type: String })
  description?: string;

  @ApiProperty()
  currentPolicyVersion!: number;

  @ApiProperty()
  storageBindingName!: string;

  @ApiProperty({ required: false, type: String })
  archivedAt?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
