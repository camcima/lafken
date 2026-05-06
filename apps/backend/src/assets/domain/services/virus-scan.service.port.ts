export interface IVirusScanInput {
  bytes: Buffer;
  contentHash: Buffer;
}

export interface IVirusScanResult {
  decision: "pass" | "quarantine";
  reason: string | null;
  findings: Record<string, unknown>;
  analyzer: string;
  analyzerVersion: string | null;
}

export abstract class VirusScanPort {
  abstract scan(input: IVirusScanInput): Promise<IVirusScanResult>;
}
