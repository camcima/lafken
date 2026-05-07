import { beforeEach, describe, expect, it } from "vitest";

import { PlaceLegalHoldUseCase } from "@/legal-holds/application/use-cases/place-legal-hold.use-case";
import { AssetsNotFoundForLegalHoldError } from "@/legal-holds/domain/errors/assets-not-found-for-legal-hold.error";
import { EmptyAssetSelectionError } from "@/legal-holds/domain/errors/empty-asset-selection.error";

import { FakeAssetPublicIdResolver } from "../../../__fakes__/fake-asset-public-id-resolver";
import { FakeLegalHoldWriteRepository } from "../../../__fakes__/fake-legal-hold-write.repository";

describe("PlaceLegalHoldUseCase", () => {
  let resolver: FakeAssetPublicIdResolver;
  let writeRepo: FakeLegalHoldWriteRepository;
  let useCase: PlaceLegalHoldUseCase;

  beforeEach(() => {
    resolver = new FakeAssetPublicIdResolver();
    writeRepo = new FakeLegalHoldWriteRepository();
    useCase = new PlaceLegalHoldUseCase(resolver as never, writeRepo);
  });

  it("places a hold over the resolved internal ids and computes a single-namespace scopeSummary", async () => {
    resolver.records.set("p-1", { id: "i-1", namespaceSlug: "ns-a" });
    resolver.records.set("p-2", { id: "i-2", namespaceSlug: "ns-a" });

    const result = await useCase.execute({
      caseReference: "CHL-AVN-2026-001",
      description: "Investigation per DGAC requirement.",
      assetIds: ["p-1", "p-2"],
      placedBy: "ops@example.com",
    });

    expect(result.props.caseReference).toBe("CHL-AVN-2026-001");
    expect(result.props.scopeSummary).toBe("2 asset(s) across namespace ns-a");
    expect(writeRepo.placeCalls).toHaveLength(1);
    expect(writeRepo.placeCalls[0]?.assetInternalIds.sort()).toEqual(["i-1", "i-2"].sort());
    expect(writeRepo.placeCalls[0]?.placedBy).toBe("ops@example.com");
  });

  it("dedupes input assetIds before resolving", async () => {
    resolver.records.set("p-1", { id: "i-1", namespaceSlug: "ns-a" });

    await useCase.execute({
      caseReference: "CHL-AVN-2026-002",
      description: "Investigation per DGAC requirement.",
      assetIds: ["p-1", "p-1", "p-1"],
      placedBy: "ops@example.com",
    });

    expect(writeRepo.placeCalls[0]?.assetInternalIds).toEqual(["i-1"]);
    expect(writeRepo.placeCalls[0]?.scopeSummary).toBe("1 asset(s) across namespace ns-a");
  });

  it("throws EmptyAssetSelectionError when input is empty", async () => {
    await expect(
      useCase.execute({
        caseReference: "CHL-AVN-2026-003",
        description: "Investigation per DGAC requirement.",
        assetIds: [],
        placedBy: "ops@example.com",
      }),
    ).rejects.toBeInstanceOf(EmptyAssetSelectionError);
  });

  it("throws AssetsNotFoundForLegalHoldError listing the missing public ids", async () => {
    resolver.records.set("p-1", { id: "i-1", namespaceSlug: "ns-a" });

    try {
      await useCase.execute({
        caseReference: "CHL-AVN-2026-004",
        description: "Investigation per DGAC requirement.",
        assetIds: ["p-1", "p-missing-a", "p-missing-b"],
        placedBy: "ops@example.com",
      });
      expect.fail("expected AssetsNotFoundForLegalHoldError");
    } catch (err) {
      expect(err).toBeInstanceOf(AssetsNotFoundForLegalHoldError);
      expect((err as AssetsNotFoundForLegalHoldError).params).toEqual({
        missingPublicIds: ["p-missing-a", "p-missing-b"],
      });
    }
  });

  it("builds a multi-namespace scopeSummary, sorted alphabetically with at-most-three slugs", async () => {
    resolver.records.set("p-a", { id: "i-a", namespaceSlug: "zeta" });
    resolver.records.set("p-b", { id: "i-b", namespaceSlug: "alpha" });
    resolver.records.set("p-c", { id: "i-c", namespaceSlug: "beta" });
    resolver.records.set("p-d", { id: "i-d", namespaceSlug: "gamma" });
    resolver.records.set("p-e", { id: "i-e", namespaceSlug: "delta" });

    await useCase.execute({
      caseReference: "CHL-AVN-2026-005",
      description: "Investigation per DGAC requirement.",
      assetIds: ["p-a", "p-b", "p-c", "p-d", "p-e"],
      placedBy: "ops@example.com",
    });

    expect(writeRepo.placeCalls[0]?.scopeSummary).toBe(
      "5 asset(s) across namespace alpha, beta, delta, …and 2 more",
    );
    expect(writeRepo.placeCalls[0]?.assetInternalIds.sort()).toEqual(
      ["i-a", "i-b", "i-c", "i-d", "i-e"].sort(),
    );
  });
});
