import { ApiProperty } from "@nestjs/swagger";

import { SystemHealthResponseDTO } from "../system/system-health-response.dto";

export class DashboardCountsDTO {
  @ApiProperty()
  totalAssets!: number;

  @ApiProperty()
  inFlight!: number;

  @ApiProperty()
  queueDepth!: number;

  @ApiProperty()
  quarantine!: number;

  @ApiProperty()
  legalHolds!: number;

  @ApiProperty()
  failedProcessing!: number;

  @ApiProperty()
  namespaces!: number;
}

export class DashboardOverviewResponseDTO {
  @ApiProperty({ type: DashboardCountsDTO })
  counts!: DashboardCountsDTO;

  @ApiProperty({ type: SystemHealthResponseDTO })
  health!: SystemHealthResponseDTO;
}
