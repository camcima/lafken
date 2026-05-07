import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AssetQueryRepository } from "@/assets/infrastructure/persistence/repositories/asset-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

interface ITestNamespaceRefs {
  bindingId: string;
  namespaceId: string;
  policyId: string;
}

describe("AssetQueryRepository", () => {
  let db: DatabaseClient;
  let repository: AssetQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new AssetQueryRepository(db);
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no assets exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.lastPage).toBe(1);
  });

  it("returns null for a public ID that does not exist", async () => {
    expect(await repository.findByPublicId("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a processing job when asset ID does not exist", async () => {
    expect(await repository.findProcessingJob("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a namespace slug when namespace ID does not exist", async () => {
    expect(await repository.findNamespaceSlug("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  describe("getNamespaceStorageUsage", () => {
    it("returns zero totals for a namespace with no assets", async () => {
      const refs = await seedNamespace(db, "usage-empty-ns");

      const usage = await repository.getNamespaceStorageUsage(refs.namespaceId);

      expect(usage.totalBytes).toBe(0n);
      expect(usage.assetCount).toBe(0);
    });

    it("returns zero totals for a namespace ID that does not exist", async () => {
      const usage = await repository.getNamespaceStorageUsage(NIL_UUID);

      expect(usage.totalBytes).toBe(0n);
      expect(usage.assetCount).toBe(0);
    });

    it("sums size_bytes and counts assets across multiple uploaded assets", async () => {
      const refs = await seedNamespace(db, "usage-sum-ns");
      await insertAsset(db, refs, { state: "uploaded", sizeBytes: 1024n, key: "a.jpg" });
      await insertAsset(db, refs, { state: "uploaded", sizeBytes: 2048n, key: "b.jpg" });
      await insertAsset(db, refs, { state: "ready", sizeBytes: 4096n, key: "c.jpg" });

      const usage = await repository.getNamespaceStorageUsage(refs.namespaceId);

      expect(usage.totalBytes).toBe(7168n);
      expect(usage.assetCount).toBe(3);
    });

    it("excludes assets in 'expired' or 'deleted' states", async () => {
      const refs = await seedNamespace(db, "usage-excludes-ns");
      await insertAsset(db, refs, { state: "uploaded", sizeBytes: 1000n, key: "kept-1.jpg" });
      await insertAsset(db, refs, { state: "expired", sizeBytes: 500n, key: "expired.jpg" });
      await insertAsset(db, refs, { state: "deleted", sizeBytes: 700n, key: "deleted.jpg" });
      await insertAsset(db, refs, { state: "ready", sizeBytes: 200n, key: "kept-2.jpg" });

      const usage = await repository.getNamespaceStorageUsage(refs.namespaceId);

      expect(usage.totalBytes).toBe(1200n);
      expect(usage.assetCount).toBe(2);
    });

    it("excludes assets in 'pending' state (size_bytes is null)", async () => {
      const refs = await seedNamespace(db, "usage-pending-ns");
      await insertAsset(db, refs, { state: "uploaded", sizeBytes: 100n, key: "ok.jpg" });
      await insertAsset(db, refs, { state: "pending", sizeBytes: null, key: "pending.jpg" });

      const usage = await repository.getNamespaceStorageUsage(refs.namespaceId);

      expect(usage.totalBytes).toBe(100n);
      expect(usage.assetCount).toBe(1);
    });

    it("does not include assets from other namespaces", async () => {
      const refsA = await seedNamespace(db, "usage-isolation-a");
      const refsB = await seedNamespace(db, "usage-isolation-b");
      await insertAsset(db, refsA, { state: "uploaded", sizeBytes: 1000n, key: "a.jpg" });
      await insertAsset(db, refsB, { state: "uploaded", sizeBytes: 9999n, key: "b.jpg" });

      const usage = await repository.getNamespaceStorageUsage(refsA.namespaceId);

      expect(usage.totalBytes).toBe(1000n);
      expect(usage.assetCount).toBe(1);
    });
  });

  describe("list `q` search", () => {
    it("matches a fragment of the public_id", async () => {
      const refs = await seedNamespace(db, "search-public-id");
      await insertSearchableAsset(db, refs, {
        publicId: "01900000-0000-7000-8000-aaaaaaaaaaaa",
        key: "a.jpg",
      });
      await insertSearchableAsset(db, refs, {
        publicId: "01900000-0000-7000-8000-bbbbbbbbbbbb",
        key: "b.jpg",
      });

      const result = await repository.list({ page: 1, limit: 20, q: "aaaa" });

      expect(result.total).toBe(1);
      expect(result.data[0]?.props.publicId).toBe("01900000-0000-7000-8000-aaaaaaaaaaaa");
    });

    it("matches a fragment of external_ref_id", async () => {
      const refs = await seedNamespace(db, "search-ext-ref");
      await insertSearchableAsset(db, refs, { externalRefId: "WO-12345", key: "a.jpg" });
      await insertSearchableAsset(db, refs, { externalRefId: "WO-99999", key: "b.jpg" });

      const result = await repository.list({ page: 1, limit: 20, q: "12345" });

      expect(result.total).toBe(1);
      expect(result.data[0]?.props.externalRefId).toBe("WO-12345");
    });

    it("matches a fragment of uploaded_by", async () => {
      const refs = await seedNamespace(db, "search-uploaded-by");
      await insertSearchableAsset(db, refs, { uploadedBy: "alice@latam.com", key: "a.jpg" });
      await insertSearchableAsset(db, refs, { uploadedBy: "bob@latam.com", key: "b.jpg" });

      const result = await repository.list({ page: 1, limit: 20, q: "alice" });

      expect(result.total).toBe(1);
      expect(result.data[0]?.props.uploadedBy).toBe("alice@latam.com");
    });

    it("matches a fragment of the hex content_hash", async () => {
      const refs = await seedNamespace(db, "search-hash");
      await insertSearchableAsset(db, refs, {
        contentHash: Buffer.from("deadbeefcafebabe", "hex"),
        key: "a.jpg",
      });
      await insertSearchableAsset(db, refs, {
        contentHash: Buffer.from("0123456789abcdef", "hex"),
        key: "b.jpg",
      });

      const result = await repository.list({ page: 1, limit: 20, q: "beefcafe" });

      expect(result.total).toBe(1);
      expect(result.data[0]?.props.contentHash?.toString("hex")).toBe("deadbeefcafebabe");
    });

    it("is case-insensitive", async () => {
      const refs = await seedNamespace(db, "search-case");
      await insertSearchableAsset(db, refs, { uploadedBy: "Alice@LATAM.com", key: "a.jpg" });

      const result = await repository.list({ page: 1, limit: 20, q: "alice" });

      expect(result.total).toBe(1);
    });

    it("treats `%` and `_` as literals (not LIKE wildcards)", async () => {
      const refs = await seedNamespace(db, "search-literal");
      await insertSearchableAsset(db, refs, { uploadedBy: "ops@latam.com", key: "a.jpg" });

      // Without escaping, "%" would match every row; with escaping, it matches none.
      const result = await repository.list({ page: 1, limit: 20, q: "%" });

      expect(result.total).toBe(0);
    });

    it("returns nothing when the query matches no row across any column", async () => {
      const refs = await seedNamespace(db, "search-miss");
      await insertSearchableAsset(db, refs, { uploadedBy: "ops@latam.com", key: "a.jpg" });

      const result = await repository.list({ page: 1, limit: 20, q: "no-such-token" });

      expect(result.total).toBe(0);
    });

    it("ignores empty/whitespace queries", async () => {
      const refs = await seedNamespace(db, "search-empty");
      await insertSearchableAsset(db, refs, { uploadedBy: "ops@latam.com", key: "a.jpg" });
      await insertSearchableAsset(db, refs, { uploadedBy: "ops2@latam.com", key: "b.jpg" });

      const result = await repository.list({ page: 1, limit: 20, q: "   " });

      expect(result.total).toBe(2);
    });
  });

  describe("AssetQueryRepository.findInternalIdsAndNamespaceSlugsByPublicIds", () => {
    it("resolves publicIds to internal ids + namespace slug, ignoring missing ones", async () => {
      const refs = await seedNamespace(db, "ns-a");

      const inserted = await db.connection
        .insertInto("assets")
        .values([
          {
            namespace_id: refs.namespaceId,
            policy_version_id: refs.policyId,
            storage_binding_id: refs.bindingId,
            storage_key: "ns-a/k1/source",
            state: "ready",
            mime_type: "image/jpeg",
            size_bytes: 1024n,
            effective_max_size_bytes: 52_428_800n,
            effective_url_ttl: 3600,
          },
          {
            namespace_id: refs.namespaceId,
            policy_version_id: refs.policyId,
            storage_binding_id: refs.bindingId,
            storage_key: "ns-a/k2/source",
            state: "ready",
            mime_type: "image/jpeg",
            size_bytes: 1024n,
            effective_max_size_bytes: 52_428_800n,
            effective_url_ttl: 3600,
          },
        ])
        .returning(["id", "public_id"])
        .execute();

      const [a, b] = inserted as Array<{ id: string; public_id: string }>;

      const result = await repository.findInternalIdsAndNamespaceSlugsByPublicIds([
        a.public_id,
        b.public_id,
        "00000000-0000-0000-0000-000000000000",
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.publicId).sort()).toEqual([a.public_id, b.public_id].sort());
      expect(result.every((r) => r.namespaceSlug === "ns-a")).toBe(true);
      expect(result.find((r) => r.publicId === a.public_id)?.id).toBe(a.id);
    });

    it("returns empty array when given an empty input array", async () => {
      expect(await repository.findInternalIdsAndNamespaceSlugsByPublicIds([])).toEqual([]);
    });
  });

  describe("AssetQueryRepository.list with legalHoldId filter", () => {
    it("returns only assets covered by the given hold", async () => {
      const refs = await seedNamespace(db, "ns-a");

      const inserted = await db.connection
        .insertInto("assets")
        .values([
          {
            namespace_id: refs.namespaceId,
            policy_version_id: refs.policyId,
            storage_binding_id: refs.bindingId,
            storage_key: "ns-a/hold-k1/source",
            state: "ready",
            mime_type: "image/jpeg",
            size_bytes: 1024n,
            effective_max_size_bytes: 52_428_800n,
            effective_url_ttl: 3600,
          },
          {
            namespace_id: refs.namespaceId,
            policy_version_id: refs.policyId,
            storage_binding_id: refs.bindingId,
            storage_key: "ns-a/hold-k2/source",
            state: "ready",
            mime_type: "image/jpeg",
            size_bytes: 1024n,
            effective_max_size_bytes: 52_428_800n,
            effective_url_ttl: 3600,
          },
          {
            namespace_id: refs.namespaceId,
            policy_version_id: refs.policyId,
            storage_binding_id: refs.bindingId,
            storage_key: "ns-a/hold-k3/source",
            state: "ready",
            mime_type: "image/jpeg",
            size_bytes: 1024n,
            effective_max_size_bytes: 52_428_800n,
            effective_url_ttl: 3600,
          },
        ])
        .returning(["id", "public_id"])
        .execute();

      const [a, _b, _c] = inserted as Array<{ id: string; public_id: string }>;

      const [hold] = await db.connection
        .insertInto("legal_holds")
        .values({
          case_reference: "CHL-AVN-2026-001",
          description: "Test hold",
          scope_summary: "1 asset(s) across namespace ns-a",
          placed_by: "test@test.com",
          active: true,
        })
        .returningAll()
        .execute();

      await db.connection
        .insertInto("legal_hold_assets")
        .values({ legal_hold_id: (hold as { id: string }).id, asset_id: a.id })
        .execute();

      const page = await repository.list({
        page: 1,
        limit: 50,
        legalHoldId: (hold as { id: string }).id,
      });

      expect(page.total).toBe(1);
      expect(page.data).toHaveLength(1);
      expect(page.data[0]?.props.publicId).toBe(a.public_id);
    });
  });
});

async function seedNamespace(db: DatabaseClient, slug: string): Promise<ITestNamespaceRefs> {
  return db.connection.transaction().execute(async (tx) => {
    const binding = await tx
      .insertInto("storage_bindings")
      .values({
        name: `${slug}-binding`,
        adapter_type: "gcs",
        config: { bucket: "test", projectId: "test-project" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const namespace = await tx
      .insertInto("namespaces")
      .values({
        slug,
        display_name: slug,
        description: null,
        current_policy_id: NIL_UUID,
        storage_binding_id: binding.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const policy = await tx
      .insertInto("namespace_policies")
      .values({
        namespace_id: namespace.id,
        version: 1,
        retention_days: null,
        retention_mode: "none",
        max_file_size_bytes: 52_428_800n,
        allowed_mime_types: ["image/jpeg", "image/png"],
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
      .set({ current_policy_id: policy.id })
      .where("id", "=", namespace.id)
      .execute();

    return { bindingId: binding.id, namespaceId: namespace.id, policyId: policy.id };
  });
}

async function insertSearchableAsset(
  db: DatabaseClient,
  refs: ITestNamespaceRefs,
  input: {
    key: string;
    publicId?: string;
    externalRefId?: string;
    uploadedBy?: string;
    contentHash?: Buffer;
  },
): Promise<void> {
  await db.connection
    .insertInto("assets")
    .values({
      namespace_id: refs.namespaceId,
      policy_version_id: refs.policyId,
      storage_binding_id: refs.bindingId,
      storage_key: input.key,
      state: "uploaded",
      mime_type: "image/jpeg",
      size_bytes: 1024n,
      effective_max_size_bytes: 52_428_800n,
      effective_url_ttl: 3600,
      ...(input.publicId ? { public_id: input.publicId } : {}),
      ...(input.externalRefId ? { external_ref_id: input.externalRefId } : {}),
      ...(input.uploadedBy ? { uploaded_by: input.uploadedBy } : {}),
      ...(input.contentHash ? { content_hash: input.contentHash } : {}),
    })
    .execute();
}

async function insertAsset(
  db: DatabaseClient,
  refs: ITestNamespaceRefs,
  input: { state: string; sizeBytes: bigint | null; key: string },
): Promise<void> {
  await db.connection
    .insertInto("assets")
    .values({
      namespace_id: refs.namespaceId,
      policy_version_id: refs.policyId,
      storage_binding_id: refs.bindingId,
      storage_key: input.key,
      state: input.state,
      mime_type: "image/jpeg",
      size_bytes: input.sizeBytes,
      effective_max_size_bytes: 52_428_800n,
      effective_url_ttl: 3600,
    })
    .execute();
}
