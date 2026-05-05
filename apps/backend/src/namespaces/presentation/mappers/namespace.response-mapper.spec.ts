import { describe, expect, it } from "vitest";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { NamespaceResponseMapper } from "./namespace.response-mapper";

describe("NamespaceResponseMapper", () => {
  it("maps a namespace to the response DTO shape", () => {
    const result = NamespaceResponseMapper.fromDomain(
      Namespace.fromProps({
        id: "01900000-0000-7000-8000-000000000010",
        slug: new Slug("aircraft-photos"),
        displayName: "Aircraft Photos",
        description: "Photos taken during aircraft inspections",
        currentPolicyId: "01900000-0000-7000-8000-000000000020",
        storageBindingId: "01900000-0000-7000-8000-000000000001",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      }),
      "default",
      7,
    );

    expect(result).toEqual({
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: "Photos taken during aircraft inspections",
      currentPolicyVersion: 7,
      storageBindingName: "default",
      archivedAt: undefined,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });
});
