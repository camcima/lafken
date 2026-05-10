import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "./database-cleanup.helper";

describe("[E2E] truncateAllAssetTables", () => {
  let db: DatabaseClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const fixture = await createAppModuleForE2ETest();
    await fixture.appFixture.init();
    db = fixture.getDatabaseClient();
    close = async () => fixture.appFixture.close();
  });

  afterAll(async () => close());

  it("removes data from every asset-side table in FK-safe order", async () => {
    await db.connection.transaction().execute(async (tx) => {
      const binding = await tx
        .insertInto("storage_bindings")
        .values({ name: "t-cleanup", adapter_type: "gcs", config: { bucket: "x", projectId: "y" } })
        .returning("id")
        .executeTakeFirstOrThrow();

      // current_policy_id FK is DEFERRABLE INITIALLY DEFERRED — insert namespace
      // first with a placeholder, create the policy, then patch the FK.
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "ns-cleanup",
          display_name: "x",
          description: null,
          current_policy_id: "00000000-0000-0000-0000-000000000000",
          storage_binding_id: binding.id,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: ns.id,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: BigInt(52_428_800),
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: false,
          content_moderation: null,
          required_metadata_schema: null,
          immutable: false,
          serving_mode: "public",
          signed_url_ttl_seconds: null,
          signed_url_bucket_size: null,
          retry_config: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policy.id })
        .where("id", "=", ns.id)
        .execute();
    });

    await truncateAllAssetTables(db);

    const remaining = await db.connection.selectFrom("namespaces").selectAll().execute();
    expect(remaining).toHaveLength(0);
    const bindings = await db.connection.selectFrom("storage_bindings").selectAll().execute();
    expect(bindings).toHaveLength(0);
  });
});
