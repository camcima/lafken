import { beforeEach, describe, expect, it } from "vitest";

import { UploadIntentWriteRepository } from "@/assets/infrastructure/persistence/repositories/upload-intent-write.repository";

import { setupIntegrationDb } from "../../helpers/integration-db";

describe("[Integration] UploadIntentWriteRepository sweep & refresh", () => {
  const ctx = setupIntegrationDb();

  let repo: UploadIntentWriteRepository;

  beforeEach(async () => {
    await ctx.cleanCommonTables();
    await ctx.seedNamespaceWithPolicyAndBinding();
    repo = new UploadIntentWriteRepository(ctx.db);
  });

  it("findOrphanedForSweep returns only unconsumed/unexpired intents past grace", async () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const fresh = await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() - 60_000), // expired 1 min ago
    });
    const stale = await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() - 6 * 60_000), // 6 min ago
    });
    await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() - 6 * 60_000),
      consumedAt: now,
    });
    const found = await repo.findOrphanedForSweep({ now, graceMs: 300_000, limit: 50 });
    expect(found.map((i) => i.props.publicId)).toEqual([stale.publicId]);
    expect(found.map((i) => i.props.publicId)).not.toContain(fresh.publicId);
  });

  it("markExpired transitions an unconsumed/unexpired intent and is idempotent", async () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - 300_000);
    const intent = await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() - 6 * 60_000),
    });
    expect(await repo.markExpired({ publicId: intent.publicId, now, expiresBefore: cutoff })).toBe(
      true,
    );
    expect(await repo.markExpired({ publicId: intent.publicId, now, expiresBefore: cutoff })).toBe(
      false,
    );
    const row = await ctx.fetchIntentRow(intent.publicId);
    expect(row.expired_at).not.toBeNull();
  });

  it("markExpired refuses when the upload URL was refreshed past the cutoff", async () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - 300_000);
    // Simulates refreshUploadUrl winning between the sweeper's batch read and
    // its markExpired write: the row's expiry is now in the future.
    const intent = await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() + 15 * 60_000),
    });

    const expired = await repo.markExpired({
      publicId: intent.publicId,
      now,
      expiresBefore: cutoff,
    });

    expect(expired).toBe(false);
    const row = await ctx.fetchIntentRow(intent.publicId);
    expect(row.expired_at).toBeNull();
  });

  it("refreshUploadUrl rotates the URL only when intent is unconsumed and unexpired", async () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const intent = await ctx.insertIntentRaw({
      uploadUrlExpiresAt: new Date(now.getTime() - 1_000),
    });
    const newExpiresAt = new Date(now.getTime() + 15 * 60_000);
    const ok = await repo.refreshUploadUrl({
      publicId: intent.publicId,
      uploadUrl: "https://example.test/new",
      uploadUrlExpiresAt: newExpiresAt,
      now,
    });
    expect(ok).toBe(true);

    // Cutoff must be past the refreshed uploadUrlExpiresAt (now + 15min) so the
    // fence actually lets this expire — this test isn't exercising the fence
    // edge case itself (covered above), just that expiry blocks further refresh.
    await repo.markExpired({
      publicId: intent.publicId,
      now,
      expiresBefore: new Date(newExpiresAt.getTime() + 60_000),
    });
    const okAfterExpire = await repo.refreshUploadUrl({
      publicId: intent.publicId,
      uploadUrl: "https://example.test/newer",
      uploadUrlExpiresAt: newExpiresAt,
      now,
    });
    expect(okAfterExpire).toBe(false);
  });
});
