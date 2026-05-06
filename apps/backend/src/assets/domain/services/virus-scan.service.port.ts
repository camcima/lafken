export interface IVirusScanInput {
  bytes: Buffer;
  mimeType: string | null;
  contentHash: Buffer;
}

export interface IVirusScanResult {
  decision: "pass" | "quarantine";
  reason: string | null;
  adapter: string;
  adapterVersion: string | null;
  findings: Record<string, unknown>;
}

export abstract class VirusScanPort {
  abstract scan(input: IVirusScanInput): Promise<IVirusScanResult>;
}
