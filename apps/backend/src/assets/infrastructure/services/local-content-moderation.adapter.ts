import type {
  IContentModerationInput,
  IContentModerationResult,
} from "@/assets/domain/services/content-moderation.service.port";
import { ContentModerationPort } from "@/assets/domain/services/content-moderation.service.port";

export interface ILocalContentModerationAdapterOptions {
  /**
   * When set, overrides the policy-derived decision. Lets operators force the
   * quarantine branch (or hard-pin pass) without editing per-namespace policy.
   */
  forceDecision?: "pass" | "quarantine";
}

export class LocalContentModerationAdapter extends ContentModerationPort {
  constructor(private readonly options: ILocalContentModerationAdapterOptions = {}) {
    super();
  }

  analyze(input: IContentModerationInput): Promise<IContentModerationResult> {
    const policyDecision: "pass" | "quarantine" =
      input.policyConfig["localDecision"] === "quarantine" ? "quarantine" : "pass";
    const decision: "pass" | "quarantine" = this.options.forceDecision ?? policyDecision;
    const category: string =
      typeof input.policyConfig["category"] === "string" ? input.policyConfig["category"] : "none";
    const score: number =
      typeof input.policyConfig["score"] === "number" ? input.policyConfig["score"] : 0;
    const threshold: number =
      typeof input.policyConfig["threshold"] === "number" ? input.policyConfig["threshold"] : 1;

    return Promise.resolve({
      decision,
      reason: decision === "quarantine" ? "moderation_quarantined" : null,
      analyzer: "content_moderation",
      analyzerVersion: "local-v1",
      findings: {
        step: "content_moderation",
        adapter: "local-content-moderation",
        adapter_version: "local-v1",
        decision,
        category,
        score,
        threshold,
        size_bytes: input.bytes.length,
      },
    });
  }
}
