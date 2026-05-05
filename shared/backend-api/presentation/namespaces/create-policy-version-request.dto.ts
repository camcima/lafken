import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";

import { CreateNamespacePolicyDTO } from "./create-namespace-request.dto";

export class CreatePolicyVersionRequestDTO {
  @ValidateNested()
  @Type(() => CreateNamespacePolicyDTO)
  @ApiProperty({ type: CreateNamespacePolicyDTO })
  policy!: CreateNamespacePolicyDTO;
}
