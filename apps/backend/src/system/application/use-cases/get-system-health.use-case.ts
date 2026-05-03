import { Injectable } from "@nestjs/common";

import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";
import { SystemHealthReader } from "@/system/domain/services/system-health-reader.service.port";

@Injectable()
export class GetSystemHealthUseCase {
  constructor(private readonly healthReader: SystemHealthReader) {}

  async execute(): Promise<ISystemHealthSnapshot> {
    return this.healthReader.read();
  }
}
