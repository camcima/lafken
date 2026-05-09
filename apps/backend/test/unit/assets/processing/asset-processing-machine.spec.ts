import { describe, expect, it } from "vitest";
import { createActor } from "xstate";

import { assetProcessingMachine } from "@/assets/application/processing/asset-processing-machine";

describe("assetProcessingMachine", () => {
  it("walks virusScan -> magicByteDetection -> imageInspection -> ready", () => {
    const actor = createActor(assetProcessingMachine).start();
    expect(actor.getSnapshot().value).toBe("virusScan");

    actor.send({ type: "VIRUS_CLEAN" });
    expect(actor.getSnapshot().value).toBe("magicByteDetection");

    actor.send({ type: "MIME_VALID" });
    expect(actor.getSnapshot().value).toBe("imageInspection");

    actor.send({ type: "IMAGE_VALID" });
    actor.send({ type: "MODERATION_PASS" });
    expect(actor.getSnapshot().value).toBe("ready");
  });

  it("rejects with format_inconsistency when the magic-byte step fails", () => {
    const actor = createActor(assetProcessingMachine).start();
    actor.send({ type: "VIRUS_CLEAN" });
    actor.send({ type: "MIME_INVALID" });
    expect(actor.getSnapshot().value).toBe("rejected");
  });
});
