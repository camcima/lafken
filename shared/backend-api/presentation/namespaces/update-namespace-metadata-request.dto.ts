import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateNamespaceMetadataRequestDTO {
  @IsString()
  @MaxLength(200)
  @ApiProperty()
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiProperty({ required: false, type: String, nullable: true })
  description!: string | null;
}
