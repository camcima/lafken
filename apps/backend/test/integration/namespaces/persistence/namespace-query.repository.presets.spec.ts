import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { NamespaceQueryRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const PARAMS_JSON = { width: 800, height: 600, fit: "cover", format: "webp", quality: 80, dpr: 2 };

describe("NamespaceQueryRepository.listPresets (latest-per-name semantics)", () => {
  let db: DatabaseClient;
  let repository: NamespaceQueryRepository;
  let namespaceId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new NamespaceQueryRepository(db, createConnectionResolver(db));
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);

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

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: (policy as { id: string }).id })
        .where("id", "=", nsId)
        .execute();

      return { namespaceId: nsId };
    });
    namespaceId = seeded.namespaceId;
  });

  async function seedPresetRow(name: string, version: number, active: boolean): Promise<void> {
    await db.connection
      .insertInto("namespace_presets")
      .values({ namespace_id: namespaceId, name, version, params: PARAMS_JSON, active })
      .execute();
  }

  it("returns exactly one row per preset name — the latest version", async () => {
    await seedPresetRow("thumbnail", 1, true);
    await seedPresetRow("thumbnail", 2, true);
    await seedPresetRow("hero", 1, true);

    const presets = await repository.listPresets(namespaceId);

    expect(presets).toHaveLength(2);
    expect(presets.map((p) => ({ name: p.props.name, version: p.props.version }))).toEqual([
      { name: "hero", version: 1 },
      { name: "thumbnail", version: 2 },
    ]);
  });

  it("does not resurrect a deactivated preset through an older active version", async () => {
    // Historical bug shape: v1 still active=true, latest v2 deactivated.
    await seedPresetRow("thumbnail", 1, true);
    await seedPresetRow("thumbnail", 2, false);

    const presets = await repository.listPresets(namespaceId);

    expect(presets).toHaveLength(1);
    expect(presets[0]?.props.version).toBe(2);
    expect(presets[0]?.props.active).toBe(false);
  });
});
