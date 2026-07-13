import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PresetNameAlreadyExistsError } from "@/namespaces/domain/errors/preset-name-already-exists.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { NamespacePresetWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-preset-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("NamespacePresetWriteRepository", () => {
  let db: DatabaseClient;
  let repository: NamespacePresetWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new NamespacePresetWriteRepository(db, createConnectionResolver(db));
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  const VALID_PARAMS = PresetParams.fromUnknown({
    width: 800,
    height: 600,
    fit: "cover",
    format: "webp",
    quality: 80,
    dpr: 2,
  });

  let bindingId: string;
  let namespaceId: string;

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    bindingId = (sb as { id: string }).id;

    // Seed namespace + policy in a single transaction so the DEFERRABLE INITIALLY DEFERRED
    // FK on namespaces.current_policy_id is only checked at commit time.
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
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
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          content_moderation: null,
          required_metadata_schema: null,
          immutable: false,
          serving_mode: "signed",
          signed_url_ttl_seconds: 3600,
          signed_url_bucket_size: 300,
          retry_config: null,
          created_by: null,
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

  it("createPreset inserts version=1 active=true", async () => {
    const preset = await repository.createPreset({
      namespaceId,
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: "ops@latam.com",
    });

    expect(preset.props.version).toBe(1);
    expect(preset.props.active).toBe(true);

    const rows = await db.connection
      .selectFrom("namespace_presets")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .execute();
    expect(rows).toHaveLength(1);
    expect((rows[0] as { name: string }).name).toBe("thumbnail");
    expect((rows[0] as { version: number }).version).toBe(1);
    expect((rows[0] as { active: boolean }).active).toBe(true);
  });

  it("createPreset translates duplicate initial versions into a domain error", async () => {
    await repository.createPreset({
      namespaceId,
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });

    await expect(
      repository.createPreset({
        namespaceId,
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(PresetNameAlreadyExistsError);
  });

  it("createVersion bumps version and inherits active from latest", async () => {
    await db.connection
      .insertInto("namespace_presets")
      .values({
        namespace_id: namespaceId,
        name: "thumbnail",
        version: 1,
        params: VALID_PARAMS.toJSON(),
        active: false,
      })
      .execute();

    const v2 = await repository.createVersion({
      namespaceId,
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });
    expect(v2.props.version).toBe(2);
    expect(v2.props.active).toBe(false);
  });

  it("createVersion throws PresetNotFoundError when name unknown", async () => {
    await expect(
      repository.createVersion({
        namespaceId,
        name: "ghost",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(PresetNotFoundError);
  });

  it("createVersion retries once on (namespace_id, name, version) unique-violation", async () => {
    await repository.createPreset({
      namespaceId,
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });
    await db.connection
      .insertInto("namespace_presets")
      .values({
        namespace_id: namespaceId,
        name: "thumbnail",
        version: 2,
        params: VALID_PARAMS.toJSON(),
        active: true,
      })
      .execute();

    const v3 = await repository.createVersion({
      namespaceId,
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });
    expect(v3.props.version).toBe(3);
  });

  it("setActive updates only the latest version row", async () => {
    await db.connection
      .insertInto("namespace_presets")
      .values([
        {
          namespace_id: namespaceId,
          name: "thumbnail",
          version: 1,
          params: VALID_PARAMS.toJSON(),
          active: true,
        },
        {
          namespace_id: namespaceId,
          name: "thumbnail",
          version: 2,
          params: VALID_PARAMS.toJSON(),
          active: true,
        },
      ])
      .execute();

    await repository.setActive({ namespaceId, name: "thumbnail", active: false });

    const rows = await db.connection
      .selectFrom("namespace_presets")
      .select(["version", "active"])
      .where("namespace_id", "=", namespaceId)
      .where("name", "=", "thumbnail")
      .orderBy("version", "asc")
      .execute();
    expect(rows).toHaveLength(2);
    expect(rows[0] as { version: number; active: boolean }).toMatchObject({
      version: 1,
      active: true,
    });
    expect(rows[1] as { version: number; active: boolean }).toMatchObject({
      version: 2,
      active: false,
    });
  });

  it("setActive throws PresetNotFoundError when name unknown", async () => {
    await expect(
      repository.setActive({ namespaceId, name: "ghost", active: true }),
    ).rejects.toBeInstanceOf(PresetNotFoundError);
  });
});
