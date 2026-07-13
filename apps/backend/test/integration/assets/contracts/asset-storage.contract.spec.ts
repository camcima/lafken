import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe } from "vitest";

import { GcsAssetStorageAdapter } from "@/assets/infrastructure/services/gcs-asset-storage.adapter";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import {
  type IAssetStorageContractContext,
  runAssetStorageContract,
} from "./asset-storage.contract";

// Same gate and fixtures as gcs-asset-storage.adapter.spec.ts.
// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true";
const ENDPOINT = "http://localhost:4444";
const BINDING = { bucket: "lafken-dev", projectId: "lafken-dev" };
const CREDENTIALS_JSON = readFileSync(
  join(__dirname, "../../../fixtures/fake-gcs-credentials.json"),
  "utf8",
);
const UPLOAD_MAX_BYTES = 1_048_576n;
const UPLOAD_TTL_SECONDS = 900;

let contextCounter = 0;

describe("AssetStoragePort contract — in-memory fake", () => {
  runAssetStorageContract((): Promise<IAssetStorageContractContext> => {
    const fake = new FakeAssetStorage();
    // The fake's `existsResult` default short-circuits objectExists to `true`
    // for use-case tests that don't seed bytes. The contract exercises real
    // object-backed behavior, so disable the short-circuit here.
    fake.existsResult = false;
    contextCounter += 1;
    const runId = `fake-${contextCounter}`;
    return Promise.resolve({
      storage: fake,
      binding: BINDING,
      putObject: (storageKey: string, bytes: Uint8Array): Promise<void> => {
        fake.objects.set(storageKey, Buffer.from(bytes));
        return Promise.resolve();
      },
      uniqueKey: (suffix: string): string => `contract/${runId}/${suffix}`,
    });
  });
});

describe.skipIf(!GATE)("AssetStoragePort contract — GCS adapter (fake-gcs)", () => {
  const adapter = new GcsAssetStorageAdapter({
    endpoint: ENDPOINT,
    credentialsJson: CREDENTIALS_JSON,
  });
  // Every key a case might touch is minted through uniqueKey (including
  // move targets that never go through putObject), so tracking calls to it
  // is sufficient to sweep everything a test could have written to fake-gcs.
  // deleteObject is itself a no-op for a missing key (proven by this same
  // contract), so sweeping keys that were never actually written is safe.
  let keysToClean: string[] = [];

  afterEach(async () => {
    await Promise.all(
      keysToClean.map((storageKey) => adapter.deleteObject({ binding: BINDING, storageKey })),
    );
    keysToClean = [];
  });

  runAssetStorageContract((): Promise<IAssetStorageContractContext> => {
    contextCounter += 1;
    const runId = `gcs-${Date.now()}-${contextCounter}`;
    return Promise.resolve({
      storage: adapter,
      binding: BINDING,
      putObject: async (storageKey: string, bytes: Uint8Array): Promise<void> => {
        const issued = await adapter.issueSignedUploadUrl({
          binding: BINDING,
          storageKey,
          contentType: "application/octet-stream",
          maxBytes: UPLOAD_MAX_BYTES,
          ttlSeconds: UPLOAD_TTL_SECONDS,
        });
        const response = await fetch(issued.url, {
          method: "PUT",
          headers: issued.headers,
          // Re-wrap: `bytes: Uint8Array` (no generic arg) widens to
          // `Uint8Array<ArrayBufferLike>`, which fetch's `BodyInit` rejects.
          // Constructing from the ArrayLike/Iterable overload narrows back
          // to `Uint8Array<ArrayBuffer>`, satisfying the DOM lib types.
          body: new Uint8Array(bytes),
        });
        if (!response.ok) {
          throw new Error(`contract putObject failed with status ${response.status}`);
        }
      },
      uniqueKey: (suffix: string): string => {
        const key = `contract/${runId}/${suffix}`;
        keysToClean.push(key);
        return key;
      },
    });
  });
});
