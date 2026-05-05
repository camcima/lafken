import { beforeEach, describe, expect, it } from "vitest";

import { UpdatePresetVersionUseCase } from "@/namespaces/application/use-cases/update-preset-version.use-case";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetVersionConflictError } from "@/namespaces/domain/errors/preset-version-conflict.error";
import { ReservedPresetNameError } from "@/namespaces/domain/errors/reserved-preset-name.error";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespacePresetWriteRepository } from "../__fakes__/in-memory-namespace-preset-write.repository";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";

const VALID_PARAMS = PresetParams.fromUnknown({
  width: 800,
  height: 600,
  fit: "cover",
  format: "webp",
  quality: 80,
  dpr: 2,
});

function makeNamespace(opts: { slug: string; archived?: boolean }): Namespace {
  return Namespace.fromProps({
    id: "ns-1",
    slug: new Slug(opts.slug),
    displayName: "X",
    description: null,
    currentPolicyId: "pol-1",
    storageBindingId: "sb-1",
    archivedAt: opts.archived ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makePresetV1(opts: { active: boolean }): NamespacePreset {
  return NamespacePreset.fromProps({
    id: "pres-1",
    namespaceId: "ns-1",
    name: "thumbnail",
    version: 1,
    params: VALID_PARAMS,
    cdnMaxAge: null,
    signedUrlTtl: null,
    preGenerate: false,
    requiredPermission: null,
    description: null,
    active: opts.active,
    createdAt: new Date(),
  });
}

describe("UpdatePresetVersionUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespacePresetWriteRepository;
  let useCase: UpdatePresetVersionUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespacePresetWriteRepository();
    useCase = new UpdatePresetVersionUseCase(queryRepo, writeRepo);
  });

  it("creates v2 inheriting active=true from latest v1", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const v1 = makePresetV1({ active: true });
    queryRepo.seed([ns]);
    queryRepo.seedPresets([v1]);
    writeRepo.seed(v1);

    const v2 = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: "ops@latam.com",
    });

    expect(v2.props.version).toBe(2);
    expect(v2.props.active).toBe(true);
  });

  it("creates v2 inheriting active=false from latest v1", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const v1 = makePresetV1({ active: false });
    queryRepo.seed([ns]);
    queryRepo.seedPresets([v1]);
    writeRepo.seed(v1);

    const v2 = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });

    expect(v2.props.active).toBe(false);
  });

  it("throws NamespaceNotFoundError when slug missing", async () => {
    await expect(
      useCase.execute({ slug: "ghost", name: "x", params: VALID_PARAMS, createdBy: null }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });

  it("throws NamespaceArchivedError when archived", async () => {
    queryRepo.seed([makeNamespace({ slug: "aircraft-photos", archived: true })]);
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceArchivedError);
  });

  it("rejects names starting with the reserved 'lafken:' prefix before any repository lookup", async () => {
    // No seed: the prefix check must fire before findBySlug, so this won't hit NamespaceNotFoundError.
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "lafken:thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(ReservedPresetNameError);
  });

  it("rejects names with the reserved prefix in mixed case", async () => {
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "Lafken:Thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(ReservedPresetNameError);
  });

  it("throws PresetNotFoundError when name does not exist", async () => {
    queryRepo.seed([makeNamespace({ slug: "aircraft-photos" })]);
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "ghost",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(PresetNotFoundError);
  });

  it("retries once on transient conflict and succeeds", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const v1 = makePresetV1({ active: true });
    queryRepo.seed([ns]);
    queryRepo.seedPresets([v1]);
    writeRepo.seed(v1);
    writeRepo.collisionsRemaining = 1;

    const v2 = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: null,
    });
    expect(v2.props.version).toBe(2);
    expect(writeRepo.collisionsRemaining).toBe(0);
  });

  it("surfaces PresetVersionConflictError on persistent conflict (with real slug)", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const v1 = makePresetV1({ active: true });
    queryRepo.seed([ns]);
    queryRepo.seedPresets([v1]);
    writeRepo.seed(v1);
    writeRepo.collisionsRemaining = 5;

    try {
      await useCase.execute({
        slug: "aircraft-photos",
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      });
      expect.fail("should have thrown");
    } catch (err) {
      if (!(err instanceof PresetVersionConflictError)) throw err;
      expect(err.slug).toBe("aircraft-photos");
      expect(err.name).toBe("thumbnail");
    }
  });
});
