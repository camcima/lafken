import { randomUUID } from "node:crypto";

import { beforeEach, expect, it } from "vitest";

import type {
  IInsertUploadIntentInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";

export interface IUploadIntentWriteContractContext {
  repo: UploadIntentWriteRepositoryPort;
  /**
   * Builds a valid insert input for this implementation — FK ids (namespace,
   * policy, binding) must resolve against the implementation's backing store.
   * publicId defaults to a fresh random UUID per call.
   */
  makeInsertInput(overrides?: Partial<IInsertUploadIntentInput>): IInsertUploadIntentInput;
  /**
   * Test-only: forces the intent at `publicId` into the consumed state,
   * bypassing the port. The port intentionally has no consume operation —
   * in production, consuming an intent is an atomic side effect of
   * AssetWriteRepository.createUploadedAsset (the CAS that also creates the
   * asset row), never a standalone step. This exists purely to set up
   * "already consumed" fixtures for the cases below.
   */
  consumeForTest(publicId: string): Promise<void>;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const GRACE_CUTOFF_MINUTES = 5;
const REFRESHED_EXPIRY_MINUTES = 15;
const SWEEP_OLDEST_MINUTES = 60;
const SWEEP_OLDER_MINUTES = 30;
const SWEEP_WITHIN_GRACE_MINUTES = 2;
const SWEEP_CONSUMED_MINUTES = 45;
const SWEEP_EXPIRED_MINUTES = 90;
/** Fixed instant used for the markExpired boundary case — arbitrary, just
 *  needs to be a valid Date shared by uploadUrlExpiresAt/now/expiresBefore. */
const BOUNDARY_INSTANT = new Date("2026-02-01T00:00:00.000Z");

/**
 * Contract suite for UploadIntentWriteRepositoryPort. Runs identically against
 * the in-memory fake and the real Postgres repository so the use-case tests
 * that rely on the fake can trust its semantics (CLAUDE.md contract-test rule;
 * F-T3). Cases only touch the port surface — implementation-specific
 * SQL assertions live in the per-repository integration specs.
 */
export function runUploadIntentWriteContract(
  makeContext: () => Promise<IUploadIntentWriteContractContext>,
): void {
  let ctx: IUploadIntentWriteContractContext;

  beforeEach(async () => {
    ctx = await makeContext();
  });

  it("insert → findByPublicId round-trips with consumedAt/expiredAt null", async () => {
    const input = ctx.makeInsertInput();
    await ctx.repo.insert(input);

    const found = await ctx.repo.findByPublicId(input.publicId);

    expect(found).not.toBeNull();
    expect(found!.props.publicId).toBe(input.publicId);
    expect(found!.props.storageKey).toBe(input.storageKey);
    expect(found!.props.declaredSizeBytes).toBe(input.declaredSizeBytes);
    expect(found!.props.consumedAt).toBeNull();
    expect(found!.props.expiredAt).toBeNull();
  });

  it("findByPublicId returns null for an unknown publicId", async () => {
    expect(await ctx.repo.findByPublicId(randomUUID())).toBeNull();
  });

  it("markExpired expires a wall-clock-expired intent once and returns false on repeat", async () => {
    const now = new Date();
    const input = ctx.makeInsertInput({
      uploadUrlExpiresAt: new Date(now.getTime() - HOUR_MS),
    });
    await ctx.repo.insert(input);
    const cutoff = new Date(now.getTime() - GRACE_CUTOFF_MINUTES * MINUTE_MS);

    expect(
      await ctx.repo.markExpired({ publicId: input.publicId, now, expiresBefore: cutoff }),
    ).toBe(true);
    expect(
      await ctx.repo.markExpired({ publicId: input.publicId, now, expiresBefore: cutoff }),
    ).toBe(false);

    const found = await ctx.repo.findByPublicId(input.publicId);
    expect(found!.props.expiredAt).not.toBeNull();
  });

  it("markExpired returns false for a consumed intent", async () => {
    const now = new Date();
    const input = ctx.makeInsertInput({
      uploadUrlExpiresAt: new Date(now.getTime() - HOUR_MS),
    });
    await ctx.repo.insert(input);
    await ctx.consumeForTest(input.publicId);

    expect(
      await ctx.repo.markExpired({
        publicId: input.publicId,
        now,
        expiresBefore: new Date(now.getTime() - GRACE_CUTOFF_MINUTES * MINUTE_MS),
      }),
    ).toBe(false);
  });

  it("markExpired refuses when the URL expiry is past the cutoff (refreshed intent)", async () => {
    const now = new Date();
    // Simulates refreshUploadUrl winning between the sweeper's stale batch
    // read and its markExpired write: the row's expiry is now in the future.
    const input = ctx.makeInsertInput({
      uploadUrlExpiresAt: new Date(now.getTime() + REFRESHED_EXPIRY_MINUTES * MINUTE_MS),
    });
    await ctx.repo.insert(input);

    expect(
      await ctx.repo.markExpired({
        publicId: input.publicId,
        now,
        expiresBefore: new Date(now.getTime() - GRACE_CUTOFF_MINUTES * MINUTE_MS),
      }),
    ).toBe(false);
    const found = await ctx.repo.findByPublicId(input.publicId);
    expect(found!.props.expiredAt).toBeNull();
  });

  it("markExpired does not expire an intent whose uploadUrlExpiresAt exactly equals expiresBefore", async () => {
    // Both implementations use a strict `<` cutoff comparison: an intent
    // expiring at exactly the cutoff is not yet past it.
    const input = ctx.makeInsertInput({ uploadUrlExpiresAt: BOUNDARY_INSTANT });
    await ctx.repo.insert(input);

    const transitioned = await ctx.repo.markExpired({
      publicId: input.publicId,
      now: BOUNDARY_INSTANT,
      expiresBefore: BOUNDARY_INSTANT,
    });

    expect(transitioned).toBe(false);
    const found = await ctx.repo.findByPublicId(input.publicId);
    expect(found!.props.expiredAt).toBeNull();
  });

  it("refreshUploadUrl rewrites URL and expiry on a live intent and returns true", async () => {
    const input = ctx.makeInsertInput();
    await ctx.repo.insert(input);
    const newExpiry = new Date(Date.now() + 2 * HOUR_MS);

    const refreshed = await ctx.repo.refreshUploadUrl({
      publicId: input.publicId,
      uploadUrl: "https://storage.example.com/refreshed",
      uploadUrlExpiresAt: newExpiry,
      now: new Date(),
    });

    expect(refreshed).toBe(true);
    const found = await ctx.repo.findByPublicId(input.publicId);
    expect(found!.props.uploadUrl).toBe("https://storage.example.com/refreshed");
    expect(found!.props.uploadUrlExpiresAt.getTime()).toBe(newExpiry.getTime());
  });

  it("refreshUploadUrl returns false for a consumed intent", async () => {
    const input = ctx.makeInsertInput();
    await ctx.repo.insert(input);
    await ctx.consumeForTest(input.publicId);

    const refreshed = await ctx.repo.refreshUploadUrl({
      publicId: input.publicId,
      uploadUrl: "https://storage.example.com/refreshed",
      uploadUrlExpiresAt: new Date(Date.now() + HOUR_MS),
      now: new Date(),
    });

    expect(refreshed).toBe(false);
  });

  it("refreshUploadUrl returns false for an expired (not consumed) intent", async () => {
    const now = new Date();
    const input = ctx.makeInsertInput({
      uploadUrlExpiresAt: new Date(now.getTime() - HOUR_MS),
    });
    await ctx.repo.insert(input);
    const wasExpired = await ctx.repo.markExpired({
      publicId: input.publicId,
      now,
      expiresBefore: new Date(now.getTime() - GRACE_CUTOFF_MINUTES * MINUTE_MS),
    });
    expect(wasExpired).toBe(true);

    const refreshed = await ctx.repo.refreshUploadUrl({
      publicId: input.publicId,
      uploadUrl: "https://storage.example.com/refreshed",
      uploadUrlExpiresAt: new Date(now.getTime() + HOUR_MS),
      now: new Date(),
    });

    expect(refreshed).toBe(false);
  });

  it("findOrphanedForSweep returns only unconsumed/unexpired intents past the grace cutoff, oldest expiry first, capped at limit", async () => {
    const now = new Date();
    const graceMs = GRACE_CUTOFF_MINUTES * MINUTE_MS;
    const past = (minutes: number): Date => new Date(now.getTime() - minutes * MINUTE_MS);

    const oldest = ctx.makeInsertInput({ uploadUrlExpiresAt: past(SWEEP_OLDEST_MINUTES) });
    const older = ctx.makeInsertInput({ uploadUrlExpiresAt: past(SWEEP_OLDER_MINUTES) });
    const withinGrace = ctx.makeInsertInput({
      uploadUrlExpiresAt: past(SWEEP_WITHIN_GRACE_MINUTES),
    });
    const live = ctx.makeInsertInput({ uploadUrlExpiresAt: new Date(now.getTime() + HOUR_MS) });
    const consumed = ctx.makeInsertInput({ uploadUrlExpiresAt: past(SWEEP_CONSUMED_MINUTES) });
    await ctx.repo.insert(oldest);
    await ctx.repo.insert(older);
    await ctx.repo.insert(withinGrace);
    await ctx.repo.insert(live);
    await ctx.repo.insert(consumed);
    await ctx.consumeForTest(consumed.publicId);

    const sweep = await ctx.repo.findOrphanedForSweep({ now, graceMs, limit: 10 });
    expect(sweep.map((i) => i.props.publicId)).toEqual([oldest.publicId, older.publicId]);

    const limited = await ctx.repo.findOrphanedForSweep({ now, graceMs, limit: 1 });
    expect(limited.map((i) => i.props.publicId)).toEqual([oldest.publicId]);
  });

  it("findOrphanedForSweep excludes an already-expired intent", async () => {
    const now = new Date();
    const graceMs = GRACE_CUTOFF_MINUTES * MINUTE_MS;
    const input = ctx.makeInsertInput({
      uploadUrlExpiresAt: new Date(now.getTime() - SWEEP_EXPIRED_MINUTES * MINUTE_MS),
    });
    await ctx.repo.insert(input);
    const wasExpired = await ctx.repo.markExpired({
      publicId: input.publicId,
      now,
      expiresBefore: new Date(now.getTime() - graceMs),
    });
    expect(wasExpired).toBe(true);

    const sweep = await ctx.repo.findOrphanedForSweep({ now, graceMs, limit: 10 });
    expect(sweep.map((i) => i.props.publicId)).not.toContain(input.publicId);
  });
}
