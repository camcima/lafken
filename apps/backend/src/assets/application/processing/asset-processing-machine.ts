import { createMachine } from "xstate";

export type AssetProcessingMachineEvent =
  | { type: "MIME_INVALID" }
  | { type: "MIME_VALID" }
  | { type: "IMAGE_INVALID" }
  | { type: "IMAGE_VALID" }
  | { type: "VIRUS_INFECTED" }
  | { type: "VIRUS_CLEAN" }
  | { type: "MODERATION_REQUIRED" }
  | { type: "MODERATION_PASS" }
  | { type: "MODERATION_QUARANTINE" }
  | { type: "FAILED" };

export const assetProcessingMachine = createMachine({
  id: "assetProcessing",
  initial: "virusScan",
  states: {
    virusScan: {
      on: {
        VIRUS_INFECTED: "quarantinedVirus",
        VIRUS_CLEAN: "magicByteDetection",
        FAILED: "failed",
      },
    },
    magicByteDetection: {
      on: {
        MIME_INVALID: "rejected",
        MIME_VALID: "imageInspection",
        FAILED: "failed",
      },
    },
    imageInspection: {
      on: {
        IMAGE_INVALID: "rejected",
        IMAGE_VALID: "moderationDecision",
        FAILED: "failed",
      },
    },
    moderationDecision: {
      on: {
        MODERATION_REQUIRED: "contentModeration",
        MODERATION_PASS: "ready",
      },
    },
    contentModeration: {
      on: {
        MODERATION_PASS: "ready",
        MODERATION_QUARANTINE: "quarantinedModeration",
        FAILED: "failed",
      },
    },
    ready: { type: "final" },
    rejected: { type: "final" },
    quarantinedVirus: { type: "final" },
    quarantinedModeration: { type: "final" },
    failed: { type: "final" },
  },
});
