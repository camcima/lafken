import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

const LIFT_REASON_MIN = 10;
const LIFT_REASON_MAX = 1000;

export class LiftLegalHoldRequestDTO {
  @IsString()
  @Length(LIFT_REASON_MIN, LIFT_REASON_MAX)
  @ApiProperty({ minLength: LIFT_REASON_MIN, maxLength: LIFT_REASON_MAX })
  liftReason!: string;
}
