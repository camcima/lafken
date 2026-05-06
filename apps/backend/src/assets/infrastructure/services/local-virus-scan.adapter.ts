import type {
  IVirusScanInput,
  IVirusScanResult,
} from "@/assets/domain/services/virus-scan.service.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";

export interface ILocalVirusScanAdapterOptions {
  infected?: boolean;
  signature?: string;
}

export class LocalVirusScanAdapter extends VirusScanPort {
  constructor(private readonly options: ILocalVirusScanAdapterOptions = {}) {
    super();
  }

  scan(input: IVirusScanInput): Promise<IVirusScanResult> {
    const infected: boolean = this.options.infected === true;
    const decision: "pass" | "quarantine" = infected ? "quarantine" : "pass";
    return Promise.resolve({
      decision,
      reason: infected ? "virus_detected" : null,
      analyzer: "virus_scan",
      analyzerVersion: "local-v1",
      findings: {
        step: "virus_scan",
        adapter: "local-virus-scan",
        adapter_version: "local-v1",
        decision,
        signature: infected ? (this.options.signature ?? "local-test-signature") : null,
        content_hash_hex: input.contentHash.toString("hex"),
        size_bytes: input.bytes.length,
      },
    });
  }
}
