import { describe, expect, it } from "vitest";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";

describe("FakeAssetStorage readObjectBytes", () => {
  it("returns stored bytes for a storage key", async () => {
    const storage = new FakeAssetStorage();
    const bytes = Buffer.from("image-bytes");
    storage.objects.set("assets/one/source", bytes);

    await expect(
      storage.readObjectBytes({
        binding: { bucket: "test-bucket", projectId: "test-project" },
        storageKey: "assets/one/source",
      }),
    ).resolves.toEqual(bytes);
  });

  it("throws when bytes do not exist", async () => {
    const storage = new FakeAssetStorage();

    await expect(
      storage.readObjectBytes({
        binding: { bucket: "test-bucket", projectId: "test-project" },
        storageKey: "missing/source",
      }),
    ).rejects.toThrow('Object "missing/source" does not exist');
  });
});
