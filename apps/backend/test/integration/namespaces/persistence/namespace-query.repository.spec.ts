import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { NamespaceQueryRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("NamespaceQueryRepository", () => {
  let db: DatabaseClient;
  let repository: NamespaceQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new NamespaceQueryRepository(db);
  });

  beforeEach(async () => {
    // Clean up in a transaction. The FK namespaces.current_policy_id →
    // namespace_policies is DEFERRABLE INITIALLY DEFERRED — inside a
    // transaction the check is deferred to COMMIT, so we can delete
    // namespaces before their referenced policies.
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      // Delete policies before namespaces (deferred FK namespaces.current_policy_id
      // checked at commit; RESTRICT FK namespace_policies.namespace_id requires
      // policies deleted before namespaces).
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no namespaces exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it("returns null for a slug that does not exist", async () => {
    expect(await repository.findBySlug("missing")).toBeNull();
  });

  it("retrieves a namespace by slug", async () => {
    // All inserts happen inside a transaction so the deferred FK
    // namespaces.current_policy_id is satisfied at commit time.
    await db.connection.transaction().execute(async (tx) => {
      // Insert storage binding
      await tx
        .insertInto("storage_bindings")
        .values({ name: "default", adapter_type: "local", config: {} })
        .execute();

      const sb = await tx
        .selectFrom("storage_bindings")
        .selectAll()
        .where("name", "=", "default")
        .executeTakeFirstOrThrow();

      // Insert namespace — current_policy_id uses NIL_UUID as a placeholder that satisfies
      // NOT NULL. The deferred FK allows the violation until commit.
      await tx
        .insertInto("namespaces")
        .values({
          slug: "aircraft-photos",
          display_name: "Aircraft Photos",
          // NIL UUID satisfies NOT NULL; deferred FK allows this
          current_policy_id: "00000000-0000-0000-0000-000000000000",
          storage_binding_id: (sb as { id: string }).id,
        })
        .execute();

      const ns = await tx
        .selectFrom("namespaces")
        .selectAll()
        .where("slug", "=", "aircraft-photos")
        .executeTakeFirstOrThrow();

      // Insert policy
      await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: (ns as { id: string }).id,
          version: 1,
          retention_days: 365,
          retention_mode: "delete",
          max_file_size_bytes: BigInt(50_000_000),
          allowed_mime_types: ["image/jpeg", "image/png"],
          exif_handling: "strip",
          virus_scan_required: true,
          immutable: false,
          serving_mode: "public",
        })
        .execute();

      const policy = await tx
        .selectFrom("namespace_policies")
        .selectAll()
        .where("namespace_id", "=", (ns as { id: string }).id)
        .executeTakeFirstOrThrow();

      // Update namespace to point at real policy (satisfying the deferred FK)
      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: (policy as { id: string }).id })
        .where("id", "=", (ns as { id: string }).id)
        .execute();
    });

    const found = await repository.findBySlug("aircraft-photos");
    expect(found).not.toBeNull();
    expect(found!.props.slug.value).toBe("aircraft-photos");
    expect(found!.props.displayName).toBe("Aircraft Photos");
  });
});
