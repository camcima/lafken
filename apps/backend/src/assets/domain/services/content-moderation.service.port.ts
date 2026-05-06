import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

export interface IContentModerationInput {
  bytes: Buffer;
  mimeType: string | null;
  policy: NamespacePolicy;
  captureContext: Record<string, unknown> | null;
}

export interface IContentModerationResult {
  decision: "pass" | "quarantine";
  reason: string | null;
  adapter: string;
  adapterVersion: string | null;
  findings: Record<string, unknown>;
}

export abstract class ContentModerationPort {
  abstract moderate(input: IContentModerationInput): Promise<IContentModerationResult>;
}
