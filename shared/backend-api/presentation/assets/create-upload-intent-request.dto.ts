import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from "class-validator";

const MIME_TYPE_PATTERN = /^[a-z]+\/[a-z0-9.+-]+$/i;
const UPLOAD_PROTOCOLS = ["simple", "tus"] as const;
export type UploadProtocol = (typeof UPLOAD_PROTOCOLS)[number];

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

  @IsOptional()
  @IsIn(UPLOAD_PROTOCOLS as unknown as string[])
  @ApiProperty({
    enum: UPLOAD_PROTOCOLS,
    required: false,
    description: "Upload protocol. Defaults to 'simple' (one-shot signed PUT).",
  })
  protocol?: UploadProtocol;
}
