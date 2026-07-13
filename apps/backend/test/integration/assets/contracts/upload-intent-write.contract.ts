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
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const GRACE_CUTOFF_MINUTES = 5;
const REFRESHED_EXPIRY_MINUTES = 15;
const SWEEP_OLDEST_MINUTES = 60;
const SWEEP_OLDER_MINUTES = 30;
const SWEEP_WITHIN_GRACE_MINUTES = 2;
const SWEEP_CONSUMED_MINUTES = 45;

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

  it("markConsumed sets consumedAt and stays a no-op on repeat calls", async () => {
    const input = ctx.makeInsertInput();
    await ctx.repo.insert(input);

    await ctx.repo.markConsumed(input.publicId);
    const afterFirst = await ctx.repo.findByPublicId(input.publicId);
    expect(afterFirst!.props.consumedAt).not.toBeNull();

    await expect(ctx.repo.markConsumed(input.publicId)).resolves.toBeUndefined();
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
    await ctx.repo.markConsumed(input.publicId);

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
    await ctx.repo.markConsumed(input.publicId);

    const refreshed = await ctx.repo.refreshUploadUrl({
      publicId: input.publicId,
      uploadUrl: "https://storage.example.com/refreshed",
      uploadUrlExpiresAt: new Date(Date.now() + HOUR_MS),
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
    await ctx.repo.markConsumed(consumed.publicId);

    const sweep = await ctx.repo.findOrphanedForSweep({ now, graceMs, limit: 10 });
    expect(sweep.map((i) => i.props.publicId)).toEqual([oldest.publicId, older.publicId]);

    const limited = await ctx.repo.findOrphanedForSweep({ now, graceMs, limit: 1 });
    expect(limited.map((i) => i.props.publicId)).toEqual([oldest.publicId]);
  });
}
