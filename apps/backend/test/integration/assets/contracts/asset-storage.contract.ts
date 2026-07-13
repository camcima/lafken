import { expect, it } from "vitest";

import type {
  AssetStoragePort,
  IGcsBindingDescriptor,
} from "@/assets/domain/services/asset-storage.service.port";

export interface IAssetStorageContractContext {
  storage: AssetStoragePort;
  binding: IGcsBindingDescriptor;
  /** Writes bytes at storageKey through the implementation's native write path. */
  putObject(storageKey: string, bytes: Uint8Array): Promise<void>;
  /** Collision-free key namespace per context (shared bucket on the GCS side). */
  uniqueKey(suffix: string): string;
}

const EXISTS_BYTE_COUNT = 3;
const READ_BYTE_COUNT = 4;
const FULL_BYTE_COUNT = 8;
const PREFIX_BYTE_COUNT = 4;
const MOVE_BYTE_COUNT = 3;
const SINGLE_BYTE_COUNT = 1;
const OVERSIZED_MAX_BYTES_MARGIN = 4;
const ZERO_MAX_BYTES = 0;
const NEGATIVE_MAX_BYTES = -1;

/**
 * Deterministic byte sequence 1..count. Cases only assert on
 * round-tripping/truncation, not on any particular byte pattern, so values
 * are generated rather than spelled out as array literals — this file isn't
 * a `*.spec.ts`, so it doesn't get the test-file `no-magic-numbers`
 * exemption, and generating keeps the fixture and its expectation in
 * lockstep instead of duplicating literals.
 */
function sequentialBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    bytes[index] = index + 1;
  }
  return bytes;
}

/**
 * Contract suite for AssetStoragePort (F-T3): the same object-lifecycle
 * behaviors must hold for the in-memory fake and the real GCS adapter, so
 * pipeline/use-case tests running on the fake can trust its semantics.
 */
export function runAssetStorageContract(
  makeContext: () => Promise<IAssetStorageContractContext>,
): void {
  it("objectExists returns false for a key that was never written", async () => {
    const ctx = await makeContext();
    expect(
      await ctx.storage.objectExists({
        binding: ctx.binding,
        storageKey: ctx.uniqueKey("missing"),
      }),
    ).toBe(false);
  });

  it("objectExists returns true after bytes are written", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("exists");
    await ctx.putObject(key, sequentialBytes(EXISTS_BYTE_COUNT));
    expect(await ctx.storage.objectExists({ binding: ctx.binding, storageKey: key })).toBe(true);
  });

  it("readObjectBytes returns exactly the bytes written", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read");
    const expected = sequentialBytes(READ_BYTE_COUNT);
    await ctx.putObject(key, expected);

    // No `maxBytes` passed: pins the omitted-maxBytes contract ("read the
    // whole object") alongside the explicit oversized/exact-cap cases below.
    const bytes = await ctx.storage.readObjectBytes({ binding: ctx.binding, storageKey: key });

    expect(Array.from(bytes)).toEqual(Array.from(expected));
  });

  it("readObjectBytes honors maxBytes by returning only the prefix", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read-prefix");
    await ctx.putObject(key, sequentialBytes(FULL_BYTE_COUNT));

    const bytes = await ctx.storage.readObjectBytes({
      binding: ctx.binding,
      storageKey: key,
      maxBytes: PREFIX_BYTE_COUNT,
    });

    expect(Array.from(bytes)).toEqual(Array.from(sequentialBytes(PREFIX_BYTE_COUNT)));
  });

  it("readObjectBytes returns the whole object when maxBytes exceeds its length", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read-oversized-cap");
    const expected = sequentialBytes(FULL_BYTE_COUNT);
    await ctx.putObject(key, expected);

    const bytes = await ctx.storage.readObjectBytes({
      binding: ctx.binding,
      storageKey: key,
      maxBytes: FULL_BYTE_COUNT + OVERSIZED_MAX_BYTES_MARGIN,
    });

    expect(Array.from(bytes)).toEqual(Array.from(expected));
  });

  it("readObjectBytes returns the whole object when maxBytes equals its length exactly", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read-exact-cap");
    const expected = sequentialBytes(FULL_BYTE_COUNT);
    await ctx.putObject(key, expected);

    const bytes = await ctx.storage.readObjectBytes({
      binding: ctx.binding,
      storageKey: key,
      maxBytes: FULL_BYTE_COUNT,
    });

    expect(Array.from(bytes)).toEqual(Array.from(expected));
  });

  it("readObjectBytes rejects when maxBytes is zero instead of fail-opening to the whole object", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read-zero-cap");
    await ctx.putObject(key, sequentialBytes(FULL_BYTE_COUNT));

    await expect(
      ctx.storage.readObjectBytes({
        binding: ctx.binding,
        storageKey: key,
        maxBytes: ZERO_MAX_BYTES,
      }),
    ).rejects.toThrow();
  });

  it("readObjectBytes rejects when maxBytes is negative", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("read-negative-cap");
    await ctx.putObject(key, sequentialBytes(FULL_BYTE_COUNT));

    await expect(
      ctx.storage.readObjectBytes({
        binding: ctx.binding,
        storageKey: key,
        maxBytes: NEGATIVE_MAX_BYTES,
      }),
    ).rejects.toThrow();
  });

  it("readObjectBytes rejects for a missing key", async () => {
    const ctx = await makeContext();
    await expect(
      ctx.storage.readObjectBytes({ binding: ctx.binding, storageKey: ctx.uniqueKey("void") }),
    ).rejects.toThrow();
  });

  it("moveObject relocates bytes: source disappears, target serves them", async () => {
    const ctx = await makeContext();
    const from = ctx.uniqueKey("move-from");
    const to = ctx.uniqueKey("move-to");
    const expected = sequentialBytes(MOVE_BYTE_COUNT);
    await ctx.putObject(from, expected);

    await ctx.storage.moveObject({ binding: ctx.binding, fromKey: from, toKey: to });

    expect(await ctx.storage.objectExists({ binding: ctx.binding, storageKey: from })).toBe(false);
    const bytes = await ctx.storage.readObjectBytes({ binding: ctx.binding, storageKey: to });
    expect(Array.from(bytes)).toEqual(Array.from(expected));
  });

  it("moveObject treats an already-moved object as success (idempotent retry)", async () => {
    const ctx = await makeContext();
    const from = ctx.uniqueKey("retry-from");
    const to = ctx.uniqueKey("retry-to");
    // Target in place, source gone — simulates a retry after a prior attempt
    // already completed the move.
    await ctx.putObject(to, sequentialBytes(SINGLE_BYTE_COUNT));

    await expect(
      ctx.storage.moveObject({ binding: ctx.binding, fromKey: from, toKey: to }),
    ).resolves.toBeUndefined();
  });

  it("moveObject throws when neither source nor target exists", async () => {
    const ctx = await makeContext();
    await expect(
      ctx.storage.moveObject({
        binding: ctx.binding,
        fromKey: ctx.uniqueKey("ghost-from"),
        toKey: ctx.uniqueKey("ghost-to"),
      }),
    ).rejects.toThrow();
  });

  it("deleteObject removes the object", async () => {
    const ctx = await makeContext();
    const key = ctx.uniqueKey("delete");
    await ctx.putObject(key, sequentialBytes(SINGLE_BYTE_COUNT));

    await ctx.storage.deleteObject({ binding: ctx.binding, storageKey: key });

    expect(await ctx.storage.objectExists({ binding: ctx.binding, storageKey: key })).toBe(false);
  });

  it("deleteObject is a no-op for a missing key", async () => {
    const ctx = await makeContext();
    await expect(
      ctx.storage.deleteObject({ binding: ctx.binding, storageKey: ctx.uniqueKey("nothing") }),
    ).resolves.toBeUndefined();
  });
}
