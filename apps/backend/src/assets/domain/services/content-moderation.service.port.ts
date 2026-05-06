export interface IContentModerationInput {
  bytes: Buffer;
  policyConfig: Record<string, unknown>;
}

export interface IContentModerationResult {
  decision: "pass" | "quarantine";
  reason: string | null;
  findings: Record<string, unknown>;
  analyzer: string;
  analyzerVersion: string | null;
}

export abstract class ContentModerationPort {
  abstract analyze(input: IContentModerationInput): Promise<IContentModerationResult>;
}
