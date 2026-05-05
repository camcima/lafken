import { beforeEach, describe, expect, it } from "vitest";

import { SetPresetActiveUseCase } from "@/namespaces/application/use-cases/set-preset-active.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespacePresetWriteRepository } from "../__fakes__/in-memory-namespace-preset-write.repository";

const VALID_PARAMS = PresetParams.fromUnknown({
  width: 1,
  height: 1,
  fit: "cover",
  format: "auto",
  quality: 80,
  dpr: 1,
});

function ns(opts: { slug: string; archived?: boolean }): Namespace {
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

function preset(active: boolean): NamespacePreset {
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
    active,
    createdAt: new Date(),
  });
}

describe("SetPresetActiveUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespacePresetWriteRepository;
  let useCase: SetPresetActiveUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespacePresetWriteRepository();
    useCase = new SetPresetActiveUseCase(queryRepo, writeRepo);
  });

  it("activates an inactive preset", async () => {
    queryRepo.seed([ns({ slug: "aircraft-photos" })]);
    queryRepo.seedPresets([preset(false)]);
    writeRepo.seed(preset(false));

    const result = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      active: true,
    });
    expect(result.props.active).toBe(true);
  });

  it("deactivates an active preset", async () => {
    queryRepo.seed([ns({ slug: "aircraft-photos" })]);
    queryRepo.seedPresets([preset(true)]);
    writeRepo.seed(preset(true));

    const result = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      active: false,
    });
    expect(result.props.active).toBe(false);
  });

  it("is idempotent when toggling to current state", async () => {
    queryRepo.seed([ns({ slug: "aircraft-photos" })]);
    queryRepo.seedPresets([preset(true)]);
    writeRepo.seed(preset(true));

    const result = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      active: true,
    });
    expect(result.props.active).toBe(true);
  });

  it("throws NamespaceNotFoundError when slug missing", async () => {
    await expect(
      useCase.execute({ slug: "ghost", name: "x", active: true }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });

  it("throws NamespaceArchivedError when archived", async () => {
    queryRepo.seed([ns({ slug: "aircraft-photos", archived: true })]);
    await expect(
      useCase.execute({ slug: "aircraft-photos", name: "thumbnail", active: true }),
    ).rejects.toBeInstanceOf(NamespaceArchivedError);
  });

  it("throws PresetNotFoundError when name unknown", async () => {
    queryRepo.seed([ns({ slug: "aircraft-photos" })]);
    await expect(
      useCase.execute({ slug: "aircraft-photos", name: "ghost", active: true }),
    ).rejects.toBeInstanceOf(PresetNotFoundError);
  });
});
