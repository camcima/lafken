import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DashboardCountsRepository } from "@/dashboard/infrastructure/persistence/repositories/dashboard-counts.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("DashboardCountsRepository", () => {
  let db: DatabaseClient;
  let repository: DashboardCountsRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new DashboardCountsRepository(db);
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns all-zero counts when the database is empty", async () => {
    const counts = await repository.read();

    expect(counts).toEqual({
      totalAssets: 0,
      inFlight: 0,
      queueDepth: 0,
      quarantine: 0,
      legalHolds: 0,
      assetsUnderLegalHold: 0,
      failedProcessing: 0,
      namespaces: 0,
    });
  });

  it("counts assets in all three quarantine states", async () => {
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    const bindingId = (sb as { id: string }).id;

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "aircraft-photos",
          display_name: "Aircraft Photos",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: bindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const nsId = (ns as { id: string }).id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: false,
          immutable: false,
          serving_mode: "signed",
          signed_url_ttl_seconds: 3600,
          signed_url_bucket_size: 300,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const pvId = (policy as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: pvId })
        .where("id", "=", nsId)
        .execute();

      return { nsId, pvId };
    });

    const quarantineStates = [
      "quarantined_virus",
      "quarantined_moderation",
      "quarantined_invalid_format",
    ];
    for (const state of quarantineStates) {
      await db.connection
        .insertInto("assets")
        .values({
          namespace_id: seeded.nsId,
          policy_version_id: seeded.pvId,
          storage_binding_id: bindingId,
          storage_key: `_quarantined/uploads/${state}.jpg`,
          state,
          declared_mime_type: "image/jpeg",
          size_bytes: 4096n,
          effective_max_size_bytes: 52_428_800n,
          effective_url_ttl: 3600,
        })
        .execute();
    }

    const counts = await repository.read();

    expect(counts.quarantine).toBe(3);
  });

  it("counts assets currently flagged with legal_hold", async () => {
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-dashboard",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "p" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const bindingId = (sb as { id: string }).id;

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "ns-dash",
          display_name: "NS Dash",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: bindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const nsId = (ns as { id: string }).id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: 1,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
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
      const pvId = (policy as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: pvId })
        .where("id", "=", nsId)
        .execute();

      return { nsId, pvId };
    });

    await db.connection
      .insertInto("assets")
      .values(
        [
          { key: "a", held: true },
          { key: "b", held: true },
          { key: "c", held: false },
        ].map((row) => ({
          namespace_id: seeded.nsId,
          policy_version_id: seeded.pvId,
          state: "ready",
          storage_binding_id: bindingId,
          storage_key: `ns-dash/${row.key}/source`,
          declared_mime_type: "image/jpeg",
          uploaded_by: "u@example.com",
          effective_max_size_bytes: 52_428_800n,
          effective_url_ttl: 3600,
          legal_hold: row.held,
        })),
      )
      .execute();

    const counts = await repository.read();

    expect(counts.assetsUnderLegalHold).toBe(2);
  });
});
