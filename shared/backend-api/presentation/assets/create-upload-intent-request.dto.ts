import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, Min, MinLength } from "class-validator";

const MIME_TYPE_PATTERN = /^[a-z]+\/[a-z0-9.+-]+$/i;

export class CreateUploadIntentRequestDTO {
  @IsString()
  @MinLength(1)
  @ApiProperty({ example: "aircraft-photos" })
  namespaceSlug!: string;

  @IsString()
  @Matches(MIME_TYPE_PATTERN, { message: "declaredMimeType must look like type/subtype" })
  @ApiProperty({ example: "image/jpeg" })
  declaredMimeType!: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 102400, minimum: 1 })
  declaredSizeBytes!: number;
}
