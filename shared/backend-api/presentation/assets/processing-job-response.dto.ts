import { ApiProperty } from "@nestjs/swagger";

export class ProcessingJobResponseDTO {
  @ApiProperty({ enum: ["claimed", "released", "completed", "failed"] })
  state!: "claimed" | "released" | "completed" | "failed";

  @ApiProperty({ required: false, type: String })
  workerId?: string;

  @ApiProperty({ required: false, type: String })
  currentStep?: string;

  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty({ required: false, type: String })
  notBefore?: string;

  @ApiProperty({ required: false, type: String })
  lastError?: string;

  @ApiProperty({ required: false, type: String })
  lastErrorAt?: string;

  @ApiProperty({ required: false, type: String })
  heartbeatAt?: string;

  @ApiProperty({ required: false, type: String })
  claimedAt?: string;

  @ApiProperty()
  createdAt!: string;
}
